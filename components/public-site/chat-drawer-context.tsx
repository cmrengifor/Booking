"use client";

import { createContext, useContext } from "react";

type ChatDrawerContextValue = {
  openChat: () => void;
};

export const ChatDrawerContext = createContext<ChatDrawerContextValue | null>(null);

export function useChatDrawer() {
  const ctx = useContext(ChatDrawerContext);
  if (!ctx) {
    throw new Error("useChatDrawer must be used within the salon layout's <GlobalChatDrawer>.");
  }
  return ctx;
}
