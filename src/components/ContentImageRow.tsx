"use client";

import { XIcon } from "lucide-react";
import {
  MorphingDialog,
  MorphingDialogClose,
  MorphingDialogContainer,
  MorphingDialogContent,
  MorphingDialogImage,
  MorphingDialogTrigger,
} from "@/components/core/morphing-dialog";

interface ContentImageRowProps {
  primaryUrl?: string | null;
  primaryAlt: string;
  secondaryUrls?: (string | null | undefined)[];
  layout?: "default" | "poster-first" | "posters-only";
  density?: "default" | "compact";
}

type Slide = { url: string; alt: string };

export default function ContentImageRow({
  primaryUrl,
  primaryAlt,
  secondaryUrls = [],
  layout = "default",
  density = "default",
}: ContentImageRowProps) {
  const secondaries = secondaryUrls.filter((url): url is string => Boolean(url)).slice(0, 2);

  if (!primaryUrl && secondaries.length === 0) {
    return (
      <div className="flex aspect-[16/9] w-full items-center justify-center bg-[#111111] text-xs text-white/35">
        No image
      </div>
    );
  }

  const slides: Slide[] = primaryUrl
    ? layout === "poster-first" || layout === "posters-only"
      ? [{ url: primaryUrl, alt: primaryAlt }, ...secondaries.map((url) => ({ url, alt: `${primaryAlt} still` }))]
      : [
          ...(secondaries[0] ? [{ url: secondaries[0], alt: `${primaryAlt} still` }] : []),
          { url: primaryUrl, alt: primaryAlt },
          ...(secondaries[1] ? [{ url: secondaries[1], alt: `${primaryAlt} still` }] : []),
        ]
    : secondaries.map((url) => ({ url, alt: `${primaryAlt} still` }));

  const singleImage = slides.length === 1;
  const posterFirst = layout === "poster-first" && primaryUrl;
  const postersOnly = layout === "posters-only";
  const rowHeight = density === "compact" ? "h-44 sm:h-56" : "h-64 sm:h-80";
  const defaultSlideWidth = density === "compact" ? "w-[56%] sm:w-56" : "w-[68%] sm:w-72";

  return (
      <div className={`flex gap-2 overflow-x-auto bg-black p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${rowHeight}`}>
        {slides.map((slide, index) => (
          <MorphingDialog
            key={`${slide.url}-${index}`}
            transition={{
              duration: 0.3,
              ease: "easeInOut",
            }}
          >
            <MorphingDialogTrigger>
              <button
                type="button"
                className={`relative overflow-hidden rounded-lg ${
                  posterFirst
                    ? index === 0
                      ? `h-full aspect-[2/3] flex-shrink-0 ${singleImage ? "mx-auto" : ""}`
                      : `h-full aspect-video flex-shrink-0 ${singleImage ? "w-full" : "w-auto"}`
                    : postersOnly
                      ? `h-full aspect-[2/3] flex-shrink-0 ${singleImage ? "mx-auto" : ""}`
                    : `h-full flex-shrink-0 ${singleImage ? "w-full" : defaultSlideWidth}`
                }`}
                aria-label={`Open ${slide.alt}`}
              >
                <MorphingDialogImage
                  src={slide.url}
                  alt={slide.alt}
                  className="h-full w-full object-cover"
                />
              </button>
            </MorphingDialogTrigger>

            <MorphingDialogContainer>
              <MorphingDialogContent className="relative">
                <MorphingDialogImage
                  src={slide.url}
                  alt={slide.alt}
                  className="h-auto max-h-[90vh] w-full max-w-[92vw] rounded-[8px] object-contain lg:max-w-[88vw]"
                />
              </MorphingDialogContent>

              <MorphingDialogClose
                className="fixed right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white text-zinc-600 shadow-[0_10px_30px_rgba(0,0,0,0.35)] sm:right-6 sm:top-6"
                variants={{
                  initial: { opacity: 0 },
                  animate: {
                    opacity: 1,
                    transition: { delay: 0.22, duration: 0.12 },
                  },
                  exit: { opacity: 0, transition: { duration: 0.08 } },
                }}
              >
                <XIcon className="h-5 w-5" />
              </MorphingDialogClose>
            </MorphingDialogContainer>
          </MorphingDialog>
        ))}
      </div>
    
  );
}
