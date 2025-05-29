import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import {
  AIMessage,
  BaseMessage,
  ChatMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { initSseClientAndTools, initStdioClientAndTools } from "@/lib/mcp-client";

export const runtime = "edge";

const convertVercelMessageToLangChainMessage = (message: VercelChatMessage) => {
  if (message.role === "user") {
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  } else {
    return new ChatMessage(message.content, message.role);
  }
};

const convertLangChainMessageToVercelMessage = (message: BaseMessage) => {
  if (message._getType() === "human") {
    return { content: message.content, role: "user" };
  } else if (message._getType() === "ai") {
    return {
      content: message.content,
      role: "assistant",
      tool_calls: (message as AIMessage).tool_calls,
    };
  } else {
    return { content: message.content, role: message._getType() };
  }
};

let currentDate = new Date();
let currentDateString = currentDate.toISOString().split("T")[0];
// let stdioClientAndTools = initStdioClientAndTools();
let sseTools = await initSseClientAndTools();

const AGENT_SYSTEM_TEMPLATE = "You are a helpful chatbot about any topic that may or may not need to use tools to answer the user's "
                   "question. If you do not need to use tools to answer a question, go ahead and answer it without using "
                   "tools.  If a tool would be helpful to answer a question, try to use it. If necessary feel free to use "
                   "multiple tools to answer a question and to combine results from multiple tools. "
                   "Here is a structure of organizations in the system: "
                   " - Organizations can be barns, farms, sites, customers, mills, billing accounts, accounts, account groups etc. "
                   " - Each organization has a name, path, type, and id. "
                   " - The id is a link to the organization in the form of how it was returned by the tool"
                   " - organization hierarchy is billing account -> mill/account -> customer -> site/farm -> barn. "
                   " - barns can have bins, but other organizations do not have bins directly in them"
                   "When displaying an organization: "
                   " - Always show the full organization path"
                   " - Always show the organization id in the form of a link, like this: [organization name](the url returned by the tool)."
                   "When displaying dates, show time info as well in EST timezone, for example: 2023-10-01 14:00"
                   "Today's date in ISO String format is: " + currentDateString + "."
                                                       "barns can have groups (animal groups) in them, each group can be ongoing or ended."
                                                       "When displaying groups, show all available fields, including start date, end date, duration, and if it was previously started or ongoing."
                                                       "When displaying maps or points of interest, always show url that includes everything and api key too."
                                                       "show url to a map when it's available, show the full link as it was returned by the tool, do not modify it.";

/**
 * This handler initializes and calls an tool caling ReAct agent.
 * See the docs for more information:
 *
 * https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/
 */
export async function POST(req: NextRequest) {
  try {
    console.log("POST /binbot/chat");
    const body = await req.json();
    const returnIntermediateSteps = body.show_intermediate_steps;
    /**
     * We represent intermediate steps as system messages for display purposes,
     * but don't want them in the chat history.
     */
    const messages = (body.messages ?? [])
      .filter(
        (message: VercelChatMessage) =>
          message.role === "user" || message.role === "assistant",
      )
      .map(convertVercelMessageToLangChainMessage);

    // Requires process.env.SERPAPI_API_KEY to be set: https://serpapi.com/
    // You can remove this or use a different tool instead.
    // const tools = [new Calculator(), new SerpAPI()];

    const chat = new ChatOpenAI({
        configuration: {
            apiKey: process.env['OPEN_API_KEY'],
        },
        model: 'gpt-4.1',
        streaming: true,
        verbose: false
    });

    let currentDate = new Date();
    let currentDateString = currentDate.toISOString().split("T")[0];

    /**
     * Use a prebuilt LangGraph agent.
     */
    // const agent = createReactAgent({
    //   llm: chat,
    //   tools,
    //   /**
    //    * Modify the stock prompt in the prebuilt agent. See docs
    //    * for how to customize your agent:
    //    *
    //    * https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/
    //    */
    //   messageModifier: new SystemMessage(AGENT_SYSTEM_TEMPLATE),
    // });


    const agent = createReactAgent({
        llm: chat,
        tools: sseTools,
        prompt: "You are a helpful chatbot about any topic that may or may not need to use tools to answer the user's " +
                   "question. If you do not need to use tools to answer a question, go ahead and answer it without using " + 
                   "tools.  If a tool would be helpful to answer a question, try to use it. If necessary feel free to use " + 
                   "multiple tools to answer a question and to combine results from multiple tools. " + 
                   "Here is a structure of organizations in the system: " + 
                   " - Organizations can be barns, farms, sites, customers, mills, billing accounts, accounts, account groups etc. " + 
                   " - Each organization has a name, path, type, and id. " + 
                   " - The id is a link to the organization in the form of how it was returned by the tool" + 
                   " - organization hierarchy is billing account -> mill/account -> customer -> site/farm -> barn. " + 
                   " - barns can have bins, but other organizations do not have bins directly in them" + 
                   "When displaying an organization: " + 
                   " - Always show the full organization path" + 
                   " - Always show the organization id in the form of a link, like this: [organization name](the url returned by the tool)." + 
                   "When displaying dates, show time info as well in EST timezone, for example: 2023-10-01 14:00" + 
                   "Today is " + currentDateString + "." + 
                                                       "barns can have groups (animal groups) in them, each group can be ongoing or ended." + 
                                                       "When displaying groups, show all available fields, including start date, end date, duration, and if it was previously started or ongoing." +
                                                       "When displaying maps or points of interest, always show url that includes everything and api key too." + 
                                                       "show url to a map when it's available, show the full link as it was returned by the tool, do not modify it.",
            
        /**
         * Modify the stock prompt in the prebuilt agent. See docs
         * for how to customize your agent:
         *
         * https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/
         */
        messageModifier: new SystemMessage(AGENT_SYSTEM_TEMPLATE),
    });


    if (!returnIntermediateSteps) {
      /**
       * Stream back all generated tokens and steps from their runs.
       *
       * We do some filtering of the generated events and only stream back
       * the final response as a string.
       *
       * For this specific type of tool calling ReAct agents with OpenAI, we can tell when
       * the agent is ready to stream back final output when it no longer calls
       * a tool and instead streams back content.
       *
       * See: https://langchain-ai.github.io/langgraphjs/how-tos/stream-tokens/
       */
      const eventStream = await agent.streamEvents(
        { messages },
        { version: "v2" },
      );

      const textEncoder = new TextEncoder();
      const transformStream = new ReadableStream({
        async start(controller) {
          for await (const { event, data } of eventStream) {
            if (event === "on_chat_model_stream") {
              // Intermediate chat model generations will contain tool calls and no content
              if (!!data.chunk.content) {
                controller.enqueue(textEncoder.encode(data.chunk.content));
              }
            }
          }
          controller.close();
        },
      });

      return new StreamingTextResponse(transformStream);
    } else {
      /**
       * We could also pick intermediate steps out from `streamEvents` chunks, but
       * they are generated as JSON objects, so streaming and displaying them with
       * the AI SDK is more complicated.
       */
      const result = await agent.invoke({ messages });

      return NextResponse.json(
        {
          messages: result.messages.map(convertLangChainMessageToVercelMessage),
        },
        { status: 200 },
      );
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}