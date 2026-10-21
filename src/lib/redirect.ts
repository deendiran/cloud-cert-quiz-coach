/** Sanitize a same-origin redirect path coming from the URL. */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback = "/practise"
): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
