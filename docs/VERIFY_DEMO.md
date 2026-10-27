# Verify claims console — demo guide

A demo of FL-56 for banks and insurers. Everything is synthetic; no real claim, person, document or message is involved, and nothing is sent anywhere. Locally it is on by default. On a hosted deployment (`AUTH_MODE=supabase` or production) it stays off unless `CONSOLE_DEMO=public` is set on purpose for a public demo; `CONSOLE_DEMO=0` turns it off everywhere. In a public demo each visitor gets a private desk that expires after 24 hours, at most 200 desks exist, and new sign-ins are rate limited.

## Run it

1. `npm run dev` from the repository root (PowerShell: `npm.cmd run dev`).
2. Open `/` and choose "Open the claims console demo", or go to `/verify`.
3. Pick "LIC · Claims desk" and press "Sign in to demo". No password.
4. "Reset demo" in the header restores the four claims and empties the audit trail at any time.

## The four claims

See [`backend/src/server/data/verify/README.md`](../backend/src/server/data/verify/README.md) for the planted discrepancies. In short: A (VER-0412) is clean and Low risk; B (VER-0415) duplicates A, has an edited date of death (12 Mar on the certificate, 03 Mar on the claim form) and no proof of relationship, so it is High risk; C (VER-0398) lacks an indemnity form, Medium; D (VER-0391) is clean and due in 2 days, Low.

## The rating

Fixed rules, never an AI model, shown under "How is this rated?" on every claim.

- **High**: a duplicate claim is flagged, or both authenticity and consistency are flagged.
- **Medium**: any check is flagged, or a required document is missing.
- **Low**: all four checks pass.
- **Not checked**: the checks have not all completed. An unfinished check shows "Couldn't complete, review manually", never a pass, and the claim cannot be approved until it is rated.

Anomalies are signals to look at, not proof. A person approves, requests documents or escalates; approving a High-risk claim or escalating a Low-risk one needs a written reason. Requesting documents is simulated and is recorded as such.

## Script for a live demo

1. Queue: D (2 days left, highlighted), C, then A and B together marked Duplicate.
2. Open B, "Run checks". High risk with consistency, authenticity and duplicate flagged and the proof of relationship missing.
3. "Show evidence" on the date finding: both dates are highlighted, 12 Mar against 03 Mar.
4. Escalate, reason "Suspected fraud", with a note.
5. Open A, "Run checks": Low risk. Approve. Both timelines show the steps; the Audit trail page lists everything and exports CSV.

## Fragile points to avoid on stage

- Dates are relative to when the demo is seeded, so "days left" is right only after the day you reset; reset just before presenting.
- "Demo: make a check fail to complete" under Run checks forces the unfinished path; use it only on purpose.
- Restarting the backend mid-click can show a one-off "Request failed (500)"; press the button again.
- Authenticity signals are planted fixture metadata, not analysis of images or PDFs. Say so if asked.
