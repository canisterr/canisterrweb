import type { Metadata } from "next";
import { tvMetadata, tvSchema, breadcrumbSchema, BASE_URL } from "@/lib/seo";
import { resolveTvRouteParam } from "@/lib/content-slugs";
import JsonLd from "@/components/JsonLd";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const resolved = await resolveTvRouteParam(id);
  if (!resolved) return { title: "TV Show | Canisterr" };
  return tvMetadata(resolved.show, resolved.canonicalPath);
}

export default async function TvLayout({ params, children }: Props) {
  const { id } = await params;
  const resolved = await resolveTvRouteParam(id);
  const show = resolved?.show;

  return (
    <>
      {show && (
        <>
          <JsonLd data={tvSchema(show, resolved.canonicalPath)} />
          <JsonLd
            data={breadcrumbSchema([
              { name: "Home", url: BASE_URL },
              { name: "TV Shows", url: `${BASE_URL}/dashboard` },
              { name: show.name, url: `${BASE_URL}${resolved.canonicalPath}` },
            ])}
          />
        </>
      )}
      {children}
    </>
  );
}
