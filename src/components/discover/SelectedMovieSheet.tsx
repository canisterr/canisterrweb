"use client";

import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import type { DiscoveryMovie } from "@/lib/discovery/discoveryTypes";

function formatRuntime(runtime?: number | null) {
  if (!runtime) return null;
  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function SelectedMovieSheet({
  movie,
  mode,
  onClose,
  onKeepLooking,
}: {
  movie: DiscoveryMovie | null;
  mode: "details" | "pick";
  onClose: () => void;
  onKeepLooking: () => void;
}) {
  if (!movie) return null;

  const year = movie.release_date?.slice(0, 4);
  const runtime = formatRuntime(movie.runtime);
  const posterUrl = movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : null;
  const providerNames = movie.providerAvailability?.providerNames || [];

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/62 px-3 pb-3 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[1.7rem] border border-white/10 bg-[#141414] p-4 shadow-[0_24px_100px_rgba(0,0,0,0.55)]">
        <div className="flex items-start gap-4">
          <div className="relative h-32 w-20 shrink-0 overflow-hidden rounded-xl bg-white/8">
            {posterUrl ? <Image src={posterUrl} alt={movie.title} fill sizes="80px" className="object-cover" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                {mode === "pick" ? <p className="text-xs font-black uppercase tracking-[0.22em] text-[#34c759]">This might be the one.</p> : null}
                <h3 className="mt-1 line-clamp-2 text-xl font-black text-[#f5f0de]">{movie.title}</h3>
                <p className="mt-1 text-sm text-white/50">{[year, runtime].filter(Boolean).join(" • ")}</p>
              </div>
              <button type="button" onClick={onClose} className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-white/60">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 line-clamp-4 text-sm leading-6 text-white/62">{movie.overview || "No overview available."}</p>
          </div>
        </div>

        {providerNames.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-white/35">Available on</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {providerNames.slice(0, 5).map((name) => (
                <span key={name} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-[#f5f0de]">
                  {name}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-xs text-white/42">Streaming availability is not verified for this title.</p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link href={`/movie/${movie.id}`} className="rounded-full bg-[#f5f0de] px-4 py-3 text-center text-sm font-black text-[#0a0a0a]">
            Watch this
          </Link>
          <button type="button" onClick={onKeepLooking} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-[#f5f0de]">
            Keep looking
          </button>
        </div>
      </div>
    </div>
  );
}
