import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "The Canisterr Store — Explore Movies in 3D",
  description:
    "Wander a browser-based 3D movie store: genre aisles, curated collections, and a personalized area built from your Canisterr taste, watchlist, and friends.",
};

export default function StoreLayout({ children }: { children: ReactNode }) {
  return children;
}
