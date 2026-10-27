"use client";

/** Verify console demo client. The console id lives in localStorage and is sent as x-console-id. */
export interface ConsoleSession { consoleId: string; institution: string; institutionLabel: string; reviewer: string }

const KEY = "verify.console";
const CHANGED = "verify-console-changed";
/** The stored sign-in as text ("" when signed out), for useSyncExternalStore. */
export function consoleSnapshot(): string { try { return window.localStorage.getItem(KEY) ?? ""; } catch { return ""; } }
export function subscribeConsole(cb: () => void) {
  window.addEventListener(CHANGED, cb); window.addEventListener("storage", cb);
  return () => { window.removeEventListener(CHANGED, cb); window.removeEventListener("storage", cb); };
}
export function parseConsole(raw: string): ConsoleSession | null { try { return raw ? (JSON.parse(raw) as ConsoleSession) : null; } catch { return null; } }
export function getConsole(): ConsoleSession | null { return parseConsole(consoleSnapshot()); }
export function saveConsole(s: ConsoleSession) { try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* demo still works for this page view */ } window.dispatchEvent(new Event(CHANGED)); }
export function clearConsole() { try { window.localStorage.removeItem(KEY); } catch { /* nothing to clear */ } window.dispatchEvent(new Event(CHANGED)); }

export class ConsoleApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const id = getConsole()?.consoleId;
  const res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), ...(id ? { "x-console-id": id } : {}), ...(init.body ? { "Content-Type": "application/json" } : {}) } });
  const data = await res.json().catch(() => ({}));
  // A desk that expired (or never existed) means signing in again, so drop the stale id and the shell sends the user back.
  if (res.status === 401 && id) clearConsole();
  if (!res.ok) throw new ConsoleApiError((data as { error?: string }).error || `Request failed (${res.status})`, res.status, (data as { code?: string }).code);
  return data as T;
}

export const vapi = {
  signIn: (institution: string) => call<ConsoleSession>("/api/console/session", { method: "POST", body: JSON.stringify({ institution, consoleId: getConsole()?.consoleId }) }),
  signOut: () => call<{ ok: true }>("/api/console/session", { method: "DELETE" }),
  get: <T,>(url: string) => call<T>(url),
  post: <T,>(url: string, body?: unknown) => call<T>(url, { method: "POST", body: JSON.stringify(body ?? {}) }),
  /** The CSV needs the console header too, so it is fetched and saved as a file rather than linked. */
  async downloadCsv() {
    const id = getConsole()?.consoleId;
    const res = await fetch("/api/console/audit?format=csv", { headers: id ? { "x-console-id": id } : {} });
    if (!res.ok) throw new ConsoleApiError("Could not export the audit trail.", res.status);
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: "verify-audit.csv" });
    document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  },
};
