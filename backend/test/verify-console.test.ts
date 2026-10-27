import { expect, it } from "vitest";
import { db } from "@server/db";
import { audit, auditCsv, decide, detail, queue, reset, runClaimChecks, signIn, ConsoleError } from "@server/domain/verify-console";
import * as session from "@api/console/session/route";
import * as queueRoute from "@api/console/queue/route";
import * as decisionRoute from "@api/console/claims/[id]/decision/route";

const newId = () => "console-" + crypto.randomUUID();
const byCode = async (id: string, code: string) => (await queue(id)).claims.find((c) => c.code === code)!;
const status = async (p: Promise<unknown>) => { try { await p; return 200; } catch (e) { if (e instanceof ConsoleError) return e.status; throw e; } };

it("seeds four claims in urgency order with the duplicate pair together", async () => {
  const id = newId(); await signIn(id, "lic");
  const q = await queue(id);
  expect(q.claims.map((c) => c.code)).toEqual(["VER-0391", "VER-0398", "VER-0412", "VER-0415"]);
  expect(q.claims.map((c) => c.daysRemaining)).toEqual([2, 6, 9, 10]);
  expect(q.claims.filter((c) => c.duplicateOf.length).map((c) => c.code)).toEqual(["VER-0412", "VER-0415"]);
  expect(q.tiles).toMatchObject({ awaitingReview: 4, highRisk: 0, dueSoon: 1, avgDecisionDays: null });
  expect(q.claims.every((c) => c.risk === "not_checked")).toBe(true);
});

it("rates the four seeded claims as designed", async () => {
  const id = newId(); await signIn(id, "lic");
  const level = async (code: string) => (await runClaimChecks(id, (await byCode(id, code)).id, "R")).rating.level;
  expect(await level("VER-0412")).toBe("low");
  expect(await level("VER-0415")).toBe("high");
  expect(await level("VER-0398")).toBe("medium");
  expect(await level("VER-0391")).toBe("low");
  const b = await detail(id, (await byCode(id, "VER-0415")).id);
  const flagged = b.latestRun!.results.filter((r) => r.status === "flag").map((r) => r.check).sort();
  expect(flagged).toEqual(["authenticity", "completeness", "consistency", "duplicate"]);
  const date = b.latestRun!.results.find((r) => r.check === "consistency")!.findings[0];
  expect(date.expected).toContain("03 Mar 2026"); expect(date.observed).toContain("12 Mar 2026");
  expect(b.timeline.map((e) => e.kind)).toEqual(["received", "checks_run"]);
});

it("shows incomplete checks as such and refuses to approve an unrated claim", async () => {
  const id = newId(); await signIn(id, "lic");
  const a = (await byCode(id, "VER-0412")).id;
  expect(await status(decide(id, a, "R", { action: "approve" }))).toBe(409);
  const run = await runClaimChecks(id, a, "R", "duplicate");
  expect(run.rating.level).toBe("not_checked");
  expect(run.results.find((r) => r.check === "duplicate")!.summary).toBe("Couldn't complete, review manually");
  expect(await status(decide(id, a, "R", { action: "approve" }))).toBe(409);
  expect((await detail(id, a)).timeline.map((e) => e.kind)).toContain("checks_incomplete");
});

it("enforces the safeguards on the server", async () => {
  const id = newId(); await signIn(id, "lic");
  const b = (await byCode(id, "VER-0415")).id, a = (await byCode(id, "VER-0412")).id, c = (await byCode(id, "VER-0398")).id;
  await runClaimChecks(id, b, "R"); await runClaimChecks(id, a, "R"); await runClaimChecks(id, c, "R");
  expect(await status(decide(id, b, "R", { action: "approve", note: "ok" }))).toBe(400);
  expect(await status(decide(id, b, "R", { action: "approve", acknowledged: true, note: "short" }))).toBe(400);
  expect(await status(decide(id, b, "R", { action: "escalate", note: "Date edited on certificate" }))).toBe(400);
  expect(await status(decide(id, a, "R", { action: "escalate", reason: "suspected_fraud", note: "Looks odd to me, checking" }))).toBe(400);
  expect(await status(decide(id, c, "R", { action: "request_documents", documents: [], message: "Please send it" }))).toBe(400);
  expect(await status(decide(id, c, "R", { action: "request_documents", documents: ["indemnity_form"], message: "Please send the signed indemnity form." }))).toBe(200);
  const sent = (await detail(id, c)).timeline.at(-1)!;
  expect(sent.note).toContain("Simulated"); expect(sent.meta.simulated).toBe(true);
  expect((await byCode(id, "VER-0398")).status).toBe("documents_requested");
});

