"use client";

import { useEffect, useState } from "react";
import { Film, List as ListIcon, Search, Tv, UserRound } from "lucide-react";
import { CinePostAnchorType, Content, ListWithItems, TMDBMovie, TMDBPersonSearchResult, User } from "@/types";
import { createCinePost } from "@/lib/cineposts";
import { getListWithDetails, getPublicLists, getUserLists } from "@/lib/lists";
import { reportAppError } from "@/lib/report-error";
import { getMovieDetails, searchMovies, searchPeople } from "@/lib/tmdb";
import { getShowDetails, searchShows } from "@/lib/tvmaze";
import CinePostArtwork from "@/components/CinePostArtwork";

const ANCHOR_TYPES: Array<{ value: CinePostAnchorType; label: string }> = [
  { value: "movie", label: "Movie" },
  { value: "tv", label: "TV" },
  { value: "list", label: "List" },
  { value: "crew", label: "Crew" },
];

type AnchorResult = Content | TMDBPersonSearchResult;

function isCrewResult(item: AnchorResult): item is TMDBPersonSearchResult {
  return "profile_path" in item;
}

function anchorTypeLabel(anchorType: CinePostAnchorType): string {
  if (anchorType === "movie") return "movie";
  if (anchorType === "tv") return "TV show";
  if (anchorType === "list") return "list";
  return "crew member";
}

function anchorSearchLabel(anchorType: CinePostAnchorType): string {
  if (anchorType === "movie") return "TMDB movies";
  if (anchorType === "tv") return "TV shows";
  if (anchorType === "list") return "lists";
  return "TMDB people";
}

function anchorPlaceholder(anchorType: CinePostAnchorType): string {
  if (anchorType === "movie") return "Search La La Land, The Dark Knight...";
  if (anchorType === "tv") return "Search Ted Lasso, Breaking Bad...";
  if (anchorType === "list") return "Search your lists or public lists...";
  return "Search Brad Pitt, Christopher Nolan...";
}

function getContentLabel(content: Content | null): string {
  if (!content) return "";
  return content.title || "";
}

function getTitleClass(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean).length;
  if (words <= 2) return "text-[34px] sm:text-[52px]";
  if (words <= 4) return "text-[28px] sm:text-[44px]";
  if (words <= 6) return "text-[22px] sm:text-[34px]";
  return "text-[18px] sm:text-[28px]";
}

function getSelectedTitle(
  anchorType: CinePostAnchorType,
  selectedContent: Content | null,
  selectedPerson: TMDBPersonSearchResult | null,
  selectedList: ListWithItems | null
): string {
  if (anchorType === "crew") return selectedPerson?.name || "Pick a crew member";
  if (anchorType === "list") return selectedList?.name || "Pick a list";
  return getContentLabel(selectedContent) || "Pick a title";
}

function getSelectedMeta(
  anchorType: CinePostAnchorType,
  selectedContent: Content | null,
  selectedPerson: TMDBPersonSearchResult | null,
  selectedList: ListWithItems | null
): string {
  if (anchorType === "crew") {
    return selectedPerson?.known_for_department || "TMDB crew member";
  }

  if (anchorType === "list") {
    if (!selectedList) return "Curate a list-driven thread";
    return `${selectedList.item_count} ${selectedList.item_count === 1 ? "movie" : "movies"}`;
  }

  if (!selectedContent) {
    return anchorType === "tv" ? "TV show thread" : "Movie thread";
  }

  return [
    selectedContent.release_date?.slice(0, 4) || null,
    selectedContent.director || null,
    anchorType === "tv" ? "TV show" : "Movie",
  ]
    .filter(Boolean)
    .join(" • ");
}

interface CinePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onCreated?: (message: string) => void;
  theme?: "default" | "brutalist";
}

const DRAFT_STORAGE_KEY = "cinepost:composer-draft";

function movieToContent(movie: TMDBMovie): Content {
  return {
    id: movie.id,
    title: movie.title,
    poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
    genres: [],
    platforms: [],
    director: movie.director || null,
    actors: [],
    language: null,
    release_date: movie.release_date || null,
    overview: movie.overview || null,
    runtime: movie.runtime || null,
    rating: movie.vote_average || null,
    created_at: new Date().toISOString(),
    type: "movie",
  };
}

