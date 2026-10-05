import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

export const LOGIN_LINK_TTL_SECONDS = 24 * 60 * 60;

/**
 * Better Auth's magic-link plugin "sends" a link through a callback. We run the
 * sign-in call inside this store, so the callback hands the token back to the
 * admin's request instead of sending anything. Outside a capture, it's ignored.
 */
const store = new AsyncLocalStorage<{ token: string | null }>();

export function captureLoginToken(token: string): void {
  const slot = store.getStore();
  if (slot) slot.token = token;
}

export async function withTokenCapture(fn: () => Promise<unknown>): Promise<string | null> {
  const slot = { token: null as string | null };
  await store.run(slot, fn);
  return slot.token;
}
