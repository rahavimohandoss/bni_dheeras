"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** The page's origin (e.g. https://app.example.com); empty during server render. */
export function useOrigin(): string {
  return useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );
}
