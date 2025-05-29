// from: https://github.com/shricodev/chat-nextjs-mcp-client/blob/main/lib/mcp-client/index.ts
import { OpenAI } from "openai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {SSEClientTransport} from '@modelcontextprotocol/sdk/client/sse.js';
import { loadMcpTools } from '@langchain/mcp-adapters';

import dotenv from "dotenv";
dotenv.config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// SSE should be compatible with streamable-http
export const initSseClientAndTools = async () => {
  const sseClient = new Client({
    name: 'binbot-client',
    version: '0.1.0',
  });
  const transport = new SSEClientTransport(new URL('http://127.0.0.1:8000/mcp'));
  await sseClient.connect(transport);
  const tools = await loadMcpTools('binbot-client', sseClient);
  return tools;
};
// STDIO alternative:
export const initStdioClientAndTools = async () => {
  const stdioClient = new Client({
    name: 'binbot-client-stdio',
    version: '0.1.0',
  });
  const transport = new StdioClientTransport({
    command: 'python',
    args: ['../../binbot/sample_mcp_server.py']
  });
  await stdioClient.connect(transport);
  const tools = await loadMcpTools('binbot-client-stdio', stdioClient);
  return tools;
};
