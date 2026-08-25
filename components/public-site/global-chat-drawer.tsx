"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import type { Tables } from "@/types/database";
import { ChatDrawerContext } from "./chat-drawer-context";
import { ChatPanel } from "./chat-panel";

type Salon = Tables<"salons">;

/**
 * The chat drawer, mounted once in the salon layout — "Mensajes" in the
 * profile dropdown opens it via useChatDrawer(), no navigation involved.
 * Unlike the booking drawer, there's only one entry point today, so this
 * uses a plain context callback instead of Drawer.createHandle()'s
 * detached-trigger mechanism — that's for when many scattered buttons
 * need to reach the same drawer, not needed here yet.
 */
export function GlobalChatDrawer({ salon, children }: { salon: Salon; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openChat = useCallback(() => setOpen(true), []);

  return (
    <ChatDrawerContext.Provider value={{ openChat }}>
      {children}
      <Drawer open={open} onOpenChange={setOpen} swipeDirection="down" showSwipeHandle>
        <DrawerContent>
          <ChatPanel salon={salon} />
        </DrawerContent>
      </Drawer>
    </ChatDrawerContext.Provider>
  );
}
