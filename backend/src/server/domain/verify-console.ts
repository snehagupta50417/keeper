import { db } from "@server/db";
import { authRequired } from "@server/core/supabase-auth";
import { FIXTURES, INSTITUTIONS, type InstitutionKey } from "@server/data/verify/claims";
import { runChecks, type CheckDoc } from "@server/rules/verify-checks";
import {
  CHECKS, CHECK_LABEL, DUE_SOON_DAYS, INCOMPLETE_TEXT, RISK_LABEL, ROUTE_LABEL, ROUTE_REQUIREMENTS, DOC_LABEL, daysRemaining, rate,
  CLAIM_WINDOW_DAYS, type CheckKey, type CheckResult, type ClaimRoute, type RiskLevel,
} from "@shared/verify-rules";
import {
  ESCALATION_LABEL, STATUS_LABEL, type ClaimDetail, type ClaimSource, type DecisionBody, type DocView, type QueueRow, type QueueView,
  type RunView, type TimelineEvent, type VerifyStatus,
} from "@shared/verify-view";

/**
 * The Verify console, demo only. Synthetic claims, one private copy per console sign-in. The risk rating comes from
 * fixed rules (shared/verify-rules.ts); a person makes every decision, and the audit trail records all of it.
 */

/**
 * On by default locally. Where real sign-in is required (hosted) it stays off unless CONSOLE_DEMO=public is set on
 * purpose, to run a public demo of synthetic data only. CONSOLE_DEMO=0 turns it off everywhere.
 */
export const consoleEnabled = () => process.env.CONSOLE_DEMO !== "0" && (process.env.CONSOLE_DEMO === "public" || !authRequired());

/** A public demo must not grow without bound: desks expire after a day and the number of desks is capped. */
const DESK_TTL_MS = 24 * 3_600_000;
const MAX_DESKS = 200;

export class ConsoleError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

const DAY = 86_400_000;
const json = <T,>(raw: string | null | undefined, fallback: T): T => { try { return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; } };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const dupKey = (c: { deceasedName: string; productLast4: string; institution: string }) => `${norm(c.deceasedName)}|${c.productLast4}|${c.institution}`;
const isOpen = (s: string) => s === "awaiting_review" || s === "documents_requested";

export async function signIn(id: string, institution: InstitutionKey) {
  const info = INSTITUTIONS[institution];
  await db.verifyConsole.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - DESK_TTL_MS) } } });
  if (!(await db.verifyConsole.findUnique({ where: { id } })) && (await db.verifyConsole.count()) >= MAX_DESKS) {
    throw new ConsoleError(503, "demo_busy", "The demo is busy right now. Please try again in a few minutes.");
  }
  const console = await db.verifyConsole.upsert({ where: { id }, update: { institution, reviewer: info.reviewer }, create: { id, institution, reviewer: info.reviewer } });
  if (!(await db.verifyClaim.count({ where: { consoleId: id } }))) await seed(id);
  return console;
}

export async function seed(consoleId: string, now = new Date()) {
  for (const f of FIXTURES) {
    const receivedAt = new Date(now.getTime() - f.receivedDaysAgo * DAY - 3 * 3_600_000);
    const claim = await db.verifyClaim.create({
      data: {
        consoleId, key: f.key, code: f.code, institution: f.institution, deceasedName: f.deceasedName, claimantName: f.claimantName,
        relationship: f.relationship, contactMasked: f.contactMasked, productLabel: f.productLabel, productLast4: f.productLast4,
        amountMin: f.amountMin, amountMax: f.amountMax, route: f.route, source: f.source, receivedAt,
        documents: { create: f.docs.map((d) => ({ kind: d.kind, title: d.title, issuer: d.issuer, fields: JSON.stringify(d.fields), signals: JSON.stringify(d.signals ?? []), readable: d.readable ?? true })) },
      },
    });
    await db.verifyEvent.create({ data: { consoleId, claimId: claim.id, kind: "received", actor: "system", note: f.receipt, createdAt: receivedAt } });
  }
}

