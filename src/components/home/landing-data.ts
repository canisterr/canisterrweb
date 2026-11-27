// Curated TMDB poster metadata for the public landing page; no startup-time search is required.
export const landingPosters = {
  parasite: { title: "Parasite", year: "2019", url: "https://image.tmdb.org/t/p/w342/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg" },
  interstellar: { title: "Interstellar", year: "2014", url: "https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg" },
  darkKnight: { title: "The Dark Knight", year: "2008", url: "https://image.tmdb.org/t/p/w342/qJ2tW6WMUDux911r6m7haRef0WH.jpg" },
  dune: { title: "Dune", year: "2021", url: "https://image.tmdb.org/t/p/w342/d5NXSklXo0qyIYkgV94XAgMIckC.jpg" },
  everything: { title: "Everything Everywhere All at Once", year: "2022", url: "https://image.tmdb.org/t/p/w342/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg" },
  laLaLand: { title: "La La Land", year: "2016", url: "https://image.tmdb.org/t/p/w342/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg" },
  grandBudapest: { title: "The Grand Budapest Hotel", year: "2014", url: "https://image.tmdb.org/t/p/w342/eWdyYQreja6JGCzqHWXpWHDrrPo.jpg" },
  breakingBad: { title: "Breaking Bad", year: "2008", url: "https://image.tmdb.org/t/p/w342/ggFHVNu6YYI5L9pCfOacjizRGt.jpg" },
  strangerThings: { title: "Stranger Things", year: "2016", url: "https://image.tmdb.org/t/p/w342/49WJfeN0moxb9IPfGn8AIqMGskD.jpg" },
  severance: { title: "Severance", year: "2022", url: "https://image.tmdb.org/t/p/w342/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg" },
} as const;

export type LandingPoster = (typeof landingPosters)[keyof typeof landingPosters];
