"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function applyForJob(salonId: string, formData: FormData) {
  if (!(await checkRateLimit("careers", 3, 3600))) {
    return { error: "Demasiadas aplicaciones — intenta de nuevo más tarde." };
  }

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const resume = formData.get("resume");

  if (!fullName || !email || !email.includes("@")) {
    return { error: "Nombre y correo son obligatorios." };
  }
  if (!(resume instanceof File) || resume.size === 0) {
    return { error: "Adjunta tu CV." };
  }
  if (resume.size > MAX_RESUME_BYTES) {
    return { error: "El archivo supera los 5MB." };
  }
  if (!ALLOWED_TYPES.has(resume.type)) {
    return { error: "Formato no soportado — usa PDF o Word." };
  }

  const supabase = createAdminClient();
  const path = `${salonId}/${Date.now()}-${resume.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { error: uploadError } = await supabase.storage
    .from("job-applications")
    .upload(path, resume, { contentType: resume.type });
  if (uploadError) return { error: "No se pudo subir el archivo." };

  const { error: insertError } = await supabase.from("job_applications").insert({
    salon_id: salonId,
    full_name: fullName,
    email,
    phone: phone || null,
    message: message || null,
    resume_path: path,
  });
  if (insertError) return { error: "No se pudo enviar la aplicación." };

  return { error: null };
}
