import type { Metadata } from "next";
import DashboardPage from "./dashboard/page";
import { baseMetadata, canonical } from "@/lib/seo";

export const metadata: Metadata = baseMetadata({
  title: "Canisterr - Your Cinema Identity",
  description:
    "Canisterr is a social movie platform where you discover films through friends, track your taste, share reviews, and find what to watch next.",
  alternates: {
    canonical: canonical("/"),
  },
  openGraph: {
    type: "website",
    siteName: "Canisterr",
    locale: "en_US",
    url: canonical("/"),
    title: "Canisterr - Your Cinema Identity",
    description:
      "Canisterr is a social movie platform where you discover films through friends, track your taste, share reviews, and find what to watch next.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Canisterr - Your Cinema Identity",
    description:
      "Canisterr is a social movie platform where you discover films through friends, track your taste, share reviews, and find what to watch next.",
  },
});

export default DashboardPage;
