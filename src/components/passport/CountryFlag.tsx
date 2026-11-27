import Image from "next/image";

export default function CountryFlag({ code, className = "", position = "relative" }: { code: string | null | undefined; className?: string; position?: "relative" | "absolute" }) {
  const normalized = code?.toUpperCase();
  const positionClass = position === "absolute" ? "absolute" : "relative";
  if (!normalized || !/^[A-Z]{2}$/.test(normalized)) {
    return <span aria-hidden="true" className={`${positionClass} inline-flex shrink-0 items-center justify-center border border-white/15 bg-white/5 text-white/40 ${className}`}>—</span>;
  }
  return (
    <span aria-hidden="true" className={`${positionClass} inline-block shrink-0 overflow-hidden border border-white/15 bg-white/5 ${className}`}>
      <Image src={`https://flagcdn.com/w80/${normalized.toLowerCase()}.png`} alt="" fill sizes="(max-width: 639px) 48px, 80px" className="object-cover" />
    </span>
  );
}
