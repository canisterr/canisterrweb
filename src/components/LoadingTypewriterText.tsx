"use client";

import { useEffect, useMemo, useState } from "react";

type LoadingTypewriterTextProps = {
  text: string;
  className?: string;
};

function buildFrames(text: string): string[] {
  const cleanText = text.trim().replace(/\s+/g, " ");
  if (!cleanText) return ["Loading"];

  if (cleanText.toLowerCase() === "canisterr") {
    return ["CANISTERR", "CANISTERRR", "CANISTERRRR", "CANISTERRRRR"];
  }

  const words = cleanText.split(" ");
  if (words.length === 1) {
    return Array.from({ length: cleanText.length }, (_, index) => cleanText.slice(0, index + 1));
  }

  return words.map((_, index) => {
    if (index === words.length - 1) return cleanText;
    const visibleWords = words.slice(0, index + 1).join(" ");
    const nextInitial = words[index + 1]?.[0] || "";
    return `${visibleWords}${nextInitial ? ` ${nextInitial}` : ""}...`;
  });
}

export default function LoadingTypewriterText({ text, className = "" }: LoadingTypewriterTextProps) {
  const frames = useMemo(() => buildFrames(text), [text]);
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (frames.length <= 1) return;

    const isLastFrame = frameIndex >= frames.length - 1;
    const timeout = window.setTimeout(
      () => setFrameIndex((current) => (current >= frames.length - 1 ? 0 : current + 1)),
      isLastFrame ? 900 : 210
    );

    return () => window.clearTimeout(timeout);
  }, [frameIndex, frames.length]);

  return (
    <span className={className}>
      {frames[frameIndex % frames.length]}
      <span className="ml-0.5 animate-pulse text-[#ff7a1a]">|</span>
    </span>
  );
}
