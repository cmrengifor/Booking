import { Reveal } from "./reveal";
import type { Tables } from "@/types/database";

type Faq = Tables<"faqs">;

export function FaqSection({ faqs }: { faqs: Faq[] }) {
  return (
    <section className="px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-10 font-heading text-4xl italic text-foreground">Preguntas frecuentes</h2>
        <div className="flex flex-col">
          {faqs.map((faq) => (
            <Reveal key={faq.id}>
              <details className="group border-b border-border py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between font-sans text-base text-foreground">
                  {faq.question}
                  <span className="ml-4 font-mono text-gold transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-lg font-sans text-sm text-muted-foreground">
                  {faq.answer}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