/** Start the demo over: every claim, check run and audit entry is replaced by a fresh copy. */
export async function reset(consoleId: string) {
  await db.verifyClaim.deleteMany({ where: { consoleId } });
  await seed(consoleId);
}

type ClaimWithRun = Awaited<ReturnType<typeof loadClaims>>[number];
const loadClaims = (consoleId: string) => db.verifyClaim.findMany({ where: { consoleId }, include: { runs: { orderBy: { createdAt: "desc" }, take: 1 } } });

function rowOf(c: ClaimWithRun, dupes: Map<string, ClaimWithRun[]>, now: Date): QueueRow {
  const left = daysRemaining(c.receivedAt, now);
  const risk = (c.runs[0]?.riskLevel as RiskLevel | undefined) ?? "not_checked";
  return {
    id: c.id, code: c.code, deceasedName: c.deceasedName, claimantName: c.claimantName, relationship: c.relationship, institution: c.institution,
    productLabel: c.productLabel, productLast4: c.productLast4, receivedAt: c.receivedAt.toISOString(), daysRemaining: left, dueSoon: isOpen(c.status) && left <= DUE_SOON_DAYS,
    risk, status: c.status as VerifyStatus, source: c.source as ClaimSource,
    duplicateOf: (dupes.get(dupKey(c)) ?? []).filter((o) => o.id !== c.id).map((o) => o.code),
  };
}

function groupDuplicates(claims: ClaimWithRun[]) {
  const map = new Map<string, ClaimWithRun[]>();
  for (const c of claims) map.set(dupKey(c), [...(map.get(dupKey(c)) ?? []), c]);
  return map;
}

/** Most urgent first; claims for the same deceased and product stay together, at the position of the most urgent one. */
function cluster(rows: QueueRow[], group: (r: QueueRow) => string): QueueRow[] {
  const placed = new Set<string>();
  const out: QueueRow[] = [];
  for (const r of rows) {
    if (placed.has(r.id)) continue;
    placed.add(r.id); out.push(r);
    if (r.duplicateOf.length) for (const o of rows) if (!placed.has(o.id) && group(o) === group(r)) { placed.add(o.id); out.push(o); }
  }
  return out;
}

export async function queue(consoleId: string, now = new Date()): Promise<QueueView> {
  const console = await db.verifyConsole.findUniqueOrThrow({ where: { id: consoleId } });
  const claims = await loadClaims(consoleId);
  const dupes = groupDuplicates(claims);
  const rows = claims.map((c) => rowOf(c, dupes, now));
  const group = (r: QueueRow) => { const c = claims.find((x) => x.id === r.id)!; return dupKey(c); };
  const open = rows.filter((r) => isOpen(r.status)).sort((a, b) => a.daysRemaining - b.daysRemaining || a.receivedAt.localeCompare(b.receivedAt));
  const closed = rows.filter((r) => !isOpen(r.status)).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const decided = claims.filter((c) => c.decidedAt);
  const avg = decided.length ? decided.reduce((s, c) => s + (c.decidedAt!.getTime() - c.receivedAt.getTime()) / DAY, 0) / decided.length : null;
  return {
    console: { institution: console.institution, institutionLabel: INSTITUTIONS[console.institution as InstitutionKey]?.label ?? console.institution, reviewer: console.reviewer },
    claims: [...cluster(open, group), ...cluster(closed, group)],
    tiles: {
      awaitingReview: rows.filter((r) => r.status === "awaiting_review").length,
      highRisk: rows.filter((r) => r.risk === "high" && r.status !== "approved").length,
      dueSoon: rows.filter((r) => r.dueSoon).length,
      avgDecisionDays: avg === null ? null : Math.round(avg * 10) / 10,
    },
  };
}

function runView(run: { id: string; createdAt: Date; results: string }): RunView {
  const results = json<CheckResult[]>(run.results, []);
  return { id: run.id, createdAt: run.createdAt.toISOString(), rating: rate(results), results };
}
const eventView = (e: { id: string; kind: string; actor: string; note: string; meta: string; createdAt: Date }): TimelineEvent => ({ id: e.id, kind: e.kind, actor: e.actor, note: e.note, createdAt: e.createdAt.toISOString(), meta: json<Record<string, unknown>>(e.meta, {}) });

