"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

function AuthLayoutTransition({ children }: { children: ReactNode }) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));

    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      className={`min-h-dvh transition-all duration-500 ease-out ${
        entered ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`}
    >
      {children}
    </div>
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-[#090909] text-[#f5f0de]">
      <AuthLayoutTransition key={pathname}>
        {children}
      </AuthLayoutTransition>
    </div>
  );
}
