export type AuthActionMode =
  | "verifyEmail"
  | "resetPassword"
  | "verifyAndChangeEmail"
  | "recoverEmail"
  | "revertSecondFactorAddition";

export const AUTH_ACTION_OPERATIONS: Partial<Record<AuthActionMode, string>> = {
  verifyEmail: "VERIFY_EMAIL",
  verifyAndChangeEmail: "VERIFY_AND_CHANGE_EMAIL",
  recoverEmail: "RECOVER_EMAIL",
  revertSecondFactorAddition: "REVERT_SECOND_FACTOR_ADDITION",
};

const ACTION_MODES = new Set<AuthActionMode>([
  "verifyEmail",
  "resetPassword",
  "verifyAndChangeEmail",
  "recoverEmail",
  "revertSecondFactorAddition",
]);

export function isAuthActionMode(value: string | null): value is AuthActionMode {
  return value !== null && ACTION_MODES.has(value as AuthActionMode);
}

export function getAuthActionRequestError(
  mode: string | null,
  code: string,
  apiKey: string,
  expectedApiKey: string,
): "invalid" | null {
  if (!isAuthActionMode(mode) || !code || !apiKey || !expectedApiKey || apiKey !== expectedApiKey) {
    return "invalid";
  }
  return null;
}

export function sanitizeAuthContinuation(raw: string | null, currentOrigin: string): string {
  if (!raw) return "/dashboard";
  if (raw.includes("\\") || raw.startsWith("//")) return "/dashboard";
  try {
    const url = new URL(raw, currentOrigin);
    const isCanisterr = url.origin === "https://canisterr.com" || url.origin === "https://www.canisterr.com";
    const isLocal = ["localhost", "127.0.0.1"].includes(url.hostname) && url.origin === currentOrigin;
    if ((!isCanisterr && !isLocal) || url.username || url.password || url.pathname.startsWith("/auth/action") || url.pathname.includes("\\")) {
      return "/dashboard";
    }
    return url.pathname.startsWith("/") && !url.pathname.startsWith("//") ? url.pathname : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export function getAuthActionFailureView(code: string): "expired" | "error" | "invalid" {
  if (["auth/expired-action-code", "auth/invalid-action-code", "auth/user-disabled", "auth/invalid-api-key"].includes(code)) return "expired";
  if (["auth/network-request-failed", "auth/too-many-requests", "auth/internal-error"].includes(code)) return "error";
  return "invalid";
}

export function getPasswordResetValidationError(password: string, confirmation: string): string | null {
  if (password.length < 6 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Use at least 6 characters, including a letter and a number.";
  }
  if (password !== confirmation) return "Those passwords do not match.";
  return null;
}
