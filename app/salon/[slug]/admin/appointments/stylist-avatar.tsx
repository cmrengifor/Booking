import Image from "next/image";

export function StylistAvatar({ name, url, size = 24 }: { name: string; url: string | null; size?: number }) {
  if (url) {
    return (
      <span
        className="relative inline-block shrink-0 overflow-hidden rounded-full bg-muted"
        style={{ width: size, height: size }}
      >
        <Image src={url} alt="" fill sizes={`${size}px`} className="object-cover" />
      </span>
    );
  }

  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-gold/15 font-heading text-gold italic"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {initial}
    </span>
  );
}
