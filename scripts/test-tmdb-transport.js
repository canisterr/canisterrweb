/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadSource(relativePath) {
  const file = path.resolve(__dirname, relativePath);
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = new Module(file, module);
  loaded._compile(source, file);
  return loaded.exports;
}

function loadTransport() {
  process.env.TMDB_API_KEY = "test-only-key";
  return loadSource("../src/lib/tmdb-transport.ts");
}

test("identical requests share one upstream call and later hit cache", async () => {
  const originalFetch = global.fetch;
  let upstreamCalls = 0;
  global.fetch = async () => {
    upstreamCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return Response.json({ id: 1 });
  };
  try {
    const { fetchTmdb } = loadTransport();
    const responses = await Promise.all(Array.from({ length: 20 }, () => fetchTmdb("movie/1")));
    assert.equal(upstreamCalls, 1);
    assert.equal(responses.filter((response) => response.headers.get("x-tmdb-cache") === "coalesced").length, 19);
    assert.deepEqual(await responses[0].json(), { id: 1 });
    assert.equal((await fetchTmdb("movie/1")).headers.get("x-tmdb-cache"), "hit");
    assert.equal(upstreamCalls, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test("upstream work is bounded to eight concurrent calls", async () => {
  const originalFetch = global.fetch;
  let active = 0;
  let peak = 0;
  global.fetch = async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active -= 1;
    return Response.json({ ok: true });
  };
  try {
    const { fetchTmdb } = loadTransport();
    await Promise.all(Array.from({ length: 24 }, (_, index) => fetchTmdb(`movie/${index + 1000}`)));
    assert.equal(peak, 8);
  } finally {
    global.fetch = originalFetch;
  }
});

test("429 is temporarily cached without retries", async () => {
  const originalFetch = global.fetch;
  let upstreamCalls = 0;
  global.fetch = async () => {
    upstreamCalls += 1;
    return Response.json({ status_message: "rate limited" }, { status: 429, headers: { "retry-after": "10" } });
  };
  try {
    const { fetchTmdb } = loadTransport();
    assert.equal((await fetchTmdb("movie/777")).status, 429);
    assert.equal((await fetchTmdb("movie/777")).status, 429);
    assert.equal((await fetchTmdb("movie/778")).status, 429);
    assert.equal(upstreamCalls, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test("cache lifetimes match endpoint freshness", () => {
  const { getTmdbCacheTtlSeconds } = loadTransport();
  assert.equal(getTmdbCacheTtlSeconds("trending/movie/day"), 3600);
  assert.equal(getTmdbCacheTtlSeconds("movie/popular"), 21600);
  assert.equal(getTmdbCacheTtlSeconds("movie/550"), 86400);
  assert.equal(getTmdbCacheTtlSeconds("genre/movie/list"), 604800);
  assert.equal(getTmdbCacheTtlSeconds("search/movie"), 300);
  assert.equal(getTmdbCacheTtlSeconds("search/multi"), 21600);
});

test("the browser proxy rejects unknown paths, credentials, and unsupported appends", () => {
  const { validateTmdbProxyRequest } = loadSource("../src/lib/tmdb-proxy-policy.ts");
  assert.equal(validateTmdbProxyRequest("movie/550", new URLSearchParams("append_to_response=credits,videos")), null);
  assert.equal(validateTmdbProxyRequest("configuration", new URLSearchParams()), "Unsupported TMDB endpoint");
  assert.equal(validateTmdbProxyRequest("movie/550", new URLSearchParams("api_key=bad")), "Unsupported TMDB parameter");
  assert.equal(validateTmdbProxyRequest("movie/550", new URLSearchParams("append_to_response=external_ids")), "Unsupported appended endpoint");
});
