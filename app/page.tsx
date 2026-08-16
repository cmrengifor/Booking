export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
        Phase 0 — Foundation
      </p>
      <h1 className="font-heading text-5xl font-medium tracking-tight text-foreground italic">
        Beauty Salon SaaS
      </h1>
      <p className="max-w-md font-sans text-sm text-muted-foreground">
        Multi-tenant booking platform for premium beauty salons. Design
        tokens (Fraunces + Inter, black / white / gold) are wired — real
        pages start in Phase 2.
      </p>
      <div className="mt-4 h-px w-16 bg-gold" />
    </div>
  );
}
