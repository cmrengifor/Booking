"use client";

import { useEffect, useState } from "react";
import { XIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { buttonVariants } from "@/components/ui/button";
import { DrawerClose, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { Tables } from "@/types/database";
import { MessageThread } from "@/components/messages/message-thread";
import { getOrCreateConversation, listMessages, type ChatMessage } from "@/lib/messages/actions";

type Salon = Tables<"salons">;

export function ChatPanel({ salon }: { salon: Salon }) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Debes iniciar sesión para escribirnos.");
        if (cancelled) return;
        setProfileId(user.id);

        const conversation = await getOrCreateConversation(salon.id);
        if (cancelled) return;

        const history = await listMessages(conversation.id);
        if (cancelled) return;
        setMessages(history);
        setConversationId(conversation.id);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "No se pudo cargar la conversación.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [salon.id]);

  return (
    <>
      <DrawerHeader className="flex-row items-center justify-between gap-4">
        <DrawerTitle>{salon.name}</DrawerTitle>
        <DrawerClose className={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
          <XIcon />
          <span className="sr-only">Cerrar</span>
        </DrawerClose>
      </DrawerHeader>

      {loading ? (
        <div className="flex-1 px-6 py-4">
          <p className="font-sans text-sm text-muted-foreground">Cargando conversación…</p>
        </div>
      ) : error || !conversationId || !profileId ? (
        <div className="flex-1 px-6 py-4">
          <p className="font-sans text-sm text-destructive">{error ?? "No se pudo abrir la conversación."}</p>
        </div>
      ) : (
        <MessageThread
          conversationId={conversationId}
          salonId={salon.id}
          timezone={salon.timezone}
          currentProfileId={profileId}
          initialMessages={messages}
          emptyLabel={`Escríbenos por aquí — el equipo de ${salon.name} te responde en cuanto pueda.`}
        />
      )}
    </>
  );
}
