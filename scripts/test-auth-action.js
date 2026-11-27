/* eslint @typescript-eslint/no-require-imports: off */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const sourcePath = path.join(__dirname, "../src/lib/auth-action-utils.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exportsObject = {};
new Function("exports", compiled)(exportsObject);

test("accepts the five supported Firebase action modes and rejects other modes", () => {
  for (const mode of ["verifyEmail", "resetPassword", "verifyAndChangeEmail", "recoverEmail", "revertSecondFactorAddition"]) {
    assert.equal(exportsObject.isAuthActionMode(mode), true);
  }
  for (const mode of [null, "", "signIn", "deleteAccount", "VERIFYEMAIL"]) {
    assert.equal(exportsObject.isAuthActionMode(mode), false);
  }
});

test("requires a complete code and the configured Firebase API key", () => {
  assert.equal(exportsObject.getAuthActionRequestError("verifyEmail", "code", "key", "key"), null);
  assert.equal(exportsObject.getAuthActionRequestError("nope", "code", "key", "key"), "invalid");
  assert.equal(exportsObject.getAuthActionRequestError("verifyEmail", "", "key", "key"), "invalid");
  assert.equal(exportsObject.getAuthActionRequestError("verifyEmail", "code", "", "key"), "invalid");
  assert.equal(exportsObject.getAuthActionRequestError("verifyEmail", "code", "attacker-key", "key"), "invalid");
});

test("continuation only accepts Canisterr or same-origin local paths and strips query data", () => {
  const origin = "http://localhost:3000";
  assert.equal(exportsObject.sanitizeAuthContinuation("https://canisterr.com/lists?secret=1#x", origin), "/lists");
  assert.equal(exportsObject.sanitizeAuthContinuation("http://localhost:3000/movie/5?x=1", origin), "/movie/5");
  for (const unsafe of ["https://evil.example/path", "//evil.example/path", "javascript:alert(1)", "https://canisterr.com/auth/action?mode=resetPassword", "https://user:pass@canisterr.com/", "https://canisterr.com\\@evil.example"]) {
    assert.equal(exportsObject.sanitizeAuthContinuation(unsafe, origin), "/dashboard");
  }
  assert.equal(exportsObject.sanitizeAuthContinuation(null, origin), "/dashboard");
});

test("maps Firebase invalid, expired, network, and unexpected failures to safe views", () => {
  assert.equal(exportsObject.getAuthActionFailureView("auth/expired-action-code"), "expired");
  assert.equal(exportsObject.getAuthActionFailureView("auth/invalid-action-code"), "expired");
  assert.equal(exportsObject.getAuthActionFailureView("auth/network-request-failed"), "error");
  assert.equal(exportsObject.getAuthActionFailureView("auth/too-many-requests"), "error");
  assert.equal(exportsObject.getAuthActionFailureView("auth/some-new-error"), "invalid");
});

test("password reset enforces the existing Canisterr password rule and confirmation", () => {
  assert.match(exportsObject.getPasswordResetValidationError("abc", "abc"), /at least 6 characters/);
  assert.match(exportsObject.getPasswordResetValidationError("abcdef", "abcdef"), /letter and a number/);
  assert.match(exportsObject.getPasswordResetValidationError("abc123", "abc124"), /do not match/);
  assert.equal(exportsObject.getPasswordResetValidationError("abc123", "abc123"), null);
});

test("every non-reset mode maps to its expected Firebase operation", () => {
  assert.deepEqual(exportsObject.AUTH_ACTION_OPERATIONS, {
    verifyEmail: "VERIFY_EMAIL",
    verifyAndChangeEmail: "VERIFY_AND_CHANGE_EMAIL",
    recoverEmail: "RECOVER_EMAIL",
    revertSecondFactorAddition: "REVERT_SECOND_FACTOR_ADDITION",
  });
  assert.equal(exportsObject.AUTH_ACTION_OPERATIONS.resetPassword, undefined);
});
