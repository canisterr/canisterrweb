"use client";

import Link from "next/link";
import { X } from "lucide-react";
import type { User } from "@/types";

export function Avatar({ user, size = 10 }: { user: User; size?: number }) {
  const dimension = `${size / 4}rem`;
  const style = { height: dimension, width: dimension };

  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.name}
        style={style}
        className="rounded-full object-cover"
      />
    );
  }

  return (
    <div
      style={style}
      className="flex items-center justify-center rounded-full bg-[#f5f0de] text-sm font-black text-[#050505]"
    >
      {user.name?.charAt(0)?.toUpperCase() || "U"}
    </div>
  );
}

interface LikersModalProps {
  title: string;
  users: User[];
  loading: boolean;
  onClose: () => void;
}

export default function LikersModal({ title, users, loading, onClose }: LikersModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/25 p-3 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-[1.5rem] border border-white/10 bg-[#121212] p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-[#f5f0de]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/55 hover:bg-white/5"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-white/55">No one here yet.</p>
        ) : (
          <div className="space-y-2">
            {users.map((person) => (
              <Link
                key={person.id}
                href={`/profile/${person.username || person.id}`}
                onClick={onClose}
                className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-white/5"
              >
                <Avatar user={person} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#f5f0de]">{person.name}</p>
                  <p className="truncate text-xs text-white/55">@{person.username}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
