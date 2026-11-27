"use client";

import type { ReactNode } from "react";

export function SettingsGroup({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section>
      {title ? (
        <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ff9b52]">{title}</p>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#111111]">
        {children}
      </div>
    </section>
  );
}

export function SettingLine({
  title,
  description,
  children,
  danger = false,
  stacked = false,
}: {
  title: string;
  description: string;
  icon?: unknown;
  children?: ReactNode;
  danger?: boolean;
  stacked?: boolean;
}) {
  return (
    <div className={`border-b border-white/10 px-4 py-3 last:border-b-0 sm:px-5 ${stacked ? "" : "flex items-center justify-between gap-3"}`}>
      <div className="min-w-0">
        <p className={`text-sm font-semibold leading-5 ${danger ? "text-red-300" : "text-[#f5f0de]"}`}>{title}</p>
        <p className="text-[11px] leading-snug text-white/40">{description}</p>
      </div>
      {children && <div className={stacked ? "mt-4" : "flex shrink-0 items-center justify-end"}>{children}</div>}
    </div>
  );
}

export function CompactToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition ${checked ? "border-[#ff7a1a] bg-[#ff7a1a]" : "border-white/25 bg-[#292929]"}`}
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className={`h-4 w-4 rounded-full bg-[#f5f0de] shadow-sm transition-transform ${checked ? "translate-x-[23px]" : "translate-x-1"}`} />
    </button>
  );
}

export function SmallPillButton({
  children,
  active = false,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-xs font-semibold capitalize transition ${
        active ? "border-[#ff7a1a] bg-[#ff7a1a] text-black" : "border-white/15 bg-transparent text-white/70 hover:border-white/35"
      }`}
    >
      {children}
    </button>
  );
}

export function SettingsMessage({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "error";
  children: ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "border-[#ff7a1a]/20 bg-[#ff7a1a]/10 text-[#f5f0de]"
      : tone === "error"
        ? "border-red-500/20 bg-red-500/10 text-red-200"
        : "border-white/10 bg-[#111] text-white/70";

  return <div className={`rounded-lg border px-4 py-3 text-xs ${toneClass}`}>{children}</div>;
}
