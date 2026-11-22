"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * `prefers-reduced-motion`, safe for server rendering. The server cannot know the preference, so it (and the
 * hydration render) reports `false`; React then re-renders with the real value. Motion's own `useReducedMotion`
 * returns the real value during hydration, which made the first client render differ from the server HTML
 * (a hydration mismatch) for users with reduced motion on. Components whose *mounted* state depends on this
 * should also `key` on it, so they remount into their reduced (instant) state rather than animating.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
