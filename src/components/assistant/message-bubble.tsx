import { Sparkles, User } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { ToolSummaryStrip, type DisplayToolSummary } from "@/components/assistant/tool-summary";
import { cn } from "@/lib/utils";

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolSummary: DisplayToolSummary[];
  pending?: boolean;
}

export function MessageBubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-secondary text-secondary-foreground"
            : "surface-brand text-primary-foreground",
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Sparkles className="size-3.5" />}
      </div>
      <div className={cn("min-w-0 max-w-[80%] space-y-1", isUser && "items-end text-right")}>
        <div
          className={cn(
            "inline-block rounded-2xl px-4 py-2.5 text-left text-sm",
            isUser ? "bg-primary text-primary-foreground" : "border bg-card",
          )}
        >
          {message.pending ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-current" />
            </span>
          ) : isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose-ai">
              <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
            </div>
          )}
        </div>
        {!isUser && !message.pending && <ToolSummaryStrip items={message.toolSummary} />}
      </div>
    </div>
  );
}
