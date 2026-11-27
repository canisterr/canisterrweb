import { cache } from "react";
import { resolveMovieRouteParam } from "./content-slugs";

// Shared by metadata, layout, and page during one server render.
export const getResolvedMoviePage = cache(resolveMovieRouteParam);
