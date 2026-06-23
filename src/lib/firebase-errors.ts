export function isPermissionDeniedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /permission/i.test(message) && /denied/i.test(message);
}
