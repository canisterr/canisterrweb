export type FeaturedTitle = {
  title: string;
  href: string;
  poster_url: string;
  media_type: "movie" | "tv";
  media_id: number;
  show_in_preview?: boolean;
  frame_url?: string;
  release_year?: string;
  note?: string;
};

export type FeaturedList = {
  id: string;
  title: string;
  description: string;
  active: boolean;
  expires_at?: string;
  items: FeaturedTitle[];
  created_at: string;
  updated_at: string;
};