it("runs the whole demo, twice, with a reset in between", async () => {
  const id = newId(); await signIn(id, "lic");
  for (let round = 0; round < 2; round++) {
    const b = (await byCode(id, "VER-0415")).id, a = (await byCode(id, "VER-0412")).id;
    expect((await runClaimChecks(id, b, "R. Menon")).rating.level).toBe("high");
    await decide(id, b, "R. Menon", { action: "escalate", reason: "suspected_fraud", note: "Date of death edited; duplicate of VER-0412." });
    expect((await runClaimChecks(id, a, "R. Menon")).rating.level).toBe("low");
    await decide(id, a, "R. Menon", { action: "approve" });
    expect(await status(decide(id, a, "R", { action: "approve" }))).toBe(409);
    expect((await detail(id, b)).timeline.map((e) => e.kind)).toEqual(["received", "checks_run", "escalated"]);
    expect((await detail(id, a)).timeline.map((e) => e.kind)).toEqual(["received", "checks_run", "approved"]);
    const q = await queue(id);
    expect(q.tiles.avgDecisionDays).not.toBeNull();
    expect((await audit(id)).length).toBe(8);
    await reset(id);
    expect((await queue(id)).claims.every((c) => c.status === "awaiting_review" && c.risk === "not_checked")).toBe(true);
    expect((await audit(id)).length).toBe(4);
  }
});

it("keeps each console private and guards the API", async () => {
  const one = newId(), two = newId(); await signIn(one, "lic"); await signIn(two, "sbi");
  const claimOfOne = (await byCode(one, "VER-0412")).id;
  expect(await status(detail(two, claimOfOne))).toBe(404);
  const noHeader = await queueRoute.GET(new Request("http://localhost"));
  expect(noHeader.status).toBe(401);
  const bogus = await queueRoute.GET(new Request("http://localhost", { headers: { "x-console-id": "not-a-console-1234" } }));
  expect(bogus.status).toBe(401);
  const bad = await decisionRoute.POST(new Request("http://localhost", { method: "POST", headers: { "x-console-id": one }, body: JSON.stringify({ action: "delete" }) }), { params: Promise.resolve({ id: claimOfOne }) });
  expect(bad.status).toBe(400);
  const res = await session.POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ institution: "sbi" }) }));
  const made = await res.json(); expect(made.reviewer).toContain("Banerjee");
  expect((await db.verifyClaim.count({ where: { consoleId: made.consoleId } }))).toBe(4);
});

it("is off in hosted mode and when switched off", async () => {
  const prev = { mode: process.env.AUTH_MODE, off: process.env.CONSOLE_DEMO };
  try {
    process.env.CONSOLE_DEMO = "0";
    expect((await session.POST(new Request("http://localhost", { method: "POST", body: "{}" }))).status).toBe(404);
    delete process.env.CONSOLE_DEMO; process.env.AUTH_MODE = "supabase";
    expect((await session.POST(new Request("http://localhost", { method: "POST", body: "{}" }))).status).toBe(404);
    // Hosted stays off unless a public demo is chosen on purpose, and "0" still wins over it.
    process.env.CONSOLE_DEMO = "public";
    expect((await session.POST(new Request("http://localhost", { method: "POST", body: "{}" }))).status).toBe(200);
    process.env.CONSOLE_DEMO = "0";
    expect((await session.POST(new Request("http://localhost", { method: "POST", body: "{}" }))).status).toBe(404);
  } finally {
    if (prev.mode === undefined) delete process.env.AUTH_MODE; else process.env.AUTH_MODE = prev.mode;
    if (prev.off === undefined) delete process.env.CONSOLE_DEMO; else process.env.CONSOLE_DEMO = prev.off;
  }
});

it("neutralises spreadsheet formulas in the CSV export", () => {
  const csv = auditCsv([{ id: "1", claimCode: "VER-1", kind: "approved", actor: "R", note: '=HYPERLINK("x")', createdAt: "2026-10-18T00:00:00.000Z" }]);
  expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
});

it("expires old desks and caps how many exist", async () => {
  const old = newId(); await signIn(old, "lic");
  await db.verifyConsole.update({ where: { id: old }, data: { createdAt: new Date(Date.now() - 25 * 3_600_000) } });
  const fresh = newId(); await signIn(fresh, "lic");
  expect(await db.verifyConsole.findUnique({ where: { id: old } })).toBeNull();

  const fillers = Array.from({ length: 220 }, (_, i) => ({ id: `filler-desk-${i}-${crypto.randomUUID()}`, institution: "lic", reviewer: "x" }));
  await db.verifyConsole.createMany({ data: fillers });
  try {
    expect(await status(signIn(newId(), "lic"))).toBe(503);
    expect(await status(signIn(fresh, "lic"))).toBe(200); // an existing desk can always come back
  } finally { await db.verifyConsole.deleteMany({ where: { id: { in: fillers.map((f) => f.id) } } }); }
});
