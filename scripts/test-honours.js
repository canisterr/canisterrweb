/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadTs(relativePath) {
  const file = path.resolve(__dirname, relativePath);
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = new Module(file, module);
  loaded._compile(source, file);
  return loaded.exports;
}

const { HONOUR_DEFINITIONS, HONOUR_TIERS, evaluateHonours } = loadTs("../src/lib/honours-engine.ts");
const { calculateHonourMetrics } = loadTs("../src/lib/honours-calculator.ts");
const user = (createdAt = "2020-01-01T00:00:00.000Z") => ({ id: "u1", username: "cine", name: "Cine", avatar_url: "avatar.jpg", bio: "Films", created_at: createdAt });
const log = (id, type, contentId, date = "2025-01-01", extra = {}) => ({
  id, user_id: "u1", content_type: type, content_id: contentId, watched_date: date,
  reaction: null, notes: "", created_at: `${date}T12:00:00.000Z`, updated_at: `${date}T12:00:00.000Z`, ...extra,
});
const calc = (logs, metadataByMediaKey = {}, owner = user(), now = new Date("2026-01-01T00:00:00.000Z")) => calculateHonourMetrics({
  user: owner, logs, metadataByMediaKey, followingCount: 0, now,
});

test("the catalog contains exactly 50 achievements in the requested category counts", () => {
  assert.equal(HONOUR_DEFINITIONS.length, 50);
  assert.deepEqual(Object.fromEntries(["Universal", "Movies", "Television", "Community"].map((category) => [
    category, HONOUR_DEFINITIONS.filter((item) => item.category === category).length,
  ])), { Universal: 23, Movies: 10, Television: 11, Community: 6 });
  assert.equal(Object.keys(HONOUR_TIERS).length, 6);
  assert.deepEqual(Object.values(HONOUR_TIERS).map((tier) => [tier.minimumMembershipDays, tier.color]), [
    [1, "#BF9974"], [7, "#B8C0C8"], [30, "#A9B99B"], [90, "#9BAABD"], [365, "#D7BC79"], [1095, "#D9B5BF"],
  ]);
});

test("all 50 achievement conditions unlock at their defined metric threshold", () => {
  const metrics = Object.fromEntries(HONOUR_DEFINITIONS.map((item) => [item.metric, item.target]));
  const results = evaluateHonours(metrics, "2020-01-01T00:00:00.000Z", new Date("2026-01-01T00:00:00.000Z"));
  assert.equal(results.length, 50);
  for (const achievement of results) assert.equal(achievement.unlocked, true, `${achievement.id} ${achievement.name}`);
});

test("a single watched movie unlocks First Frame for a member past the first tier wait", () => {
  const metrics = calc([log("m1", "movie", 44)]);
  const result = evaluateHonours(metrics, user().created_at, new Date("2026-01-01T00:00:00.000Z"));
  assert.equal(result.find((item) => item.id === "01").unlocked, true);
  assert.equal(result.find((item) => item.id === "01").current, 1);
});

test("movie and TV IDs do not collide in title, rating, or metadata calculations", () => {
  const logs = [log("m", "movie", 500, "2025-01-01", { reaction: 2 }), log("t", "tv", 500, "2025-01-02", { season: 1, episode: 1, reaction: 0 })];
  const metrics = calc(logs, {
    "movie:500": { genres: ["Drama"], original_language: "en", production_countries: ["US"], release_date: "2000-01-01", runtime: 90 },
    "tv:500": { genres: ["Comedy"], original_language: "ja", countries: ["JP"], premiered: "2020-01-01", episode_runtime_by_key: { "1:1": 30 } },
  });
  assert.equal(metrics.uniqueMovies, 1);
  assert.equal(metrics.uniqueEpisodes, 1);
  assert.equal(metrics.genres, 2);
  assert.equal(metrics.languages, 2);
  assert.equal(metrics.countries, 2);
  assert.equal(metrics.ratedTitles, 2);
  assert.equal(metrics.watchMinutes, 120);
});

test("duplicate episode logs count once as an episode and as a rewatch", () => {
  const logs = [
    log("e1", "tv", 9, "2025-01-01", { season: 1, episode: 1 }),
    log("e2", "tv", 9, "2025-01-02", { season: 1, episode: 1 }),
  ];
  const metrics = calc(logs, { "tv:9": { episode_runtime_by_key: { "1:1": 42 } } });
  assert.equal(metrics.uniqueEpisodes, 1);
  assert.equal(metrics.rewatches, 1);
  assert.equal(metrics.distinctRewatchedItems, 1);
  assert.equal(metrics.watchMinutes, 84);
});

