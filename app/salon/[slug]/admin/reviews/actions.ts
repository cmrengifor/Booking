"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function moderateReview(
  reviewId: string,
  status: "published" | "rejected",
  slug: string
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_review", {
    p_review_id: reviewId,
    p_status: status,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/salon/${slug}/admin/reviews`);
}
