"use client";

import { ReactNode, useState } from "react";

type SpoilerTextProps = {
  spoiler?: boolean | null;
  className?: string;
  buttonClassName?: string;
  children: ReactNode;
};

export default function SpoilerText({
  spoiler,
  className = "",
  buttonClassName = "",
  children,
}: SpoilerTextProps) {
  const [revealed, setRevealed] = useState(false);

  if (spoiler && !revealed) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setRevealed(true);
        }}
        className={`flex w-full flex-col items-start border border-white/12 bg-white/[0.03] px-4 py-3 text-left transition hover:border-[#ff7a1a]/55 ${buttonClassName}`}
      >
        <span className="text-xs font-black uppercase tracking-[0.18em] text-[#ff7a1a]">Contains spoiler</span>
        <span className="mt-1 text-xs text-white/55">Click to see</span>
      </button>
    );
  }

  return <div className={className}>{children}</div>;
}
