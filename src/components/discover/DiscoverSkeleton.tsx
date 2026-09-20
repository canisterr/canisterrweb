export default function DiscoverSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-8 sm:px-6">
      <div className="animate-pulse">
        <div className="h-4 w-24 rounded-full bg-white/[0.07]" />
        <div className="mt-5 h-12 max-w-xl rounded-2xl bg-white/[0.07]" />
        <div className="mt-3 h-5 w-72 max-w-full rounded-full bg-white/[0.05]" />
        <div className="mt-10 min-h-[28rem] rounded-[2rem] border border-white/[0.07] bg-gradient-to-b from-white/[0.07] to-white/[0.025]" />
        <p className="mt-5 text-center text-sm font-semibold text-white/35">Reading the room and your diary…</p>
      </div>
    </div>
  );
}
