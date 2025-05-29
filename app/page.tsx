import { ChatWindow } from "@/components/ChatWindow";
import { GuideInfoBox } from "@/components/guide/GuideInfoBox";

export default function Home() {
  const InfoCard = (
    <GuideInfoBox>
      <ul>
        <li className="text-l">
          Feel free to ask me things like:  how many bins in an organiztion will be going empty before a certain date? Or, show me barns from an organization on a map.
        </li>
      </ul>
    </GuideInfoBox>
  );
  return (
    <ChatWindow
      endpoint="binbot/chat"
      emoji="🏴‍☠️"
      placeholder="BinBot is ready to beep boop..."
      emptyStateComponent={InfoCard}
    />
  );
}
