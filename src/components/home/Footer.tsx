import Image from "@/components/AppImage";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 px-6 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black">
            <Image
              src="/logo-ui.webp"
              alt="Canisterr logo"
              width={44}
              height={44}
              className="h-9 w-9 rounded-xl bg-black object-contain"
            />
          </div>
          <div>
            <p className="brand-wordmark text-xl tracking-[0.04em] text-[#fff5e8]">Canisterr</p>
          <p className="mt-1 text-sm text-white/48">Your cinema identity, kept simple.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-5 text-sm text-white/62 sm:justify-end">
          <Link href="/privacy" className="transition hover:text-[#ffb073]">
            Privacy Policy
          </Link>
          <Link href="/terms" className="transition hover:text-[#ffb073]">
            Terms and Conditions
          </Link>
        </div>
      </div>
    </footer>
  );
}
