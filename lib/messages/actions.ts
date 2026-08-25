"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getSalonMembership } from "@/lib/auth/session";
import type { Tables } from "@/types/database";

export type ChatMessage = Tables<"messages">;
export type ChatConversation = Tables<"conversations">;

/** Finds (or, on a customer's first message, creates) this user's one
 *  persistent thread with the salon — get_or_create_conversation() also
 *  creates the underlying customers row if this is their first-ever
 *  interaction with the salon (mirrors book_appointment's own
 *  get_or_create_customer call, so asking a question before ever booking
 *  works the same way "Contáctanos" always did). */
export async function getOrCreateConversation(salonId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_or_create_conversation", {
    p_salon_id: salonId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function listMessages(conversationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function sendMessage(salonId: string, conversationId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("El mensaje no puede estar vacío.");
  if (trimmed.length > 2000) throw new Error("El mensaje es muy largo.");

  const user = await getCurrentUser();
  if (!user) throw new Error("Debes iniciar sesión.");

  // Whichever side of the conversation this user actually is, determined
  // server-side rather than trusted from the client — messages_insert's
  // RLS check would reject a mismatched role anyway, this just avoids a
  // round-trip failure for the honest case.
  const membership = await getSalonMembership(salonId);
  const senderRole: "staff" | "customer" = membership ? "staff" : "customer";

  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    salon_id: salonId,
    sender_profile_id: user.id,
    sender_role: senderRole,
    body: trimmed,
  });
  if (error) throw new Error(error.message);
}

export async function markConversationRead(conversationId: string, path?: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_conversation_read", {
    p_conversation_id: conversationId,
  });
  if (error) throw new Error(error.message);
  if (path) revalidatePath(path);
}

/** Staff inbox — every conversation for the salon, most recently active
 *  first. Any active role can see the whole shared inbox, same breadth as
 *  reviews moderation visibility. */
export async function listSalonConversations(salonId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("*, customers(profiles(full_name))")
    .eq("salon_id", salonId)
    .order("last_message_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}
