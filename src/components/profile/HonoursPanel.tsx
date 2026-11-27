"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pin } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { HONOUR_DEFINITIONS, HONOUR_TIERS, type HonourProgress } from "@/lib/honours-engine";

type StoredHonour = HonourProgress & { unlockedAt?: string | null; rarity?: number };
type StoredData = { achievements?: Record<string, StoredHonour>; pins?: string[]; rarity?: Record<string, number> };
type Filter = "All" | "Universal" | "Movies" | "Television" | "Community" | "Unlocked" | "In progress" | "Locked";

const FILTERS: Filter[] = ["All", "Universal", "Movies", "Television", "Community", "Unlocked", "In progress", "Locked"];

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

function Insignia({ unlocked, color }: { unlocked: boolean; color: string }) {
  return <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center border ${unlocked ? "border-white/25" : "border-white/10"}`} style={{ color: unlocked ? color : "#777" }} aria-hidden="true">
    <span className="h-5 w-5 rotate-45 border-2" style={{ borderColor: unlocked ? color : "#666" }} />
    <span className="absolute h-1.5 w-1.5 rounded-full" style={{ backgroundColor: unlocked ? color : "#666" }} />
  </span>;
}

export default function HonoursPanel({ userId, isOwnProfile }: { userId: string; isOwnProfile: boolean }) {
  const [data, setData] = useState<StoredData | null>(null);
  const [filter, setFilter] = useState<Filter>("All");
  const [loading, setLoading] = useState(true);
  const [savingPins, setSavingPins] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) { setLoading(false); setError("Sign in to view Honours."); return; }
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const response = isOwnProfile
        ? await fetch("/api/honours", { method: "POST", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
        : await fetch(`/api/honours?userId=${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error([body.error || "Could not load Honours.", body.detail].filter(Boolean).join(" "));
      setData(body.honours || {});
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load Honours.");
    } finally {
      setLoading(false);
    }
  }, [isOwnProfile, userId]);

  useEffect(() => onAuthStateChanged(auth, () => { void load(); }), [load]);

  const achievements = useMemo(() => HONOUR_DEFINITIONS.map((definition) => {
    const saved = data?.achievements?.[definition.id];
    const tier = HONOUR_TIERS[definition.tier];
    return {
      ...definition,
      tierName: saved?.tierName || tier.name,
      tierColor: saved?.tierColor || tier.color,
      current: saved?.current || 0,
      progress: saved?.progress || 0,
      eligible: Boolean(saved?.eligible),
      eligibilityDate: saved?.eligibilityDate || "",
      unlocked: Boolean(saved?.unlocked),
      unlockedAt: saved?.unlockedAt || null,
      rarity: data?.rarity?.[definition.id] || 0,
    };
  }), [data]);
  const unlockedCount = achievements.filter((item) => item.unlocked).length;
  const closest = achievements.filter((item) => !item.unlocked).slice().sort((a, b) => b.progress - a.progress || a.id.localeCompare(b.id)).slice(0, 3);
  const pinned = (data?.pins || []).map((id) => achievements.find((item) => item.id === id)).filter((item): item is (typeof achievements)[number] => Boolean(item?.unlocked));
  const filtered = achievements.filter((item) => {
    if (filter === "All") return true;
    if (filter === "Unlocked") return item.unlocked;
    if (filter === "In progress") return !item.unlocked && item.eligible && item.progress > 0;
    if (filter === "Locked") return !item.unlocked && (!item.eligible || item.progress === 0);
    return item.category === filter;
  });

  const togglePin = async (achievementId: string) => {
    if (!data || savingPins) return;
    const currentlyPinned = data.pins || [];
    const nextPins = currentlyPinned.includes(achievementId)
      ? currentlyPinned.filter((id) => id !== achievementId)
      : [...currentlyPinned, achievementId];
    if (nextPins.length > 3) return;
    const user = auth.currentUser;
    if (!user) return;
    setSavingPins(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/honours", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ pins: nextPins }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not update pinned Honours.");
      setData((current) => ({ ...(current || {}), pins: body.pins }));
    } catch (pinError) {
      setError(pinError instanceof Error ? pinError.message : "Could not update pinned Honours.");
    } finally {
      setSavingPins(false);
    }
  };

  return <section className="space-y-6" aria-labelledby="profile-honours-heading">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 id="profile-honours-heading" className="text-xl font-black text-[#f5f0de] sm:text-2xl">Canisterr Honours</h2>
        <p className="mt-1 text-sm text-white/50">Films, television, and community milestones.</p>
      </div>
      <div className="min-w-44">
        <div className="flex items-baseline justify-between text-xs text-white/55"><span>Total progress</span><span className="font-bold text-[#f5f0de]">{unlockedCount} / 50</span></div>
        <div className="mt-2 h-1.5 bg-white/10"><div className="h-full bg-[#BF9974]" style={{ width: `${unlockedCount * 2}%` }} /></div>
      </div>
    </header>

    {error && <p role="alert" className="border border-rose-300/20 bg-rose-300/5 p-3 text-sm text-rose-200">{error}</p>}
    {loading && <p className="text-xs text-white/40">Updating your progress…</p>}
      {pinned.length > 0 && <section className="space-y-3" aria-labelledby="pinned-honours-heading">
        <h3 id="pinned-honours-heading" className="text-sm font-bold uppercase tracking-[0.16em] text-white/55">Pinned honours</h3>
        <div className="grid gap-3 sm:grid-cols-3">{pinned.map((item) => <HonourCard key={item.id} item={item} isOwnProfile={isOwnProfile} isPinned onTogglePin={() => void togglePin(item.id)} rarity={item.rarity} />)}</div>
      </section>}

      <section className="space-y-3" aria-labelledby="closest-honours-heading">
        <h3 id="closest-honours-heading" className="text-sm font-bold uppercase tracking-[0.16em] text-white/55">Closest to completion</h3>
        <div className="grid gap-3 sm:grid-cols-3">{closest.map((item) => <HonourCard key={item.id} item={item} isOwnProfile={false} rarity={item.rarity} />)}</div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filter honours">
        {FILTERS.map((item) => <button key={item} aria-pressed={filter === item} type="button" onClick={() => setFilter(item)} className={`shrink-0 border px-3 py-2 text-xs font-semibold transition ${filter === item ? "border-[#BF9974]/60 bg-[#BF9974]/15 text-[#f5f0de]" : "border-white/10 text-white/55 hover:text-white"}`}>{item}</button>)}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((item) => <HonourCard key={item.id} item={item} isOwnProfile={isOwnProfile} isPinned={(data?.pins || []).includes(item.id)} onTogglePin={() => void togglePin(item.id)} rarity={item.rarity} />)}
      </div>
  </section>;
}