async function ownClaim(consoleId: string, claimId: string) {
  const claim = await db.verifyClaim.findFirst({ where: { id: claimId, consoleId }, include: { documents: true, runs: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!claim) throw new ConsoleError(404, "not_found", "Claim not found.");
  return claim;
}

export async function detail(consoleId: string, claimId: string, now = new Date()): Promise<ClaimDetail> {
  const claim = await ownClaim(consoleId, claimId);
  const all = await loadClaims(consoleId);
  const row = rowOf(all.find((c) => c.id === claim.id)!, groupDuplicates(all), now);
  const documents: DocView[] = claim.documents.map((d) => ({ id: d.id, kind: d.kind as DocView["kind"], title: d.title, issuer: d.issuer, fields: json(d.fields, []), signals: json(d.signals, []), readable: d.readable }));
  const have = new Set(documents.map((d) => d.kind));
  const events = await db.verifyEvent.findMany({ where: { claimId }, orderBy: { createdAt: "asc" } });
  return {
    claim: { ...row, contactMasked: claim.contactMasked, amountMin: claim.amountMin, amountMax: claim.amountMax, route: claim.route as ClaimRoute, routeLabel: ROUTE_LABEL[claim.route as ClaimRoute],
      dueAt: new Date(claim.receivedAt.getTime() + CLAIM_WINDOW_DAYS * DAY).toISOString(), decidedAt: claim.decidedAt?.toISOString() ?? null },
    documents,
    requiredDocuments: ROUTE_REQUIREMENTS[claim.route as ClaimRoute].map((kind) => ({ kind, label: DOC_LABEL[kind], present: have.has(kind) })),
    latestRun: claim.runs[0] ? runView(claim.runs[0]) : null,
    timeline: events.map(eventView),
  };
}

/** Run all four checks, rate the claim by the fixed rules, and record both in the audit trail. */
export async function runClaimChecks(consoleId: string, claimId: string, reviewer: string, simulateFailure?: CheckKey): Promise<RunView> {
  const claim = await ownClaim(consoleId, claimId);
  const others = await db.verifyClaim.findMany({ where: { consoleId } });
  const docs: CheckDoc[] = claim.documents.map((d) => ({ id: d.id, kind: d.kind as CheckDoc["kind"], title: d.title, fields: json(d.fields, []), signals: json(d.signals, []), readable: d.readable }));
  const results = runChecks(
    { id: claim.id, code: claim.code, route: claim.route as ClaimRoute, deceasedName: claim.deceasedName, productLast4: claim.productLast4, institution: claim.institution, receivedAt: claim.receivedAt },
    docs,
    others.map((o) => ({ id: o.id, code: o.code, claimantName: o.claimantName, deceasedName: o.deceasedName, productLast4: o.productLast4, institution: o.institution, receivedAt: o.receivedAt })),
    { simulateFailure },
  );
  const rating = rate(results);
  const run = await db.verifyCheckRun.create({ data: { claimId, riskLevel: rating.level, riskRule: rating.rule, explanation: rating.explanation, results: JSON.stringify(results) } });
  const statuses = Object.fromEntries(results.map((r) => [r.check, r.status]));
  await db.verifyEvent.create({ data: { consoleId, claimId, kind: "checks_run", actor: reviewer, note: rating.explanation, meta: JSON.stringify({ level: rating.level, statuses }) } });
  const unfinished = results.filter((r) => r.status === "incomplete");
  if (unfinished.length) {
    await db.verifyEvent.create({ data: { consoleId, claimId, kind: "checks_incomplete", actor: "system", note: `${INCOMPLETE_TEXT}: ${unfinished.map((r) => CHECK_LABEL[r.check]).join(", ")}.`, meta: JSON.stringify({ checks: unfinished.map((r) => r.check) }) } });
  }
  return runView(run);
}

const need = (cond: boolean, status: number, code: string, message: string) => { if (!cond) throw new ConsoleError(status, code, message); };
const long = (s: string | undefined, n: number) => (s ?? "").trim().length >= n;

/** A reviewer's decision. The server enforces the safeguards, so they hold whatever the screen does. */
export async function decide(consoleId: string, claimId: string, reviewer: string, body: DecisionBody, now = new Date()) {
  const claim = await ownClaim(consoleId, claimId);
  need(isOpen(claim.status), 409, "already_decided", `This claim is already ${STATUS_LABEL[claim.status as VerifyStatus].toLowerCase()}.`);
  const level = (claim.runs[0]?.riskLevel as RiskLevel | undefined) ?? "not_checked";
  const note = (body.note ?? "").trim();
  let status: VerifyStatus, kind: string, text: string, meta: Record<string, unknown> = { riskAtDecision: level };

  if (body.action === "approve") {
    need(level !== "not_checked", 409, "checks_required", "Run the checks before approving. A claim that has not been rated cannot be approved.");
    if (level === "high") need(body.acknowledged === true && long(note, 15), 400, "justification_required", "This claim is High risk. Confirm you have read the warning and write why you are approving it (at least 15 characters).");
    status = "approved"; kind = "approved"; text = note ? `Approved (${RISK_LABEL[level]}). ${note}` : `Approved (${RISK_LABEL[level]}).`;
    meta = { ...meta, acknowledged: !!body.acknowledged };
  } else if (body.action === "escalate") {
    need(!!body.reason && body.reason in ESCALATION_LABEL, 400, "reason_required", "Choose a reason for escalating.");
    need(long(note, 10), 400, "note_required", "Add a note explaining the escalation (at least 10 characters).");
    if (level === "low") need(body.acknowledged === true && long(note, 15), 400, "justification_required", "This claim is Low risk. Confirm you have read the warning and write why you are escalating it (at least 15 characters).");
    status = "escalated"; kind = "escalated"; text = `Escalated: ${ESCALATION_LABEL[body.reason!]}. ${note}`;
    meta = { ...meta, reason: body.reason, acknowledged: !!body.acknowledged };
  } else {
    need(!!body.documents?.length, 400, "documents_required", "Choose at least one document to request.");
    need(long(body.message, 10), 400, "message_required", "Write the message to the claimant.");
    status = "documents_requested"; kind = "documents_requested";
    text = `Requested ${body.documents!.map((k) => DOC_LABEL[k].toLowerCase()).join(", ")}. Simulated: no message was sent.`;
    meta = { ...meta, documents: body.documents, message: body.message!.trim(), simulated: true };
  }

  await db.verifyClaim.update({ where: { id: claimId }, data: { status, decidedAt: status === "documents_requested" ? null : now } });
  await db.verifyEvent.create({ data: { consoleId, claimId, kind, actor: reviewer, note: text, meta: JSON.stringify(meta), createdAt: now } });
  const all = await loadClaims(consoleId);
  return rowOf(all.find((c) => c.id === claimId)!, groupDuplicates(all), now);
}

export interface AuditRow { id: string; claimCode: string; kind: string; actor: string; note: string; createdAt: string }
export async function audit(consoleId: string, filter: { claim?: string; kind?: string } = {}): Promise<AuditRow[]> {
  const events = await db.verifyEvent.findMany({ where: { consoleId, ...(filter.kind ? { kind: filter.kind } : {}), ...(filter.claim ? { claim: { code: filter.claim } } : {}) }, include: { claim: { select: { code: true } } }, orderBy: { createdAt: "desc" }, take: 500 });
  return events.map((e) => ({ id: e.id, claimCode: e.claim.code, kind: e.kind, actor: e.actor, note: e.note, createdAt: e.createdAt.toISOString() }));
}

/** CSV for the audit export. A leading = + - or @ is neutralised so a spreadsheet cannot run it as a formula. */
export function auditCsv(rows: AuditRow[]): string {
  const cell = (v: string) => { const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v; return `"${safe.replace(/"/g, '""')}"`; };
  return ["Time,Claim,Event,By,Note", ...rows.map((r) => [r.createdAt, r.claimCode, r.kind, r.actor, r.note].map(cell).join(","))].join("\r\n");
}

export { CHECKS };
