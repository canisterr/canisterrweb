import type { Metadata } from "next";
import AuthActionClient from "./AuthActionClient";

export const metadata: Metadata = {
  title: "Secure account action | Canisterr",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function AuthActionPage() {
  return <AuthActionClient />;
}
