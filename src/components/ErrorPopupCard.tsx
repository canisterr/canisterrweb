"use client";

import Link from "next/link";
import { X } from "lucide-react";

type ErrorPopupCardProps = {
  title: string;
  message: string;
  code?: string | number | null;
  onRetry?: () => void;
  onClose?: () => void;
  retryLabel?: string;
  homeHref?: string;
};

export default function ErrorPopupCard({
  title,
  message,
  code,
  onRetry,
  onClose,
  retryLabel = "Try again",
  homeHref = "/dashboard",
}: ErrorPopupCardProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4">
      <div role="alertdialog" aria-label={`${title}: ${message}`} className="w-full max-w-64 rounded-xl border border-white/15 bg-[#171717] p-4 text-[#f5f0de] shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Error <span className="font-mono text-[#ff9b52]">{code ?? 500}</span></p>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-white/55 transition hover:bg-white/10 hover:text-[#f5f0de]"
              aria-label="Close error popup"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-4 flex items-center gap-4 border-t border-white/10 pt-3 text-xs font-semibold">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-[#ff9b52] transition hover:text-[#ffb36b]"
            >
              {retryLabel}
            </button>
          )}
          <Link
            href={homeHref}
            className="text-white/60 transition hover:text-[#f5f0de]"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
