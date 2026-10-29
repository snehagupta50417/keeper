import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

/** PUBLIC_DEMO=1 opens a hosted deployment to anyone: no sign-in, each browser keeps its own synthetic workspace. */
export const authRequired = () => process.env.PUBLIC_DEMO !== "1" && (process.env.AUTH_MODE === "supabase" || process.env.NODE_ENV === "production");
export function authConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try { if (new URL(url).protocol !== "https:") return null; } catch { return null; }
  return { url, key };
}
export const appOrigin = () => new URL(process.env.PUBLIC_APP_URL || "http://localhost:3000").origin;
export function cookies(req: Request): Record<string, string> {
  return Object.fromEntries((req.headers.get("cookie") || "").split(";").map(s => {
    const i = s.indexOf("="); return i < 0 ? [] : [s.slice(0, i).trim(), s.slice(i + 1)];
  }).filter(pair => pair.length === 2));
}
export function cookie(name: string, value: string, age: number, path = "/api") {
  return `${name}=${value}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${age}${appOrigin().startsWith("https:") ? "; Secure" : ""}`;
}
export const accessToken = (req: Request) => req.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1] || cookies(req).keeper_access;
export function sameOrigin(req: Request) { return req.headers.get("origin") === appOrigin(); }
export async function authFetch(path: string, init: RequestInit = {}) {
  const config = authConfig(); if (!config) throw new Error("Authentication is not configured");
  return fetch(config.url + "/auth/v1/" + path, { ...init, signal: AbortSignal.timeout(8000),
    headers: { apikey: config.key, "content-type": "application/json", ...init.headers } });
}
export async function verifiedUser(token?: string): Promise<{ id: string } | null> {
  if (!token || token.length > 8192 || !authConfig()) return null;
  try {
    const res = await authFetch("user", { headers: { authorization: `Bearer ${token}` } });
    if (res.status >= 500 || res.status === 429) throw new Error("Authentication provider is temporarily unavailable");
    if (!res.ok) return null;
    const user = await res.json();
    return typeof user.id === "string" && /^[0-9a-f-]{36}$/i.test(user.id) ? { id: user.id } : null;
  } catch (error) { throw new Error("Authentication provider is temporarily unavailable", { cause: error }); }
}
export const makePkce = () => {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url"), state: randomBytes(24).toString("base64url") };
};
export const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function sessionCookies(headers: Headers, tokens: { access_token: string; refresh_token: string; expires_in?: number }) {
  headers.append("set-cookie", cookie("keeper_access", tokens.access_token, Math.min(tokens.expires_in || 3600, 3600)));
  headers.append("set-cookie", cookie("keeper_refresh", tokens.refresh_token, 60 * 60 * 24 * 30, "/api/auth"));
}
export function clearAuthCookies(headers: Headers) {
  headers.append("set-cookie", cookie("keeper_access", "", 0));
  headers.append("set-cookie", cookie("keeper_refresh", "", 0, "/api/auth"));
  headers.append("set-cookie", cookie("keeper_pkce", "", 0, "/api/auth"));
}
