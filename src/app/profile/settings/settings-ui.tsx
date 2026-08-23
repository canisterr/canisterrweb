"use client";

import type { LucideIcon } from "lucide-react";
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
        <p className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.22em] text-white/34">{title}</p>
      ) : null}
      <div className="overflow-hidden rounded-[1.6rem] border border-white/8 bg-[#151515] shadow-[0_20px_70px_rgba(0,0,0,0.24)]">
        {children}
      </div>
    </section>
  );
}

export function SettingLine({
  icon: Icon,
  title,
  description,
  children,
  danger = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-white/7 px-4 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[0.95rem] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] ${
            danger ? "bg-[#ff3b30]" : "bg-[#0a84ff]"
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className={`text-[15px] font-semibold ${danger ? "text-[#ffd5d2]" : "text-[#f5f0de]"}`}>{title}</p>
          <p className="text-xs leading-snug text-white/45">{description}</p>
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{children}</div>}
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
      className={`inline-flex min-w-[72px] items-center justify-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        checked ? "border-[#34c759] bg-[#34c759] text-[#08120b]" : "border-white/10 bg-white/[0.04] text-[#f5f0de]"
      }`}
    >
      {label}
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
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition ${
        active ? "border-[#0a84ff] bg-[#0a84ff] text-white" : "border-white/10 bg-white/[0.04] text-[#f5f0de]"
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
      ? "border-[#34c759]/20 bg-[#34c759]/10 text-[#d8ffe3]"
      : tone === "error"
        ? "border-[#ff453a]/20 bg-[#ff453a]/10 text-[#ffd9d6]"
        : "border-[#0a84ff]/20 bg-[#0a84ff]/10 text-[#d8ebff]";

  return <div className={`rounded-[1.35rem] border px-4 py-3 text-xs ${toneClass}`}>{children}</div>;
}
