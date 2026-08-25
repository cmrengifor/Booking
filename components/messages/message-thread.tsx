"use client";

import { useEffect, useRef, useState } from "react";
import { DateTime } from "luxon";
import { SendHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { sendMessage, markConversationRead, type ChatMessage } from "@/lib/messages/actions";

/**
 * The message list + composer, shared between the customer chat drawer
 * (chat-panel.tsx) and the staff admin inbox — same realtime-subscribe,
 * render, and send logic either side of the conversation. Callers own
 * fetching the initial conversation/messages (a customer's flow bootstraps
 * one via getOrCreateConversation; staff already has a conversationId from
 * their inbox list) and pass them in already loaded.
 */
export function MessageThread({
  conversationId,
  salonId,
  timezone,
  currentProfileId,
  initialMessages,
  emptyLabel,
}: {
  conversationId: string;
  salonId: string;
  timezone: string;
  currentProfileId: string;
  initialMessages: ChatMessage[];
  emptyLabel: string;
}) {
  // Lazy initializer only — neither caller changes conversationId on an
  // already-mounted instance (chat-panel.tsx doesn't render this until its
  // own fetch settles; the admin inbox remounts it via `key` per selected
  // conversation), so there's no later prop change to sync from.
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    markConversationRead(conversationId).catch(() => {});
  }, [conversationId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const message = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
          if (message.sender_profile_id !== currentProfileId) {
            markConversationRead(conversationId).catch(() => {});
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentProfileId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);
    try {
      await sendMessage(salonId, conversationId, trimmed);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <p className="font-sans text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m) => {
              const mine = m.sender_profile_id === currentProfileId;
              return (
                <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2 font-sans text-sm",
                      mine ? "bg-gold/15 text-foreground" : "border border-border bg-background text-foreground"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className="mt-1 font-mono text-[0.65rem] text-muted-foreground">
                      {DateTime.fromISO(m.created_at).setZone(timezone).setLocale("es").toFormat("d LLL, HH:mm")}
                    </p>
                  </div>
                </li>
              );
            })}
            <div ref={bottomRef} />
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border px-6 py-4">
        {error && <p className="font-sans text-xs text-destructive">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Escribe tu mensaje…"
            rows={1}
            disabled={sending}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 font-sans text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            aria-label="Enviar"
            className={buttonVariants({ size: "icon", className: "shrink-0" })}
          >
            <SendHorizontal className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
