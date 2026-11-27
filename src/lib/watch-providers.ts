export type WatchProvider = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority?: number;
};

export type WatchRegion = {
  link?: string;
  flatrate?: WatchProvider[];
  free?: WatchProvider[];
  ads?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
};

export type WatchProviderRegions = Record<string, WatchRegion>;

export type TmdbWatchProviderAppend = {
  "watch/providers"?: {
    results?: WatchProviderRegions;
  };
};
