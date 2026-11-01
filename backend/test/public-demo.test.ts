import { afterEach, expect, it, vi } from "vitest";
import { authRequired } from "@server/core/supabase-auth";
import { requireSession } from "@server/core/session";

afterEach(() => vi.unstubAllEnvs());

it("hosted mode still requires sign-in unless the public demo is switched on", async () => {
  vi.stubEnv("AUTH_MODE", "supabase");
  expect(authRequired()).toBe(true);
  expect(await requireSession(new Request("http://localhost/api/cases", { headers: { "x-session-id": "browser-session-1" } }))).toBeNull();
  vi.stubEnv("PUBLIC_DEMO", "1");
  expect(authRequired()).toBe(false);
});

it("the public demo gives each browser its own workspace and never accepts a forged account", async () => {
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("PUBLIC_DEMO", "1");
  const asBrowser = (id: string) => requireSession(new Request("http://localhost/api/cases", { headers: { "x-session-id": id } }));
  const one = await asBrowser("browser-session-aaa"), two = await asBrowser("browser-session-bbb");
  expect(one!.id).not.toBe(two!.id);
  expect(await asBrowser("supabase:11111111-1111-1111-1111-111111111111")).toBeNull();
  expect(await requireSession(new Request("http://localhost/api/cases"))).toBeNull();
});

it("the public demo limits how many new workspaces one caller can create a minute", async () => {
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("PUBLIC_DEMO", "1");
  const fresh = (n: number) => requireSession(new Request("http://localhost/api/cases", { headers: { "x-session-id": `flood-session-${crypto.randomUUID()}-${n}`, "x-forwarded-for": "203.0.113.9" } }));
  let refused = 0;
  for (let i = 0; i < 40; i++) if (!(await fresh(i))) refused++;
  expect(refused).toBeGreaterThan(0);
  const known = await requireSession(new Request("http://localhost/api/cases", { headers: { "x-session-id": "browser-session-aaa", "x-forwarded-for": "203.0.113.9" } }));
  expect(known).not.toBeNull(); // a returning browser is never throttled
});
