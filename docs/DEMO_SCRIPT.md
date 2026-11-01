# Demo script (about 2 minutes)

Live link: https://keeper-web-943047518295.asia-south1.run.app. Open it once a minute before you start, because Cloud Run scales to zero and the first visit can be slow. Everything is synthetic and there is no login.

## 1. The problem (15 s)

"When someone dies, their family often cannot find what they owned, or what each bank needs before it releases anything. And the bank has to check every claim for mistakes and fraud. Keeper helps both sides."

## 2. The family side (60 s)

1. On the home page press **Explore an example**. Pick Arjun and step through; Keeper listens, understands and prepares a claim checklist.
2. Press **Open the example workspace**. Point at: holdings with their evidence status, two open claims, "Simulated submission recorded".
3. Open **Get started** in a fresh tab and type: "My father passed away. We know about his SBI savings account but not his investments." Keeper replies, notes the bank and saves what you said. Press **Talk to Keeper** to show voice in English or Hindi.

Say: "Four evidence statuses only. A document never proves entitlement, and nothing is submitted for the family."

## 3. The institution side (45 s)

1. Open `/verify`, press **Sign in to demo**. Four claims wait on the desk.
2. Open **VER-0415**, press **Run checks**. It rates **High**: the date of death was edited and another claim covers the same person. Open the evidence for each flag.
3. **Escalate** it with a reason and a note. Then open **VER-0412**, run checks (**Low**) and **Approve**.
4. Show the audit trail and the CSV export. Press **Reset demo** to start again.

Say: "The rating comes from fixed rules, never an AI model. A person decides, and every step is in the audit trail."

## 4. Close (10 s)

"Same rules on both sides, so a family's claim can arrive already checked. Tests, CI, threat model and decisions are all in the repo."

## Questions to expect

- **Is this real?** No. All data is synthetic, and verification and submission are simulated. Production would need institution integrations and legal review (see `docs/FEASIBILITY_AND_COMPLIANCE.md`).
- **Why no assets after the chat?** Saving a holding needs identity checks, which are not connected in the demo, so Keeper keeps it as a note instead of pretending.
- **Can the AI approve a claim?** No. Rules rate risk, people decide.
- **What does it cost to run?** Nothing: Cloud Run, Supabase and Gemini free tiers.
