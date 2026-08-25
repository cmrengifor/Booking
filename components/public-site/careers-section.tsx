"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import FileUpload from "@/components/kokonutui/file-upload";
import type { Salon } from "@/lib/tenant/resolve-salon";
import { applyForJob } from "@/app/salon/[slug]/careers-actions";

const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const RESUME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function formatBytes(bytes: number) {
  if (!bytes) return "0 Bytes";
  const units = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

export function CareersSection({ salon }: { salon: Salon }) {
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (status === "done") {
    return (
      <div>
        <h3 className="font-sans text-sm font-medium text-foreground">Trabaja con nosotros</h3>
        <p className="mt-2 font-sans text-sm text-gold">
          Listo — recibimos tu aplicación.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-sans text-sm font-medium text-foreground">Trabaja con nosotros</h3>
      <form
        ref={formRef}
        action={(formData) => {
          if (!resumeFile) {
            setErrorMsg("Adjunta tu CV.");
            setStatus("error");
            return;
          }
          // FileUpload manages the resume outside the native file input, so
          // it never lands in the auto-collected FormData on its own — set
          // it here from component state before handing off to the real
          // upload action.
          formData.set("resume", resumeFile);
          startTransition(async () => {
            const result = await applyForJob(salon.id, formData);
            if (result.error) {
              setErrorMsg(result.error);
              setStatus("error");
            } else {
              setStatus("done");
            }
          });
        }}
        className="mt-3 flex max-w-sm flex-col gap-2"
      >
        <input
          name="full_name"
          required
          placeholder="Nombre completo"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          name="email"
          type="email"
          required
          placeholder="tu@correo.com"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {resumeFile ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
            <div className="min-w-0">
              <p className="truncate font-sans text-xs text-foreground">{resumeFile.name}</p>
              <p className="font-sans text-[0.7rem] text-muted-foreground">{formatBytes(resumeFile.size)}</p>
            </div>
            <button
              type="button"
              onClick={() => setResumeFile(null)}
              aria-label="Quitar archivo"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        ) : (
          <FileUpload
            className="max-w-none"
            acceptedFileTypes={RESUME_TYPES}
            acceptedFileTypesLabel="PDF o Word"
            maxFileSize={MAX_RESUME_BYTES}
            uploadDelay={400}
            onUploadSuccess={(file) => {
              setResumeFile(file);
              setErrorMsg(null);
              if (status === "error") setStatus("idle");
            }}
            onUploadError={(err) => {
              setErrorMsg(err.message);
              setStatus("error");
            }}
          />
        )}
        <Button type="submit" disabled={pending} size="sm">
          {pending ? "Enviando…" : "Aplicar"}
        </Button>
        <p className="font-sans text-[0.7rem] text-muted-foreground">
          Tus datos se usan solo para evaluar tu aplicación.{" "}
          <Link href={`/salon/${salon.slug}/privacidad`} className="underline hover:text-foreground">
            Manejo de datos
          </Link>
          .
        </p>
        {status === "error" && errorMsg && (
          <p className="font-sans text-xs text-destructive">{errorMsg}</p>
        )}
      </form>
    </div>
  );
}
