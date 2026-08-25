"use client";

import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { cn } from "@/lib/utils";
import { MessageThread } from "@/components/messages/message-thread";
import { listMessages, type ChatConversation, type ChatMessage } from "@/lib/messages/actions";

type ConversationWithCustomer = ChatConversation & {
  customers: { profiles: { full_name: string | null } | null } | null;
};

export function MessagesClient({
  salonId,
  timezone,
  currentProfileId,
  conversations,
}: {
  salonId: string;
  timezone: string;
  currentProfileId: string;
  conversations: ConversationWithCustomer[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.id ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(!!conversations[0]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-deps-change loading flag, not a render loop
    setLoading(true);
    listMessages(selectedId)
      .then((m) => {
        if (!cancelled) setMessages(m);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selected = conversations.find((c) => c.id === selectedId);

  return (
    <div className="flex h-[75vh] min-h-[500px] overflow-hidden rounded-md border border-border">
      <div className="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-border">
        <ul className="flex flex-1 flex-col">
          {conversations.map((c) => {
            const unread = !c.staff_last_read_at || c.last_message_at > c.staff_last_read_at;
            const isSelected = selectedId === c.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 border-b border-border px-4 py-3 text-left transition-colors",
                    isSelected ? "bg-muted" : "hover:bg-muted/50"
                  )}
                >
                  <span
                    className={cn(
                      "font-sans text-sm text-foreground",
                      unread && !isSelected && "font-semibold"
                    )}
                  >
                    {c.customers?.profiles?.full_name || "Cliente"}
                    {unread && <span className="ml-2 inline-block size-1.5 rounded-full bg-gold align-middle" />}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {DateTime.fromISO(c.last_message_at).setZone(timezone).setLocale("es").toFormat("d LLL, HH:mm")}
                  </span>
                </button>
              </li>
            );
          })}
          {!conversations.length && (
            <p className="p-4 font-sans text-sm text-muted-foreground">Sin conversaciones todavía.</p>
          )}
        </ul>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {selected ? (
          loading ? (
            <p className="p-4 font-sans text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <MessageThread
              key={selected.id}
              conversationId={selected.id}
              salonId={salonId}
              timezone={timezone}
              currentProfileId={currentProfileId}
              initialMessages={messages}
              emptyLabel={`Sin mensajes todavía con ${selected.customers?.profiles?.full_name || "esta clienta"}.`}
            />
          )
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="font-sans text-sm text-muted-foreground">Elige una conversación.</p>
          </div>
        )}
      </div>
    </div>
  );
}
