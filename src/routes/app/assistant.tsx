import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, MessageSquarePlus, Send, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ApprovalCard } from "@/components/assistant/approval-card";
import { MessageBubble, type DisplayMessage } from "@/components/assistant/message-bubble";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createConversation,
  decideApproval,
  deleteConversation,
  getConversationMessages,
  listApprovals,
  listConversations,
  sendMessage,
} from "@/lib/chat.server";
import { SUGGESTED_QUESTIONS } from "@/lib/agent/types";

export const Route = createFileRoute("/app/assistant")({
  validateSearch: (search: Record<string, unknown>) => ({
    c: typeof search["c"] === "string" ? search["c"] : undefined,
  }),
  component: AssistantPage,
});

function AssistantPage() {
  const { c } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: () => listConversations(),
  });

  const activeId = c ?? conversationsQuery.data?.[0]?.id;

  const messagesQuery = useQuery({
    queryKey: ["messages", activeId],
    queryFn: () => getConversationMessages({ data: { conversationId: activeId! } }),
    enabled: Boolean(activeId),
  });

  const approvalsQuery = useQuery({
    queryKey: ["approvals", activeId],
    queryFn: () => listApprovals({ data: { conversationId: activeId } }),
    enabled: Boolean(activeId),
  });

  const createConversationMutation = useMutation({
    mutationFn: () => createConversation(),
    onSuccess: (conv) => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void navigate({ to: "/app/assistant", search: { c: conv.id } });
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: (id: string) => deleteConversation({ data: { id } }),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (id === activeId) void navigate({ to: "/app/assistant", search: { c: undefined } });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (vars: { conversationId: string; content: string }) => sendMessage({ data: vars }),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["messages", variables.conversationId] });
      setPendingUserMessage(null);
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["approvals", variables.conversationId] });
    },
    onError: (error) => {
      setPendingUserMessage(null);
      toast.error(error instanceof Error ? error.message : "The assistant failed to respond.");
    },
  });

  const decideMutation = useMutation({
    mutationFn: (vars: { id: string; decision: "approved" | "rejected" }) =>
      decideApproval({ data: vars }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["approvals", activeId] });
      void queryClient.invalidateQueries({ queryKey: ["audit-log"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not decide."),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data, pendingUserMessage]);

  async function handleSend(content: string) {
    const trimmed = content.trim();
    if (!trimmed || sendMutation.isPending) return;

    let conversationId = activeId;
    if (!conversationId) {
      const conv = await createConversationMutation.mutateAsync();
      conversationId = conv.id;
    }
    setInput("");
    setPendingUserMessage(trimmed);
    sendMutation.mutate({ conversationId, content: trimmed });
  }

  const displayMessages: DisplayMessage[] = [
    ...(messagesQuery.data ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      toolSummary: m.toolSummary,
    })),
    ...(pendingUserMessage
      ? [
          {
            id: "__pending_user",
            role: "user" as const,
            content: pendingUserMessage,
            toolSummary: [],
          },
          {
            id: "__pending_assistant",
            role: "assistant" as const,
            content: "",
            toolSummary: [],
            pending: true,
          },
        ]
      : []),
  ];

  const pendingApprovals = (approvalsQuery.data ?? []).filter((a) => a.status === "pending");
  const showEmptyState = !activeId || (displayMessages.length === 0 && !messagesQuery.isLoading);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <aside className="hidden w-64 shrink-0 flex-col border-r md:flex">
        <div className="p-3">
          <Button
            className="w-full"
            variant="outline"
            onClick={() => createConversationMutation.mutate()}
            disabled={createConversationMutation.isPending}
          >
            <MessageSquarePlus /> New conversation
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {(conversationsQuery.data ?? []).map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                  conv.id === activeId && "bg-accent",
                )}
              >
                <button
                  className="min-w-0 flex-1 truncate text-left"
                  onClick={() => void navigate({ to: "/app/assistant", search: { c: conv.id } })}
                >
                  {conv.title}
                </button>
                <button
                  className="shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                  onClick={() => deleteConversationMutation.mutate(conv.id)}
                  aria-label="Delete conversation"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {showEmptyState ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
            <div className="surface-brand flex size-14 items-center justify-center rounded-2xl text-primary-foreground">
              <Sparkles className="size-6" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold">Ask about your books</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The assistant reads real transactions, invoices and VAT data to answer.
              </p>
            </div>
            <div className="grid max-w-lg gap-2 sm:grid-cols-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => void handleSend(q)}
                  className="rounded-lg border bg-card px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="mx-auto max-w-3xl space-y-5 p-6">
              {pendingApprovals.map((a) => (
                <ApprovalCard
                  key={a.id}
                  approval={a}
                  deciding={decideMutation.isPending}
                  onDecide={(decision) => decideMutation.mutate({ id: a.id, decision })}
                />
              ))}
              {displayMessages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        )}

        <div className="border-t p-4">
          <form
            className="mx-auto flex max-w-3xl items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend(input);
            }}
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend(input);
                }
              }}
              placeholder="Ask about VAT, expenses, invoices or performance..."
              className="min-h-[44px] resize-none"
              rows={1}
              disabled={sendMutation.isPending}
            />
            <Button type="submit" size="icon" disabled={sendMutation.isPending || !input.trim()}>
              {sendMutation.isPending ? <Loader2 className="animate-spin" /> : <Send />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
