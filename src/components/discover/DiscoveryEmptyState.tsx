"use client";

export default function DiscoveryEmptyState({
  onLoosenFilters,
  onChangeMood,
  onChangeProviders,
}: {
  onLoosenFilters: () => void;
  onChangeMood: () => void;
  onChangeProviders: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-2xl font-black text-[#f5f0de]">Nothing perfect yet.</p>
      <p className="mt-3 text-sm leading-6 text-white/52">Want me to loosen the filters and bring back more possibilities?</p>
      <div className="mt-6 grid w-full gap-2">
        <button type="button" onClick={onLoosenFilters} className="rounded-full bg-[#f5f0de] px-4 py-3 text-sm font-black text-[#0a0a0a]">
          Show more options
        </button>
        <button type="button" onClick={onChangeMood} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-[#f5f0de]">
          Change mood
        </button>
        <button type="button" onClick={onChangeProviders} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-[#f5f0de]">
          Change streaming services
        </button>
      </div>
    </div>
  );
}