test("an incomplete regular season does not count as complete; specials are excluded", () => {
  const meta = { "tv:10": { status: "Ended", regular_episode_inventory_complete: true, regular_episodes: [
    { season: 1, episode: 1, released: true }, { season: 1, episode: 2, released: true }, { season: 0, episode: 1, released: true },
  ] } };
  const incomplete = calc([log("e1", "tv", 10, "2025-01-01", { season: 1, episode: 1 })], meta);
  assert.equal(incomplete.completedSeasons, 0);
  const complete = calc([
    log("e1", "tv", 10, "2025-01-01", { season: 1, episode: 1 }),
    log("e2", "tv", 10, "2025-01-02", { season: 1, episode: 2 }),
  ], meta);
  assert.equal(complete.completedSeasons, 1);
  assert.equal(complete.completedEndedSeries, 1);
});

test("an ongoing series cannot qualify as a completed series", () => {
  const logs = [log("e1", "tv", 10, "2025-01-01", { season: 1, episode: 1 })];
  const metrics = calc(logs, { "tv:10": { status: "Returning Series", regular_episode_inventory_complete: true, regular_episodes: [{ season: 1, episode: 1, released: true }] } });
  assert.equal(metrics.completedSeasons, 1);
  assert.equal(metrics.completedEndedSeries, 0);
});

test("missing metadata never fabricates genres, dates, countries, episode completions, or low-vote status", () => {
  const logs = [log("m", "movie", 3), log("e", "tv", 4, "2025-01-02", { season: 1, episode: 1 })];
  const metrics = calc(logs);
  assert.equal(metrics.genres, 0);
  assert.equal(metrics.countries, 0);
  assert.equal(metrics.releaseYears, 0);
  assert.equal(metrics.completedSeasons, 0);
  assert.equal(metrics.lowVoteTitles, 0);
  assert.equal(metrics.watchMinutes, 0);
});

test("historical imports count toward movie collections but not recurring activity", () => {
  const imported = Array.from({ length: 3 }, (_, index) => log(`i${index}`, "movie", index + 1, `2020-0${index + 1}-01`, { imported_from_csv: true }));
  const metrics = calc(imported, {}, user("2018-01-01T00:00:00.000Z"), new Date("2026-01-01T00:00:00.000Z"));
  assert.equal(metrics.uniqueMovies, 3);
  assert.equal(metrics.consecutiveActiveMonths, 0);
  assert.equal(metrics.immortalMembershipYears, 0);
});

test("rewatches add watch time without inflating unique movies", () => {
  const logs = [log("m1", "movie", 1), log("m2", "movie", 1, "2025-01-02")];
  const metrics = calc(logs, { "movie:1": { runtime: 110 } });
  assert.equal(metrics.uniqueMovies, 1);
  assert.equal(metrics.watchMinutes, 220);
  assert.equal(metrics.rewatches, 1);
});

test("deleting a log removes its derived progress on the next calculation", () => {
  const one = log("m1", "movie", 1);
  assert.equal(calc([one]).uniqueMovies, 1);
  assert.equal(calc([]).uniqueMovies, 0);
});

test("membership eligibility delays unlocks even after the progress condition is met", () => {
  const metrics = Object.fromEntries(HONOUR_DEFINITIONS.map((item) => [item.metric, item.target]));
  const before = evaluateHonours(metrics, "2025-12-30T00:00:00.000Z", new Date("2025-12-31T00:00:00.000Z"));
  assert.equal(before.find((item) => item.id === "01").unlocked, true);
  assert.equal(before.find((item) => item.id === "50").unlocked, false);
  assert.equal(before.find((item) => item.id === "50").eligible, false);
});

test("contrarian ratings require 500 votes and use Canisterr's category thresholds", () => {
  const logs = [
    log("bad", "movie", 1, "2025-01-01", { reaction: 0 }),
    log("good", "movie", 2, "2025-01-01", { reaction: 2 }),
    log("few", "movie", 3, "2025-01-01", { reaction: 0 }),
  ];
  const metadata = {
    "movie:1": { vote_count: 500, vote_average: 7.5 },
    "movie:2": { vote_count: 700, vote_average: 5 },
    "movie:3": { vote_count: 499, vote_average: 9 },
  };
  assert.equal(calc(logs, metadata).contrarianRatings, 2);
});

test("The Immortal uses the annual movie/episode equivalence formula", () => {
  const joined = new Date("2020-01-01T00:00:00.000Z");
  const logs = [];
  let index = 0;
  for (let year = 0; year < 5; year += 1) {
    const date = `${2020 + year}-06-01`;
    for (let movie = 0; movie < 25; movie += 1) logs.push(log(`m${index++}`, "movie", year * 100 + movie + 1, date));
    for (let episode = 0; episode < 50; episode += 1) logs.push(log(`e${index++}`, "tv", year + 1, date, { season: 1 + Math.floor(episode / 20), episode: episode % 20 + 1 }));
  }
  const metrics = calc(logs, {}, user(joined.toISOString()), new Date("2026-01-01T00:00:00.000Z"));
  assert.equal(metrics.immortalMembershipYears, 5);
});
