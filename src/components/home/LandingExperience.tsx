"use client";

import Image from "@/components/AppImage";
import Link from "next/link";
import { useState } from "react";
import { landingPosters, type LandingPoster } from "./landing-data";
import "./LandingExperience.css";

const films = [
  landingPosters.parasite,
  landingPosters.interstellar,
  landingPosters.laLaLand,
  landingPosters.darkKnight,
  landingPosters.dune,
  landingPosters.everything,
  landingPosters.grandBudapest,
];
const series = [landingPosters.breakingBad, landingPosters.strangerThings, landingPosters.severance];

function Poster({ poster, eager = false }: { poster: LandingPoster; eager?: boolean }) {
  const [failed, setFailed] = useState(false);

  return (
    <article className="canisterr-poster">
      <div className="canisterr-poster-art">
        {failed ? (
          <div className="canisterr-poster-fallback"><strong>{poster.title}</strong></div>
        ) : (
          <Image
            src={poster.url}
            alt={`${poster.title} poster`}
            fill
            sizes="(max-width: 700px) 38vw, (max-width: 1100px) 22vw, 15vw"
            loading={eager ? "eager" : "lazy"}
            onError={() => setFailed(true)}
          />
        )}
      </div>
    </article>
  );
}

export default function LandingExperience() {
  return (
    <div className="canisterr-landing">
      <header className="canisterr-site-header">
        <Link href="/" className="canisterr-wordmark" aria-label="Canisterr home">
          <Image src="/logo-ui.webp" alt="" width={38} height={38} loading="eager" />
          <span>canisterr<span className="wordmark-period">.</span></span>
        </Link>
        <nav className="canisterr-main-nav" aria-label="Main navigation">
          <a href="#films">Films</a>
          <a href="#series">Series</a>
          <Link href="/auth/login">Sign in</Link>
          <Link href="/auth/signup" className="canisterr-nav-join">Create account</Link>
        </nav>
        <div className="canisterr-mobile-actions">
          <Link href="/auth/login" className="canisterr-mobile-signin">Sign in</Link>
          <Link href="/auth/signup" className="canisterr-mobile-join">Join</Link>
        </div>
      </header>

      <main>
        <section className="canisterr-hero" aria-labelledby="hero-title">
          <div className="canisterr-hero-copy">
            <h1 id="hero-title">A place for<br />what you watch.</h1>
            <p className="canisterr-hero-intro">Keep a record of films and series, rate them, and save the thoughts you want to remember.</p>
            <div className="canisterr-hero-actions">
              <Link href="/auth/signup" className="canisterr-primary-link">Create your account</Link>
              <Link href="/auth/login" className="canisterr-text-link">Sign in</Link>
            </div>
          </div>

          <div className="canisterr-hero-art" aria-label="Film and television posters">
            <div className="canisterr-art-glow" />
            <div className="canisterr-hero-posters">
              {[films[0], series[0], films[1], series[1], films[2]].map((poster, index) => (
                <div key={poster.title} className={`hero-poster hero-poster-${index + 1}`}>
                  <Poster poster={poster} eager />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="canisterr-shelf-section" aria-label="Films and series">
          <div id="films" className="canisterr-media-group">
            <h2>Films</h2>
            <div className="canisterr-poster-rail">
              {films.map((poster) => <Poster key={poster.title} poster={poster} />)}
            </div>
          </div>
          <div id="series" className="canisterr-media-group">
            <h2>Series</h2>
            <div className="canisterr-poster-rail canisterr-series-rail">
              {series.map((poster) => <Poster key={poster.title} poster={poster} />)}
            </div>
          </div>
        </section>

        <section id="your-diary" className="canisterr-diary-section" aria-labelledby="diary-title">
          <div className="canisterr-diary-copy">
            <h2 id="diary-title">Your own film diary.</h2>
            <p>Log a watch, leave a rating, and add a note. Your history stays in one place.</p>
          </div>
          <div className="canisterr-entry-preview" aria-label="Example film diary entry">
            <div className="entry-main">
              <div className="entry-poster"><Image src={landingPosters.parasite.url} alt="Parasite poster" fill sizes="(max-width: 700px) 28vw, 180px" /></div>
              <div className="entry-details">
                <p className="entry-kind">FILM · 2019</p>
                <h3>Parasite</h3>
                <p className="entry-date">Watched 24 November</p>
                <div className="entry-rating"><span>Your rating</span><strong>Masterpiece</strong></div>
                <p className="entry-review">A personal note about the film goes here.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="canisterr-details-strip" aria-label="Canisterr features">
          <div><h3>Keep a diary</h3><p>Remember what you watched and what you thought.</p></div>
          <div><h3>Make lists</h3><p>Collect films and series around your interests.</p></div>
          <div><h3>Follow friends</h3><p>See what people you follow are watching.</p></div>
        </section>
      </main>

      <footer className="canisterr-site-footer">
        <Link href="/" className="canisterr-footer-mark">canisterr<span>.</span></Link>
        <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
        <nav aria-label="Footer links"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/credits">Credits</Link><a href="mailto:support@canisterr.com">Contact</a></nav>
      </footer>
    </div>
  );
}
