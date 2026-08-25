import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { getCurrentUser } from "@/lib/auth/session";
import { listSalonConversations } from "@/lib/messages/actions";
import { MessagesClient } from "./messages-client";

export default async function AdminMessagesPage({
  params,
}: PageProps<"/salon/[slug]/admin/messages">) {
  const { slug } = await params;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) return null;

  const user = await getCurrentUser();
  if (!user) return null;

  const conversations = await listSalonConversations(salon.id);

  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">Panel del salón</p>
        <h1 className="mt-2 font-heading text-3xl text-foreground">Mensajes</h1>
      </div>
      <MessagesClient
        salonId={salon.id}
        timezone={salon.timezone}
        currentProfileId={user.id}
        conversations={conversations}
      />
    </div>
  );
}
