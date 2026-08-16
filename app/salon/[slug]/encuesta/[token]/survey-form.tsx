"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitSurvey } from "./actions";

export function SurveyForm({ token }: { token: string }) {
  const [score, setScore] = useState<number | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (score === null) {
      setError("Elige un puntaje entre 0 y 10.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const formData = new FormData();
    formData.set("score", String(score));
    if (rating > 0) formData.set("rating", String(rating));
    if (comment.trim()) formData.set("comment", comment.trim());

    const result = await submitSurvey(token, formData);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="font-heading text-xl text-foreground">¡Gracias por tu tiempo!</h2>
        <p className="max-w-md font-sans text-sm text-muted-foreground">
          Tu opinión nos ayuda a mejorar. Esperamos verte pronto de nuevo.
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="font-sans text-sm text-foreground">
          Del 0 al 10, ¿qué tan probable es que nos recomiendes a un amigo o familiar?
        </p>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 11 }, (_, i) => i).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setScore(n)}
              className={`flex size-9 items-center justify-center rounded-md border font-sans text-sm transition-colors ${
                score === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-foreground hover:bg-muted"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between font-sans text-xs text-muted-foreground">
          <span>Nada probable</span>
          <span>Muy probable</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="font-sans text-sm text-foreground">¿Cómo calificarías tu experiencia? (opcional)</p>
        <div className="flex gap-1">
          {Array.from({ length: 5 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(rating === n ? 0 : n)}
              aria-label={`${n} estrellas`}
            >
              <Star
                className={`size-7 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="comment" className="font-sans text-sm text-foreground">
          Cuéntanos más (opcional)
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && <p className="font-sans text-sm text-destructive">{error}</p>}

      <Button onClick={handleSubmit} disabled={submitting}>
        {submitting ? "Enviando…" : "Enviar respuesta"}
      </Button>
    </div>
  );
}