function HonourCard({ item, isOwnProfile, isPinned, onTogglePin, rarity }: {
  item: HonourProgress;
  isOwnProfile: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  rarity: number;
}) {
  const muted = !item.unlocked;
  return <article className={`min-w-0 border p-4 transition-colors ${muted ? "border-white/8 bg-[#111] text-white/50" : "border-white/15 bg-[#151515] text-[#f5f0de]"}`}>
    <div className="flex items-start gap-3">
      <Insignia unlocked={item.unlocked} color={item.tierColor} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[10px] font-black tracking-[0.14em] ${muted ? "text-white/35" : "text-white/55"}`}>{item.id}</span>
          <span className={`text-[10px] ${muted ? "text-white/35" : "text-white/55"}`}>{item.category}</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: muted ? "#777" : item.tierColor }}>{item.tierName}</span>
          <span className="ml-auto text-[10px] text-white/35">{rarity}% rarity</span>
        </div>
        <h4 className={`mt-1 text-base font-bold ${muted ? "text-white/55" : "text-[#f5f0de]"}`}>{item.name}</h4>
        <p className="mt-1 min-h-10 text-xs leading-5 text-white/45">{item.description}</p>
      </div>
      {isOwnProfile && item.unlocked && onTogglePin && <button type="button" onClick={onTogglePin} aria-label={isPinned ? `Unpin ${item.name}` : `Pin ${item.name}`} title={isPinned ? "Unpin honour" : "Pin honour"} className={`rounded p-1 ${isPinned ? "text-[#D7BC79]" : "text-white/35 hover:text-white"}`}><Pin size={15} fill={isPinned ? "currentColor" : "none"} /></button>}
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-white/40"><span>{item.current} / {item.target}</span><span>Eligible {formatDate(item.eligibilityDate)}</span>{item.unlocked && <span>Unlocked {formatDate((item as StoredHonour).unlockedAt)}</span>}</div>
    <div className="mt-2 h-1 overflow-hidden bg-white/10"><div className="h-full" style={{ width: `${item.progress}%`, backgroundColor: muted ? "#666" : item.tierColor }} /></div>
  </article>;
}
