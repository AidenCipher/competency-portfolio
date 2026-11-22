/** Only allow same-site relative paths as post-login targets (blocks open redirects). */
export function safeNext(value: string | null | undefined, fallback = "/app"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\r\n\t]/.test(value)) return fallback;
  return value;
}
