import Link from "next/link";
import PageLayout from "@/components/PageLayout";

export type LegalSection = {
  title: string;
  body?: string[];
  items?: string[];
};

export default function LegalDocument({
  current,
  title,
  intro,
  effectiveDate,
  version,
  sections,
}: {
  current: "privacy" | "terms";
  title: string;
  intro: string;
  effectiveDate: string;
  version: string;
  sections: LegalSection[];
}) {
  const linkClass = (active: boolean) =>
    `border-b-2 px-1 pb-2 text-sm font-semibold transition ${active ? "border-[#ff7a1a] text-[#f5f0de]" : "border-transparent text-white/45 hover:text-white/80"}`;

  return (
    <PageLayout user={null}>
      <main className="min-h-[calc(100dvh-4rem)] px-1 pb-16 pt-7 text-[#f5f0de] sm:px-3 sm:pt-10">
        <div className="mx-auto max-w-5xl">
          <nav aria-label="Legal documents" className="flex gap-6 border-b border-white/10">
            <Link href="/privacy" aria-current={current === "privacy" ? "page" : undefined} className={linkClass(current === "privacy")}>Privacy</Link>
            <Link href="/terms" aria-current={current === "terms" ? "page" : undefined} className={linkClass(current === "terms")}>Terms &amp; Conditions</Link>
          </nav>

          <header className="border-b border-white/10 py-9 sm:py-12">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff9b52]">Canisterr · {current === "privacy" ? "Privacy" : "Terms"}</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-black leading-[1.02] tracking-tight sm:text-6xl">{title}</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-white/60 sm:text-lg">{intro}</p>
            <p className="mt-5 text-xs font-medium text-white/35">Effective {effectiveDate} <span aria-hidden="true">·</span> Version {version}</p>
          </header>

          <article>
            {sections.map((section, index) => (
              <section key={section.title} id={`section-${index + 1}`} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 border-b border-white/10 py-7 sm:grid-cols-[3.25rem_minmax(0,1fr)] sm:gap-5 sm:py-9">
                <span aria-hidden="true" className="pt-1 text-xs font-bold tabular-nums text-[#ff9b52]">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{section.title.replace(/^\d+\.\s*/, "")}</h2>
                  {section.body ? (
                    <div className="mt-4 space-y-4 text-sm leading-7 text-white/65 sm:text-base sm:leading-8">
                      {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                    </div>
                  ) : null}
                  {section.items ? (
                    <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-white/65 marker:text-[#ff9b52] sm:text-base sm:leading-8">
                      {section.items.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  ) : null}
                </div>
              </section>
            ))}
          </article>

          <footer className="flex flex-col gap-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl leading-6 text-white/50">
              Questions about this document? Email <a href="mailto:support@canisterr.com" className="font-semibold text-[#ffb36b] underline underline-offset-4">support@canisterr.com</a>.
            </p>
            <Link href={current === "privacy" ? "/terms" : "/privacy"} className="shrink-0 font-semibold text-[#ffb36b] underline underline-offset-4">
              Read the {current === "privacy" ? "Terms and Conditions" : "Privacy Policy"}
            </Link>
          </footer>
        </div>
      </main>
    </PageLayout>
  );
}
