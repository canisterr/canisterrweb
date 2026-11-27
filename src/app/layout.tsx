import type { Metadata, Viewport } from "next";
import "./globals.css";
import HydrationFix from "@/components/HydrationFix";
import { CurrentUserProvider } from "@/components/CurrentUserProvider";
import DeferredPushEnhancements from "@/components/DeferredPushEnhancements";
import GlobalErrorListener from "@/components/GlobalErrorListener";
import LocalhostServiceWorkerCleanup from "@/components/LocalhostServiceWorkerCleanup";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";
import MobileInstallPrompt from "@/components/MobileInstallPrompt";
import PwaBottomNav from "@/components/PwaBottomNav";
import JsonLd from "@/components/JsonLd";
import AnalyticsConsent from "@/components/AnalyticsConsent";
import { baseMetadata, organizationSchema, websiteSchema } from "@/lib/seo";

export const metadata: Metadata = baseMetadata({
  title: {
    default: "Canisterr - Your Cinema Identity",
    template: "%s | Canisterr",
  },
  description:
    "Canisterr is a social movie platform where you discover films through friends, track your taste, share reviews, and find what to watch next.",
  applicationName: "Canisterr",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Canisterr",
    statusBarStyle: "black",
  },
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#090909",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased" suppressHydrationWarning>
        <AnalyticsConsent />
        <JsonLd data={websiteSchema()} />
        <JsonLd data={organizationSchema()} />
        <LocalhostServiceWorkerCleanup />
        <RegisterServiceWorker />
        <CurrentUserProvider>
          <HydrationFix>{children}</HydrationFix>
        </CurrentUserProvider>
        <DeferredPushEnhancements />
        <GlobalErrorListener />
        <MobileInstallPrompt />
        <PwaBottomNav />
      </body>
    </html>
  );
}
