"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import RouteLoadingSkeleton from "@/components/RouteLoadingSkeleton";
import type { ReactNode } from "react";
import type { User } from "@/types";

export default function SettingsPageFrame({
  user,
  loading,
  onSignOut,
  title,
  description,
  children,
  backHref = "/profile/settings",
}: {
  user: User | null;
  loading: boolean;
  onSignOut: () => void | Promise<void>;
  title: string;
  description?: string;
  children?: ReactNode;
  backHref?: string;
}) {
  if (loading || !user) {
    return <RouteLoadingSkeleton title={title} description={`Loading ${title.toLowerCase()}`} />;
  }

  return (
    <PageLayout user={user} onSignOut={onSignOut}>
      <div className="mx-auto max-w-2xl px-4 py-6 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-10">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 rounded-full px-1 text-sm font-semibold text-white/55 transition hover:text-[#f5f0de]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="mt-5">
          <div className="min-w-0">
            <h1 className="text-3xl font-black tracking-tight text-[#f5f0de] sm:text-[2.65rem]">{title}</h1>
            {description ? <p className="mt-2 max-w-xl text-sm text-white/52">{description}</p> : null}
          </div>
        </div>

        <div className="mt-6">{children}</div>
      </div>
    </PageLayout>
  );
}
