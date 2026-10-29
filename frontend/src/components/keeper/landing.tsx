"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Mic, Paperclip, Sparkles, ShieldCheck, Search, Heart, FileCheck2 } from "lucide-react";
import { Wordmark, FamilyScene, Pill, Btn, ChatBubble } from "./ui";
import { cn } from "@/lib/utils";

const NAV = [
  ["How it works", "#how"], ["Find assets", "#find"], ["Prepare for family", "#prepare"], ["Claims", "#claims"], ["Security", "#control"], ["For institutions", "#institutions"],
] as const;

function Header() {
  return (
    <header className="landing-header sticky top-0 z-30 border-b border-line/70 bg-ivory/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-5 py-3">
        <Wordmark />
        <nav aria-label="Main" className="hidden items-center gap-7 text-[0.95rem] lg:flex">
          {NAV.map(([l, h]) => <a key={h} href={h} className="rounded px-1 py-2 text-ink/80 hover:text-ink hover:underline decoration-apricot decoration-2 underline-offset-8">{l}</a>)}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/app" className="inline-flex min-h-11 items-center rounded-full bg-apricot px-5 text-[0.95rem] font-semibold text-ink hover:bg-[#dd9566]">Get started</Link>
          <details className="relative lg:hidden">
            <summary className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-full border border-line bg-paper text-[0.9rem] font-medium" aria-label="Menu">Menu</summary>
            <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-line bg-paper p-2 shadow-lg">
              {NAV.map(([l, h]) => <a key={h} href={h} className="block rounded-xl px-4 py-3 hover:bg-secondary">{l}</a>)}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

function Bubble({ who, children }: { who: "you" | "keeper"; children: React.ReactNode }) {
  return <ChatBubble user={who === "you"} className="max-w-[88%] text-[0.95rem]">{children}</ChatBubble>;
}

function DemoWindow() {
  return (
    <div className="landing-demo settle overflow-hidden rounded-[1.4rem] border border-line bg-paper shadow-[0_30px_60px_-30px_rgba(36,40,36,0.35)]" aria-label="Example conversation with Keeper">
      <div className="flex items-center justify-between border-b border-line bg-secondary/60 px-4 py-2.5">
        <div className="landing-demo-brand"><Sparkles className="h-4 w-4" aria-hidden /><span>Keeper<span className="landing-demo-subtitle">Your case, connected</span></span></div>
        <Pill tone="warn">Simulated example</Pill>
      </div>
      <div className="grid md:grid-cols-[minmax(0,1fr)_13rem]">
        <div className="landing-demo-messages space-y-3 p-4 md:p-5">
          <div className="text-[0.8rem] font-medium text-muted-foreground">A place to start. A plan to follow.</div>
          <Bubble who="you">My father passed away. We know about his bank account, but not his investments.</Bubble>
          <Bubble who="keeper">Would you like to start with the bank claim or look for investments?</Bubble>
          <div className="flex flex-wrap gap-2" aria-label="Suggested replies">
            {["Start the bank claim", "Look for investments"].map((c) => <span key={c} className="inline-flex min-h-10 items-center rounded-full border border-moss/40 bg-moss-soft px-4 text-[0.9rem] font-medium">{c}</span>)}
          </div>
          <div className="landing-demo-evidence"><FileCheck2 aria-hidden /><span>Bank account noted<small>Self-declared · Authority still needs review</small></span><Check aria-hidden /></div>
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-3xl border border-line bg-ivory p-1.5 pl-4">
            <span className="min-w-0 flex-1 truncate text-[0.9rem] text-muted-foreground">Type, or tap the microphone…</span>
            <Paperclip className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="inline-flex h-11 items-center gap-2 rounded-full bg-apricot px-4 text-[0.9rem] font-semibold"><Mic className="h-4 w-4" aria-hidden /> Talk to Keeper</span>
          </div>
        </div>
        <aside className="border-t border-line bg-ivory/60 p-4 md:border-l md:border-t-0" aria-label="What Keeper noted">
          <div className="eyebrow mb-2">What Keeper knows</div>
          <dl className="space-y-2.5 text-[0.88rem]">
            {[["Their relation to you", "Child · you said"], ["Known asset", "Bank account · you said"], ["Investments", "Unknown · follow-up added"], ["Authority", "To review before any claim"]].map(([k, v]) => (
              <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
            ))}
          </dl>
        </aside>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="landing-hero paper-grain relative overflow-hidden">
      <div className="landing-orbit landing-orbit-one" aria-hidden /><div className="landing-orbit landing-orbit-two" aria-hidden />
      <div className="mx-auto grid max-w-[1180px] items-center gap-12 px-5 pb-14 pt-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:pb-20 lg:pt-10">
        <div>
          <p className="eyebrow settle"><span className="landing-eyebrow-dot" aria-hidden /> YOUR FINANCIAL LIFE, CONNECTED</p>
          <h1 className="display settle mt-4 text-[clamp(2.4rem,5vw,3.9rem)]">
            Find what’s yours.<br /><span className="italic text-moss">Plan for who matters.</span>
          </h1>
          <p className="settle mt-4 max-w-[34rem] text-[1.08rem] leading-relaxed text-ink/80">
            Accounts, investments, policies. A lifetime of details, brought together through one conversation. Find forgotten assets, prepare for family, or take the next step on a claim.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/app" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-apricot px-7 font-semibold text-ink hover:bg-[#dd9566]">Start your conversation <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            <Link href="/welcome" className="inline-flex min-h-12 items-center rounded-full border border-ink/25 bg-paper px-7 font-semibold hover:bg-secondary">Explore an example</Link>
          </div>
          <p className="landing-hero-note"><ShieldCheck aria-hidden />You review the evidence. You stay in control.</p>
          <ul className="landing-journey-links mt-7 grid gap-3 text-[0.92rem] sm:grid-cols-3" aria-label="Three things Keeper helps with">
            {[["Find my assets", "Find records you have lost track of."], ["Prepare for my family", "Keep records and instructions together."], ["After a death", "Prepare claims, one institution at a time."]].map(([t, d], n) => (
              <li key={t} className="border-t-2 border-apricot pt-3">{n === 0 ? <Search aria-hidden /> : n === 1 ? <Heart aria-hidden /> : <FileCheck2 aria-hidden />}<strong className="block font-semibold">{t}</strong><span className="text-ink/70">{d}</span></li>
            ))}
          </ul>
        </div>
        <div className="landing-demo-wrap"><div className="landing-demo-caption"><span aria-hidden>✧</span> One assistant. Every step.</div><DemoWindow /><div className="landing-demo-footnote"><span className="landing-mini-wave" aria-hidden>{Array.from({length: 5}, (_, i) => <i key={i} />)}</span>Type it. Say it. Take it one step at a time.</div></div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="border-y border-line bg-paper">
      <div className="mx-auto grid max-w-[1180px] items-center gap-10 px-5 py-20 lg:grid-cols-[1fr_1.1fr]">
        <FamilyScene variant="table" className="w-full rounded-3xl" />
        <div>
          <p className="eyebrow">The problem</p>
          <h2 className="display mt-3 text-[clamp(2rem,4vw,3.1rem)]">A financial life gets scattered. Families are left piecing it together.</h2>
          <ul className="mt-6 space-y-3 text-[1.02rem] text-ink/85">
            {["Old accounts tied to a former name or address.", "Investments left behind after a job change.", "Policies and statements scattered across papers and apps.", "Missing or outdated nominations.", "After a death, a different claim process at every institution."].map((t) => (
              <li key={t} className="flex gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-moss" aria-hidden />{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Introduction() {
  return (
    <section id="how" className="mx-auto max-w-[1180px] scroll-mt-20 px-5 py-20">
      <p className="eyebrow">One conversation</p>
      <h2 className="display mt-3 max-w-[18ch] text-[clamp(2rem,4vw,3.1rem)]">One conversation. A clearer financial picture.</h2>
      <p className="mt-4 max-w-[40rem] text-ink/80">Tell Keeper what you know. Review the records it organises and fill in the gaps, one question at a time.</p>
      <div className="mt-10 grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <div className="rounded-2xl border border-line bg-paper p-5"><div className="eyebrow">You say</div><p className="mt-2 text-[1.05rem]">“There was an HDFC account from my first job, and my father had an LIC policy.”</p></div>
        <div className="hidden items-center md:flex" aria-hidden><ArrowRight className="text-apricot" /></div>
        <div className="rounded-2xl border border-line bg-paper p-5"><div className="eyebrow">Keeper records</div><ul className="mt-2 space-y-1.5 text-[0.95rem]"><li><b>HDFC Bank</b> · bank account · <Pill>Self-declared</Pill></li><li><b>LIC of India</b> · insurance · <Pill>Self-declared</Pill></li><li className="text-muted-foreground">Owner of the LIC policy: needs confirmation</li></ul></div>
        <div className="hidden items-center md:flex" aria-hidden><ArrowRight className="text-apricot" /></div>
        <div className="rounded-2xl border border-line bg-paper p-5"><div className="eyebrow">Then it asks</div><p className="mt-2 text-[1.05rem]">“Is a nominee recorded on the policy?”</p><p className="mt-2 text-[0.88rem] text-muted-foreground">One question at a time, with a reason if you ask.</p></div>
      </div>
    </section>
  );
}

type Tone = "ok" | "warn" | "plain";
interface Story { id: string; tab: string; anchor: string; quote: string; chat: ["you" | "keeper", string][]; view: { title: string; rows: [string, string, Tone][]; note: string } }
const STORIES: Story[] = [
  {
    id: "find", tab: "Find", anchor: "find", quote: "I changed jobs and cities. I’ve lost track of some investments.",
    chat: [["keeper", "Let’s trace them. Which banks, fund houses or insurers do you remember? Rough names are fine."], ["you", "An HDFC account, and Mirae funds I started through my first employer."], ["keeper", "We can prepare searches for those institutions. Do you have a statement to begin with?"]],
    view: { title: "Discovery plan", rows: [["Records you upload", "Needs information", "plain"], ["RBI UDGAM · unclaimed bank deposits", "Awaiting your permission", "warn"], ["SEBI MITRA · inactive fund folios", "Awaiting your permission", "warn"], ["Connected sources", "Not connected", "plain"]], note: "A search that finds nothing only tells us about that site and the details you gave." },
  },
  {
    id: "prepare", tab: "Prepare", anchor: "prepare", quote: "I want to put my financial affairs in order before the end of life.",
    chat: [["keeper", "Where are your important papers kept?"], ["you", "Mostly in the blue folder at home. The LIC policy is in my locker."], ["keeper", "Saved. Have you named nominees on your accounts and policies?"]],
    view: { title: "Family record", rows: [["3 assets noted", "Self-declared", "plain"], ["Where papers are kept", "Blue folder · bank locker", "ok"], ["Nominees", "To check · task added", "warn"], ["Trusted contact: Anita", "Sees nothing until you choose", "plain"]], note: "Review dates and access choices stay with the record." },
  },
  {
    id: "after", tab: "After a death", anchor: "claims", quote: "My mother died. I need help finding and claiming her assets.",
    chat: [["keeper", "We’ll take it one institution at a time. Do you already know about any of her assets?"], ["you", "Yes. her State Bank savings account."], ["keeper", "We can start with that account. Is a nominee recorded?"]],
    view: { title: "State Bank of India · claim", rows: [["Authority review", "Current step", "warn"], ["Requirements", "From RBI’s 2025 directions", "plain"], ["Documents", "3 still missing", "warn"], ["Approval", "Not requested yet", "plain"]], note: "Review the documents before you submit them to the institution." },
  },
];

function Stories() {
  const [i, setI] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const s = STORIES[i];
  // The nav links "Find assets", "Prepare for family" and "Claims" open the matching story.
  useEffect(() => {
    const onHash = () => { const n = STORIES.findIndex((t) => t.anchor === location.hash.slice(1)); if (n >= 0) setI(n); };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const go = (n: number) => { const k = (n + STORIES.length) % STORIES.length; setI(k); refs.current[k]?.focus(); };
  return (
    <section id="stories" className="relative scroll-mt-20 border-y border-line bg-paper">
      {STORIES.map((t) => <span key={t.anchor} id={t.anchor} className="absolute -top-20" aria-hidden />)}
      <div className="mx-auto max-w-[1180px] px-5 py-20">
        <p className="eyebrow">Three stories, one assistant</p>
        <h2 className="display mt-3 text-[clamp(2rem,4vw,3.1rem)]">Start with the situation you’re in.</h2>
        <div role="tablist" aria-label="Choose a story" className="mt-8 inline-flex flex-wrap gap-2 rounded-full border border-line bg-ivory p-1.5">
          {STORIES.map((t, n) => (
            <button key={t.id} ref={(el) => { refs.current[n] = el; }} role="tab" id={`tab-${t.id}`} aria-selected={i === n} aria-controls="story-panel" tabIndex={i === n ? 0 : -1}
              onClick={() => setI(n)} onKeyDown={(e) => { if (e.key === "ArrowRight") go(n + 1); if (e.key === "ArrowLeft") go(n - 1); }}
              className={cn("min-h-11 rounded-full px-5 text-[0.95rem] font-semibold transition-colors", i === n ? "bg-ink text-ivory" : "hover:bg-secondary")}>{t.tab}</button>
          ))}
        </div>
        <div id="story-panel" role="tabpanel" aria-labelledby={`tab-${s.id}`} key={s.id} className="settle mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-3xl border border-line bg-ivory p-5 md:p-7">
            <div className="mb-4 flex items-center justify-between"><span className="eyebrow">Conversation</span></div>
            <div className="space-y-3">
              <Bubble who="you">{s.quote}</Bubble>
              {s.chat.map(([w, t], n) => <Bubble key={n} who={w}>{t}</Bubble>)}
            </div>
          </div>
          <div className="rounded-3xl border border-line bg-ivory p-5 md:p-7">
            <div className="eyebrow">What this becomes</div>
            <h3 className="display mt-2 text-[1.7rem]">{s.view.title}</h3>
            <ul className="mt-4 divide-y divide-line">
              {s.view.rows.map(([a, b, tone]) => (
                <li key={a} className="flex flex-wrap items-center justify-between gap-2 py-3"><span className="font-medium">{a}</span><Pill tone={tone}>{b}</Pill></li>
              ))}
            </ul>
            <p className="mt-4 text-[0.9rem] text-muted-foreground">{s.view.note}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function How() {
  const steps = [["Talk or type", "Say what’s happening in your own words."], ["Establish permissions", "Keeper explains who may act and what it will use."], ["Gather information and documents", "Short questions over time, remembered between sessions."], ["Review evidence", "Each detail shown next to its source."], ["Prepare or claim", "A checklist and package for each institution."], ["Track outcomes", "Approvals, follow-ups and results in one place."]];
  return (
    <section className="mx-auto max-w-[1180px] px-5 py-20">
      <p className="eyebrow">How it works</p>
      <h2 className="display mt-3 max-w-[20ch] text-[clamp(2rem,4vw,3.1rem)]">From your first question to your next step.</h2>
      <ol className="mt-10 grid gap-x-8 gap-y-6 md:grid-cols-3">
        {steps.map(([t, d], n) => (
          <li key={t} className="relative border-t border-ink/20 pt-4"><span className="display text-[2.4rem] text-apricot-deep/70" aria-hidden>{n + 1}</span><h3 className="text-[1.05rem] font-semibold">{t}</h3><p className="mt-1 text-ink/75">{d}</p></li>
        ))}
      </ol>
      <p className="mt-8 max-w-[40rem] text-ink/80">Not sure? Skip a question or ask why it matters. Your progress is saved.</p>
    </section>
  );
}

function WhatYouGet() {
  const items = [["An evidence-backed asset inventory", "Evidence status, source and dated amounts for each holding."], ["A family financial record", "Assets, papers and practical instructions in one place."], ["An institution-specific claim plan", "Institution-specific requirements and a package to review."], ["Organised documents", "Check extracted details against their source."], ["Outstanding tasks and follow-ups", "See what is missing and who acts next."]];
  return (
    <section className="border-y border-line bg-paper">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-20 lg:grid-cols-[0.9fr_1.1fr]">
        <div><p className="eyebrow">What you get</p><h2 className="display mt-3 text-[clamp(2rem,4vw,3.1rem)]">Clear records instead of a pile of papers.</h2><FamilyScene variant="desk" className="mt-8 hidden w-full rounded-3xl lg:block" /></div>
        <ul className="divide-y divide-line self-center">
          {items.map(([t, d]) => <li key={t} className="py-5"><h3 className="text-[1.15rem] font-semibold">{t}</h3><p className="mt-1 text-ink/75">{d}</p></li>)}
        </ul>
      </div>
    </section>
  );
}

type Level = "Available" | "Guided assistance" | "Planned";
const COVERAGE: [string, Level, Level, Level][] = [
  ["Bank accounts and fixed deposits", "Available", "Guided assistance", "Available"],
  ["Mutual funds", "Available", "Guided assistance", "Available"],
  ["Shares and demat holdings", "Available", "Planned", "Planned"],
  ["Unclaimed dividends and shares", "Available", "Planned", "Planned"],
  ["Life insurance", "Available", "Guided assistance", "Available"],
  ["EPF and related benefits", "Available", "Planned", "Planned"],
  ["NPS", "Available", "Planned", "Planned"],
  ["PPF and small savings", "Available", "Planned", "Planned"],
  ["Bank lockers", "Available", "Planned", "Planned"],
];

function Coverage() {
  return (
    <section className="mx-auto max-w-[1180px] px-5 py-20">
      <p className="eyebrow">Coverage</p>
      <h2 className="display mt-3 text-[clamp(2rem,4vw,3.1rem)]">What you can organise and prepare.</h2>
      <p className="mt-4 max-w-[44rem] text-ink/80">Keep records across asset types. Guided searches take you to official sources; claim preparation currently covers bank deposits, mutual funds and life insurance.</p>
      <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="w-full min-w-[640px] text-left text-[0.95rem]">
          <caption className="sr-only">Coverage by asset type</caption>
          <thead className="border-b border-line bg-secondary/60 text-[0.85rem]"><tr><th scope="col" className="p-4">Asset type</th><th scope="col" className="p-4">Record organisation</th><th scope="col" className="p-4">Discovery assistance</th><th scope="col" className="p-4">Claim preparation</th></tr></thead>
          <tbody>{COVERAGE.map(([n, a, b, c]) => (
            <tr key={n} className="border-b border-line last:border-0"><th scope="row" className="p-4 font-medium">{n}</th>{[a, b, c].map((l, k) => <td key={k} className="p-4"><span className={cn("text-[0.88rem]", l === "Planned" ? "text-muted-foreground" : "font-medium")}>{l}</span></td>)}</tr>
          ))}</tbody>
        </table>
      </div>
      <p className="mt-4 text-[0.9rem] text-muted-foreground">Official searches cover specific sources. Keeper cannot guarantee complete discovery or settlement.</p>
    </section>
  );
}

function Control() {
  return (
    <section id="control" className="scroll-mt-20 border-y border-line bg-ink text-ivory">
      <div className="mx-auto max-w-[1180px] px-5 py-20">
        <p className="eyebrow !text-apricot">Control</p>
        <h2 className="display mt-3 max-w-[22ch] text-[clamp(2rem,4vw,3.1rem)]">Your records. Your decisions.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-ivory/20 p-5"><h3 className="font-semibold">Evidence you can inspect</h3><p className="mt-2 text-ivory/75">Review each detail beside its source and correct it when needed.</p></div>
          <div className="rounded-2xl border border-ivory/20 p-5"><h3 className="font-semibold">Access previews and consent</h3><p className="mt-2 text-ivory/75">Choose the intended scope and preview it. Contact sharing is not connected.</p></div>
          <div className="rounded-2xl border border-ivory/20 p-5"><h3 className="font-semibold">Approval and activity history</h3><p className="mt-2 text-ivory/75">Review the recipient, documents and declarations. Changes require renewed approval.</p></div>
        </div>
        <p className="mt-8 max-w-[48rem] text-[0.95rem] text-ivory/75">Keeper prepares documents for you to submit. Institution connections and external submission are not available.</p>
      </div>
    </section>
  );
}

const INSTITUTION_POINTS: [string, string][] = [
  ["Claims arrive organised", "Each claim comes with its documents laid out beside what the claimant declared, so a reviewer starts from the facts."],
  ["Anything unusual comes with evidence", "A flag shows what was expected, what was seen and where. Signals are things to look at, not proof."],
  ["Your team makes every decision", "Risk follows fixed, published rules rather than an AI model. Approve, ask for documents or escalate, with everything on the record."],
];

function Institutions() {
  return (
    <section id="institutions" className="scroll-mt-20 border-b border-line bg-paper">
      <div className="mx-auto max-w-[1180px] px-5 py-20">
        <p className="eyebrow">For banks &amp; insurers</p>
        <h2 className="display mt-3 max-w-[22ch] text-[clamp(2rem,4vw,3.1rem)]">Pay the right heir, on time, every time.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {INSTITUTION_POINTS.map(([t, d]) => <div key={t} className="rounded-2xl border border-line bg-card p-5"><h3 className="font-semibold">{t}</h3><p className="mt-2 text-ink/80">{d}</p></div>)}
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
          <p className="text-[1.05rem]"><span className="font-semibold">Pricing.</span> Per claim verified, or an annual plan.</p>
          <Link href="/verify" className="inline-flex min-h-12 items-center rounded-full bg-ink px-7 font-semibold text-ivory hover:bg-[#3a403a]">Open the claims console demo.</Link>
        </div>
        <p className="mt-4 max-w-[48rem] text-[0.9rem] text-muted-foreground">The console is a demo with synthetic claims. Pricing is illustrative and no institution is connected.</p>
      </div>
    </section>
  );
}

const FAQ: [string, string][] = [
  ["Can I use Keeper while I’m alive?", "Yes. You can discover forgotten accounts, or organise what you have so it’s easy to find later."],
  ["Is it for end-of-life preparation?", "Yes, without needing a medical reason. Keeper helps you record assets, documents, nominations, trusted contacts and practical instructions, without asking about health."],
  ["Can it help after someone dies?", "Yes. It helps authorised family members, nominees or executors organise the case, find possible assets, understand each institution’s requirements and prepare claim documents."],
  ["Can I start a claim for an asset I already know about?", "Yes. You don’t have to search first. Tell Keeper which asset, and it starts that claim directly."],
  ["Can Keeper find every asset?", "No. It can analyse documents you upload and guide you through official searches. A search that finds nothing only covers that source and the details you gave."],
  ["What identity and authority are needed?", "Institutions decide. A death certificate alone doesn’t authorise every action, and requirements vary by institution and case. Keeper explains what’s typically needed before you reach protected steps."],
  ["Is a trusted contact an heir?", "No. A trusted contact is someone you choose to tell where your record is. Inheritance is decided by law and your will, not by Keeper."],
  ["Does it replace a will or legal advice?", "No. It doesn’t draft wills, decide who is entitled to what, or represent you before institutions. For legal questions, talk to a lawyer."],
  ["Does Keeper send anything without asking?", "No. Keeper prepares the package for your review. You submit it to the institution yourself."],
];

function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-[860px] px-5 py-20">
      <p className="eyebrow">Questions</p>
      <h2 className="display mt-3 text-[clamp(2rem,4vw,3.1rem)]">Plain answers.</h2>
      <div className="mt-8 divide-y divide-line border-y border-line">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group py-1">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[1.05rem] font-semibold"><span>{q}</span><span aria-hidden className="text-apricot-deep transition-transform group-open:rotate-45">+</span></summary>
            <p className="pb-5 pr-8 text-ink/80">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  const links = [["Find my assets", "discover"], ["Prepare for my family", "prepare"], ["Get help after a death", "claim"]];
  return (
    <section className="bg-moss text-white">
      <div className="mx-auto max-w-[1180px] px-5 py-20 text-center">
        <h2 className="display text-[clamp(2.2rem,5vw,3.6rem)]">A clearer starting point for your family.</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {links.map(([l, j], n) => <Link key={j} href={`/app?journey=${j}`} className={cn("inline-flex min-h-12 items-center rounded-full px-7 font-semibold", n === 0 ? "bg-apricot text-ink hover:bg-[#dd9566]" : "border border-white/50 hover:bg-white/10")}>{l}</Link>)}
        </div>
        <p className="mt-5 text-[0.9rem] text-white/80">Start with what you know. Add details as you go.</p>
      </div>
    </section>
  );
}

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current || !window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const sections = root.current.querySelectorAll("main > section:not(:first-child)");
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add("landing-revealed");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.06 });
    sections.forEach(section => { section.classList.add("landing-reveal"); observer.observe(section); });
    return () => { observer.disconnect(); sections.forEach(section => section.classList.remove("landing-reveal")); };
  }, []);
  return (
    <div ref={root} className="keeper-landing">
      <div className="landing-scroll-progress" aria-hidden />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-ivory">Skip to content</a>
      <Header />
      <main id="main">
        <Hero /><Problem /><Introduction /><Stories /><How /><WhatYouGet /><Coverage /><Control /><Institutions /><Faq /><FinalCta />
      </main>
      <footer className="border-t border-line bg-paper"><div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-5 py-8 text-[0.9rem] text-muted-foreground"><Wordmark /><span>© keeper · Not legal or financial advice.</span><Link href="/verify" className="underline underline-offset-4">For institutions</Link><Btn variant="quiet" className="min-h-10 px-4 text-[0.85rem]" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}>Back to top</Btn></div></footer>
    </div>
  );
}
