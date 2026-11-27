/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const file = path.resolve(__dirname, "../src/lib/list-access-filter.ts");
const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = new Module(file, module);
loaded._compile(source, file);
const { filterListDataForViewer } = loaded.exports;

const lists = {
  public: { id: "public", privacy: "public", owner_id: "owner" },
  private: { id: "private", privacy: "private", owner_id: "owner", collaborator_ids: { friend: true } },
  legacy: { id: "legacy", privacy: "private", owner_id: "owner" },
  revoked: { id: "revoked", privacy: "private", owner_id: "owner", collaborator_ids: { owner: true } },
};
const items = Object.fromEntries(Object.keys(lists).map((id) => [id, { id, list_id: id }]));
const collaborators = {
  friend: { id: "friend", list_id: "private", user_id: "friend" },
  legacyFriend: { id: "legacyFriend", list_id: "legacy", user_id: "friend" },
  revokedFriend: { id: "revokedFriend", list_id: "revoked", user_id: "friend" },
};

test("private lists and their items are hidden from nonmembers", () => {
  const data = filterListDataForViewer("stranger", lists, items, collaborators);
  assert.deepEqual(Object.keys(data.lists), ["public"]);
  assert.deepEqual(Object.keys(data.items), ["public"]);
  assert.deepEqual(Object.keys(data.collaborators), []);
});

test("owners and collaborators can see private lists", () => {
  const ownerData = filterListDataForViewer("owner", lists, items, collaborators);
  const friendData = filterListDataForViewer("friend", lists, items, collaborators);
  assert.deepEqual(Object.keys(ownerData.lists), ["public", "private", "legacy", "revoked"]);
  assert.deepEqual(Object.keys(friendData.lists), ["public", "private", "legacy"]);
  assert.deepEqual(Object.keys(friendData.items), ["public", "private", "legacy"]);
});
