/**
 * "Install the app" state for useSyncExternalStore. Imported by the app shell
 * so the browser's install offer (`beforeinstallprompt`, Chrome/Edge/Samsung
 * on Android) is caught on whichever page fires it; Home shows the button.
 */

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * - installed: running as the installed app (or just installed): show nothing.
 * - prompt: the browser can install it with one tap.
 * - ios: iPhone/iPad, where it's Share → Add to Home Screen.
 * - manual: another phone browser; install from its menu.
 * - hidden: a computer, or not known yet (server render).
 */
export type InstallState = "installed" | "prompt" | "ios" | "manual" | "hidden";

let deferred: InstallPromptEvent | null = null;
let justInstalled = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // Home shows our own button instead of the browser's banner.
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    justInstalled = true;
    deferred = null;
    emit();
  });
}

function isIos() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function getInstallState(): InstallState {
  if (justInstalled || isStandalone()) return "installed";
  if (deferred) return "prompt";
  if (isIos()) return "ios";
  if (/Android|Mobile/i.test(navigator.userAgent)) return "manual";
  return "hidden";
}

export const getServerInstallState = (): InstallState => "hidden";

export function subscribeInstall(onChange: () => void) {
  listeners.add(onChange);
  const standalone = window.matchMedia?.("(display-mode: standalone)");
  standalone?.addEventListener("change", onChange);
  return () => {
    listeners.delete(onChange);
    standalone?.removeEventListener("change", onChange);
  };
}

/** Opens the browser's install dialog. True if the person accepted. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  deferred = null; // the event can only be used once
  emit();
  await e.prompt();
  return (await e.userChoice).outcome === "accepted";
}
