import type { Metadata } from "next";
import { baseMetadata, canonical } from "@/lib/seo";
import HomeGate from "@/components/home/HomeGate";

export const metadata: Metadata = baseMetadata({
  title: "Canisterr - Your Personal Cinema Journal",
  description:
    "Keep the films and series that moved you. Write down what you thought and find people who get it.",
  alternates: {
    canonical: canonical("/"),
  },
  openGraph: {
    type: "website",
    siteName: "Canisterr",
    locale: "en_US",
    url: canonical("/"),
    title: "Canisterr - Your Personal Cinema Journal",
    description:
      "Keep the films and series that moved you. Write down what you thought and find people who get it.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Canisterr - Your Personal Cinema Journal",
    description:
      "Keep the films and series that moved you. Write down what you thought and find people who get it.",
  },
});

export default function HomePage() {
  return <HomeGate />;
}