export default function CinePostModal({ isOpen, onClose, user, onCreated }: CinePostModalProps) {
  const userId = user?.id;
  const [anchorType, setAnchorType] = useState<CinePostAnchorType>("movie");
  const [anchorQuery, setAnchorQuery] = useState("");
  const [anchorResults, setAnchorResults] = useState<AnchorResult[]>([]);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<TMDBPersonSearchResult | null>(null);
  const [selectedList, setSelectedList] = useState<ListWithItems | null>(null);
  const [listResults, setListResults] = useState<ListWithItems[]>([]);
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [backdropOptions, setBackdropOptions] = useState<string[]>([]);
  const [selectedBackdropUrls, setSelectedBackdropUrls] = useState<string[]>([]);
  const [loadingBackdrops, setLoadingBackdrops] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;

    try {
      const rawDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!rawDraft) return;
      const draft = JSON.parse(rawDraft) as {
        userId?: string | null;
        content?: string;
        tags?: string;
      };

      if (draft.userId && userId && draft.userId !== userId) {
        return;
      }

      if (!content && draft.content) {
        setContent(draft.content);
      }

      if (!tags && draft.tags) {
        setTags(draft.tags);
      }
    } catch {
      // Ignore invalid drafts.
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasDraft = content.trim().length > 0 || tags.trim().length > 0;
    if (!hasDraft) {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        userId: userId || null,
        content,
        tags,
      })
    );
  }, [content, tags, userId]);

  useEffect(() => {
    if (!isOpen) return;
    const query = anchorQuery.trim();
    if (anchorType !== "list" && (query.length < 1 || selectedContent || selectedPerson)) {
      setAnchorResults([]);
      setSearching(false);
      return;
    }

    if (anchorType === "list" && selectedList) {
      setListResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        setSearching(true);
        if (anchorType === "list") {
          if (!userId) {
            if (!cancelled) setListResults([]);
            return;
          }

          const [ownedLists, publicLists] = await Promise.all([
            getUserLists(userId).catch(() => []),
            getPublicLists(30).catch(() => []),
          ]);

          const mergedById = new Map<string, ListWithItems>();
          [...ownedLists, ...publicLists].forEach((list) => {
            mergedById.set(list.id, list as ListWithItems);
          });

          const normalized = query.toLowerCase();
          const results = Array.from(mergedById.values())
            .filter((list) => {
              if (!normalized) return true;
              return (
                list.name.toLowerCase().includes(normalized) ||
                (list.description || "").toLowerCase().includes(normalized) ||
                list.owner_id.toLowerCase().includes(normalized)
              );
            })
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            .slice(0, 8);

          const detailedResults = await Promise.all(
            results.map(async (list) => (await getListWithDetails(list.id)) || null)
          );

          if (!cancelled) {
            setListResults(detailedResults.filter((list): list is ListWithItems => Boolean(list)));
            setAnchorResults([]);
          }
          return;
        }

        const results: AnchorResult[] =
          anchorType === "movie"
            ? (await searchMovies(query, 1)).slice(0, 8).map(movieToContent)
            : anchorType === "tv"
              ? ((await searchShows(query)).slice(0, 8) as unknown as Content[])
              : await searchPeople(query);

        if (!cancelled) setAnchorResults(results);
      } catch (err) {
        reportAppError({
          title: "Post search failed",
          message: "We could not load suggestions for this post.",
          details: err instanceof Error ? err.stack || err.message : String(err),
        });
        if (!cancelled) setAnchorResults([]);
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [anchorQuery, anchorType, isOpen, selectedContent, selectedList, selectedPerson, userId]);

  useEffect(() => {
    if (!isOpen || !selectedContent || (anchorType !== "movie" && anchorType !== "tv")) {
      setBackdropOptions([]);
      setSelectedBackdropUrls([]);
      setLoadingBackdrops(false);
      return;
    }

    const existingBackdrops = (selectedContent.backdrop_gallery_urls || []).filter((url): url is string => Boolean(url)).slice(0, 12);
    if (existingBackdrops.length > 0) {
      setBackdropOptions(existingBackdrops);
      setSelectedBackdropUrls((current) => current.filter((url) => existingBackdrops.includes(url)).slice(0, 2));
      setLoadingBackdrops(false);
      return;
    }

    let cancelled = false;
    setLoadingBackdrops(true);

    (async () => {
      try {
        const details =
          anchorType === "movie"
            ? await getMovieDetails(selectedContent.id)
            : await getShowDetails(selectedContent.id);
        if (cancelled) return;

        const nextBackdrops = (details?.backdrop_gallery_urls || [])
          .filter((url): url is string => Boolean(url))
          .slice(0, 12);

        setBackdropOptions(nextBackdrops);
        setSelectedBackdropUrls((current) => current.filter((url) => nextBackdrops.includes(url)).slice(0, 2));

        if (details) {
          setSelectedContent((current) => (
            current && current.id === selectedContent.id
              ? ({ ...current, ...details } as Content)
              : current
          ));
        }
      } catch (err) {
        if (!cancelled) {
          setBackdropOptions([]);
          reportAppError({
            title: "Backdrop loading failed",
            message: "We could not load backdrop options for this title.",
            details: err instanceof Error ? err.stack || err.message : String(err),
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingBackdrops(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [anchorType, isOpen, selectedContent]);

  if (!isOpen) return null;

  const selectedTitle = getSelectedTitle(anchorType, selectedContent, selectedPerson, selectedList);
  const selectedMeta = getSelectedMeta(anchorType, selectedContent, selectedPerson, selectedList);
  const selectedTitleClass = getTitleClass(selectedTitle);
  const submitLabel = saving ? "POSTING" : "PUBLISH POST";

  const resetAnchor = (nextType: CinePostAnchorType) => {
    setAnchorType(nextType);
    setAnchorQuery("");
    setAnchorResults([]);
    setSelectedContent(null);
    setSelectedPerson(null);
    setSelectedList(null);
    setListResults([]);
    setBackdropOptions([]);
    setSelectedBackdropUrls([]);
    setLoadingBackdrops(false);
    setError("");
  };

  const clearDraft = () => {
    setContent("");
    setTags("");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  };

  const handleSelectContent = (item: Content) => {
    setSelectedContent(item);
    setAnchorQuery(getContentLabel(item));
    setAnchorResults([]);
    setSelectedPerson(null);
    setSelectedList(null);
    setListResults([]);
    setBackdropOptions([]);
    setSelectedBackdropUrls([]);
    setError("");
  };

  const handleSelectPerson = (person: TMDBPersonSearchResult) => {
    setSelectedPerson(person);
    setAnchorQuery(person.name);
    setAnchorResults([]);
    setSelectedContent(null);
    setSelectedList(null);
    setListResults([]);
    setBackdropOptions([]);
    setSelectedBackdropUrls([]);
    setError("");
  };

  const handleSelectList = (list: ListWithItems) => {
    setSelectedList(list);
    setAnchorQuery(list.name);
    setListResults([]);
    setAnchorResults([]);
    setSelectedContent(null);
    setSelectedPerson(null);
    setBackdropOptions([]);
    setSelectedBackdropUrls([]);
    setError("");
  };

  const toggleBackdrop = (url: string) => {
    setSelectedBackdropUrls((current) => {
      if (current.includes(url)) {
        return current.filter((item) => item !== url);
      }
      if (current.length >= 2) {
        return [...current.slice(1), url];
      }
      return [...current, url];
    });
  };

  const handleSelectSearchResult = (item: AnchorResult) => {
    if (isCrewResult(item)) {
      handleSelectPerson(item);
      return;
    }

    handleSelectContent(item);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    if (content.trim().length < 8) {
      setError("Write a little more so people have something to reply to.");
      return;
    }

    if (anchorType === "crew") {
      if (!selectedPerson) {
        setError("Select a crew member from search first.");
        return;
      }
    } else if (anchorType === "list") {
      if (!selectedList) {
        setError("Select a list from search first.");
        return;
      }
    } else if (!selectedContent) {
      setError(`Select a ${anchorTypeLabel(anchorType)} from search first.`);
      return;
    }

    try {
      setSaving(true);
      setError("");
      if (anchorType === "crew") {
        const person = selectedPerson;
        if (!person) return;

        await createCinePost({
          user,
          type: "post",
          anchorType,
          anchorLabel: person.name,
          body: content,
          tags: tags.split(","),
          content: null,
          personId: person.id,
          personName: person.name,
          personProfileUrl: person.profile_path ? `https://image.tmdb.org/t/p/w500${person.profile_path}` : null,
          personDepartment: person.known_for_department || null,
        });
      } else if (anchorType === "list") {
        const list = selectedList;
        if (!list) return;

        const listCoverUrl = list.cover_image_url || list.items[0]?.content.poster_url || null;

        await createCinePost({
          user,
          type: "post",
          anchorType,
          anchorLabel: list.name,
          body: content,
          tags: tags.split(","),
          listId: list.id,
          listName: list.name,
          listCoverUrl,
          posterUrl: listCoverUrl,
        });
      } else {
        await createCinePost({
          user,
          type: "post",
          anchorType,
          anchorLabel: getContentLabel(selectedContent) || "Untitled",
          body: content,
          tags: tags.split(","),
          content: selectedContent,
          backdropUrls: selectedBackdropUrls,
        });
      }
      setAnchorType("movie");
      setAnchorQuery("");
      setAnchorResults([]);
      setSelectedContent(null);
      setSelectedPerson(null);
      setSelectedList(null);
      setListResults([]);
      setBackdropOptions([]);
      setSelectedBackdropUrls([]);
      clearDraft();
      setIsEditorOpen(false);
      const successMessage =
        anchorType === "tv"
          ? "TV show posted"
          : anchorType === "movie"
            ? "Movie posted"
            : anchorType === "list"
              ? "List posted"
              : "Post created";
      onCreated?.(successMessage);
      onClose();
    } catch (err) {
      reportAppError({
        title: "Post creation failed",
        message: "We could not publish this post.",
        details: err instanceof Error ? err.stack || err.message : String(err),
      });
      setError("Could not create this post. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#050505] text-[#F5F2EA]">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-5 pt-4 sm:px-7 sm:pb-7 sm:pt-5 lg:px-9"
      >
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 text-2xl leading-none text-[#F5F2EA] transition hover:border-white/35 sm:h-10 sm:w-10"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 text-2xl leading-none text-[#F5F2EA] transition hover:border-white/35 sm:h-10 sm:w-10"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <main className="flex-1 space-y-5 pt-5 sm:space-y-6 sm:pt-6">
          {error && (
            <div className="rounded-2xl border border-[#FF6A00]/35 bg-[#FF6A00]/10 px-4 py-3 text-sm text-[#F5F2EA]">
              {error}
            </div>
          )}

          <section className="grid items-start gap-5 sm:gap-7 lg:grid-cols-[26rem_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="border-t border-white/14 pt-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.26em] text-[#FF6A00] sm:gap-3 sm:text-xs sm:tracking-[0.34em]">
                  <span className="h-2 w-2 rounded-full bg-[#FF6A00] sm:h-3 sm:w-3" />
                  {anchorType.toUpperCase()} POST
                </div>
                <div className="mt-3 sm:mt-4">
                  <h1
                    className={`max-w-[620px] break-words font-black uppercase leading-[0.9] tracking-normal text-[#F5F2EA] ${selectedTitleClass}`}
                    style={{ fontFamily: "Impact, 'Arial Narrow', 'Helvetica Neue Condensed', sans-serif" }}
                    title={selectedTitle}
                  >
                    {selectedTitle}
                  </h1>
                </div>
                <p className="mt-3 text-[11px] leading-5 text-white/58 sm:mt-4 sm:text-sm sm:leading-6">
                  {selectedMeta}
                </p>
              </div>

              {(selectedContent || selectedPerson || selectedList) && (
                <div className="border-t border-white/14 pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/58">Ready to post</p>
                  <div className="mt-3 rounded-[28px] border border-white/12 bg-white/[0.03] px-4 py-4">
                    <p className="text-sm font-black text-[#F5F2EA]">
                      {selectedList ? selectedList.name : selectedPerson ? selectedPerson.name : selectedContent?.title}
                    </p>
                    <p className="mt-1 text-xs text-white/48">
                      {selectedList
                        ? `${selectedList.item_count} ${selectedList.item_count === 1 ? "movie" : "movies"} in this list`
                        : selectedPerson
                          ? selectedPerson.known_for_department || "TMDB crew member"
                          : selectedContent?.release_date
                            ? selectedContent.release_date.slice(0, 4)
                            : "Selected from search"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-5 sm:space-y-6">
              <section className="border-t border-white/14 pt-4 sm:pt-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F5F2EA]">Post Type</p>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ANCHOR_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => resetAnchor(type.value)}
                      className={`h-11 border px-2 text-center text-[10px] font-bold uppercase tracking-[0.14em] transition sm:h-12 sm:text-[11px] ${
                        anchorType === type.value
                          ? "border-[#FF6A00] bg-[#FF6A00] text-black"
                          : "border-white/16 bg-transparent text-[#F5F2EA] hover:border-white/35"
                      }`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        {type.value === "movie" ? (
                          <Film className="h-4 w-4" />
                        ) : type.value === "tv" ? (
                          <Tv className="h-4 w-4" />
                        ) : type.value === "list" ? (
                          <ListIcon className="h-4 w-4" />
                        ) : (
                          <UserRound className="h-4 w-4" />
                        )}
                        {type.label}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="border-t border-white/14 pt-4 sm:pt-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F5F2EA]">
                  Search {anchorSearchLabel(anchorType)}
                </p>
                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                  <input
                    className="h-12 w-full border border-white/12 bg-[#050505] pl-10 pr-11 text-sm text-[#F5F2EA] outline-none placeholder:text-white/28 focus:border-[#FF6A00]"
                    placeholder={anchorPlaceholder(anchorType)}
                    value={anchorQuery}
                    onChange={(event) => {
                      setAnchorQuery(event.target.value);
                      setSelectedContent(null);
                      setSelectedPerson(null);
                      setSelectedList(null);
                    }}
                  />
                  {searching && (
                    <span className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-white/20 border-t-[#FF6A00]" />
                  )}
                </div>

                {anchorType === "list" && listResults.length > 0 ? (
                  <div className="mt-3 max-h-80 overflow-y-auto border border-white/12 bg-[#050505]">
                    {listResults.map((list) => {
                  const posterUrls = list.items
                    .map((item) => item.content.poster_url)
                    .filter((poster): poster is string => Boolean(poster))
                    .slice(0, 4);
                  return (
                    <button
                      key={list.id}
                      type="button"
                      onClick={() => handleSelectList(list)}
                      className="flex w-full items-center gap-3 border-b border-white/10 p-3 text-left transition last:border-b-0 hover:bg-white/[0.04]"
                    >
                      <div className="w-14 flex-shrink-0 overflow-hidden rounded-2xl">
                        <CinePostArtwork
                          src={list.cover_image_url}
                          collageImages={posterUrls}
                          alt={list.name}
                          className="aspect-[2/3] w-full"
                          theme="brutalist"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-[#F5F2EA]">{list.name}</p>
                        <p className="text-xs text-white/55">
                          {list.item_count} {list.item_count === 1 ? "movie" : "movies"}
                          <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 font-bold uppercase text-[#F5F2EA]">list</span>
                        </p>
                        {list.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-white/35">{list.description}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
                  </div>
                ) : anchorResults.length > 0 ? (
                  <div className="mt-3 max-h-72 overflow-y-auto border border-white/12 bg-[#050505]">
                    {anchorResults.map((item) => (
                      <button
                        key={`${isCrewResult(item) ? "crew" : item.type || anchorType}-${item.id}`}
                        type="button"
                        onClick={() => handleSelectSearchResult(item)}
                        className="flex w-full items-center gap-3 border-b border-white/10 p-3 text-left transition last:border-b-0 hover:bg-white/[0.04]"
                      >
                        {isCrewResult(item) ? (
                          item.profile_path ? (
                            <img
                              src={`https://image.tmdb.org/t/p/w185${item.profile_path}`}
                              alt={item.name}
                              className="h-16 w-12 flex-shrink-0 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="flex h-16 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/35">
                              <UserRound className="h-5 w-5" />
                            </div>
                          )
                        ) : item.poster_url ? (
                          <img
                            src={item.poster_url}
                            alt={item.title}
                            className="h-16 w-12 flex-shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/35">
                            {anchorType === "movie" ? <Film className="h-5 w-5" /> : <Tv className="h-5 w-5" />}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-[#F5F2EA]">
                            {isCrewResult(item) ? item.name : item.title}
                          </p>
                          <p className="text-xs text-white/55">
                            {isCrewResult(item)
                              ? item.known_for_department || "TMDB person"
                              : item.release_date
                                ? item.release_date.slice(0, 4)
                                : "Unknown year"}
                            <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 font-bold uppercase text-[#F5F2EA]">
                              {isCrewResult(item) ? "crew" : anchorType}
                            </span>
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : anchorQuery.trim().length > 0 && !searching ? (
                  <p className="mt-3 text-sm text-white/42">
                    No {anchorType === "crew" ? "people" : anchorType === "tv" ? "shows" : `${anchorType}s`} found for "{anchorQuery.trim()}".
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-white/42">Search and choose something to start the thread.</p>
                )}
              </section>

              {selectedContent && (anchorType === "movie" || anchorType === "tv") && (
                <section className="border-t border-white/14 pt-4 sm:pt-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F5F2EA]">Choose Backdrops</p>
                      <p className="mt-1 text-[11px] text-white/48 sm:text-xs">Optional. Pick up to 2 images for this post.</p>
                    </div>
                    <span className="text-xs font-bold text-[#FFB36B]">{selectedBackdropUrls.length}/2</span>
                  </div>

                  {loadingBackdrops ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {[0, 1, 2].map((index) => (
                        <div key={index} className="aspect-video animate-pulse rounded-2xl bg-white/5" />
                      ))}
                    </div>
                  ) : backdropOptions.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {backdropOptions.map((url) => {
                        const selected = selectedBackdropUrls.includes(url);
                        return (
                          <button
                            key={url}
                            type="button"
                            onClick={() => toggleBackdrop(url)}
                            className={`group relative overflow-hidden border transition ${
                              selected
                                ? "border-[#FF6A00] shadow-[0_0_0_1px_rgba(255,106,0,0.35)]"
                                : "border-white/12 hover:border-white/28"
                            }`}
                            aria-pressed={selected}
                          >
                            <img src={url} alt={`${selectedContent.title} backdrop option`} className="aspect-video w-full object-cover" />
                            <div className={`absolute inset-0 transition ${selected ? "bg-[#FF6A00]/18" : "bg-black/0 group-hover:bg-black/10"}`} />
                            {selected && (
                              <span className="absolute left-2 top-2 bg-[#FF6A00] px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-black">
                                Selected
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-white/45">No backdrops available for this title yet.</p>
                  )}
                </section>
              )}

              <section className="border-t border-white/14 pt-4 sm:pt-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F5F2EA]">Your Post</p>
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(true)}
                  className="mt-3 block min-h-28 w-full border border-[#9A3F00] px-3 py-3 text-left transition hover:border-[#c76622] sm:min-h-36 sm:px-4 sm:py-4"
                >
                  <div className="text-sm font-bold leading-7 text-[#F5F2EA] sm:text-lg">
                    {content.trim() || "What stayed with you?"}
                  </div>
                  <span className="mt-2 block text-[11px] text-white/48 sm:text-xs">
                    Tap to write. Draft saves automatically.
                  </span>
                </button>
              </section>

              <section className="border-t border-white/14 pt-4 sm:pt-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F5F2EA]">Tags</p>
                <input
                  className="mt-3 h-12 w-full border border-white/12 bg-[#050505] px-4 text-sm text-[#F5F2EA] outline-none placeholder:text-white/28 focus:border-[#FF6A00]"
                  placeholder="cinematography, ending explained, comfort watch"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                />
              </section>
            </div>
          </section>
        </main>

        <div className="sticky bottom-0 -mx-4 mt-5 bg-[#050505]/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-7 sm:mt-6 sm:px-7 lg:-mx-9 lg:px-9">
          <button
            type="submit"
            disabled={saving || !user}
            className="h-12 w-full rounded-2xl bg-[#FF6A00] px-6 text-center text-xs font-black uppercase tracking-[0.24em] text-black transition hover:bg-[#ff7c24] disabled:opacity-60 sm:h-[56px] sm:text-sm"
          >
            {submitLabel}
          </button>
        </div>
      </form>

      {isEditorOpen && (
        <div className="fixed inset-0 z-[60] bg-[#050505] text-[#F5F2EA]">
          <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4 pb-5 pt-4 sm:px-7 sm:pb-7 sm:pt-5">
            <header className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                aria-label="Back to composer"
                className="flex h-9 items-center justify-center rounded-full border border-white/15 bg-black/40 px-4 text-sm font-bold text-[#F5F2EA] transition hover:border-white/35 sm:h-10"
              >
                Back
              </button>
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/48">
                Draft autosaved
              </span>
            </header>

            <div className="mt-6 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F5F2EA]">Your Post</p>
              <textarea
                autoFocus
                className="mt-4 min-h-[52dvh] w-full resize-none border border-[#9A3F00] bg-transparent px-4 py-4 text-base font-bold leading-8 text-[#F5F2EA] outline-none placeholder:text-white/30 sm:min-h-[58dvh] sm:text-[22px]"
                placeholder="What stayed with you?"
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
            </div>

            <div className="border-t border-white/12 pt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F5F2EA]">Tags</p>
              <input
                className="mt-3 h-12 w-full border border-white/12 bg-[#050505] px-4 text-sm text-[#F5F2EA] outline-none placeholder:text-white/28 focus:border-[#FF6A00]"
                placeholder="cinematography, ending explained, comfort watch"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
              />
            </div>

            <div className="sticky bottom-0 mt-5 bg-[#050505]/95 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="h-12 w-full rounded-2xl bg-[#FF6A00] px-6 text-center text-xs font-black uppercase tracking-[0.24em] text-black transition hover:bg-[#ff7c24] sm:h-[56px] sm:text-sm"
              >
                Done Writing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
