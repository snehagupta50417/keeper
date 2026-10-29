"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CircleSlash, Loader2, Volume2, VolumeX } from "lucide-react";
import { dispatch } from "@/keeper/store";
import { PERSONAS, personaById, type Persona } from "@/keeper/personas";
import { storyFor, type Beat, type Story } from "@/keeper/tour";
import { speak, stopSpeaking } from "@/keeper/voice";
import { cn } from "@/lib/utils";
import { LoopRail, Orb } from "./agent-mode";
import { PersonaSummary } from "./persona-card";
import { Btn, Wordmark } from "./ui";

/** Plays a timer-driven reveal. `ms` is 1 when the person prefers reduced motion. */
const pace = (ms: number) => (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 1 : ms);

function UserBeat({ beat, who, onReady }: { beat: Extract<Beat, { kind: "user" }>; who: string; onReady: () => void }) {
  const words = beat.text.split(" ");
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setShown((n) => Math.min(n + 1, words.length)), pace(70));
    return () => clearInterval(id);
  }, [words.length]);
  useEffect(() => { if (shown >= words.length) onReady(); }, [shown, words.length, onReady]);
  return (
    <div className="settle">
      <p className="text-[0.8rem] font-semibold uppercase tracking-wider text-muted-foreground">{who}</p>
      <p className="display mt-2 min-h-[8rem] text-[1.7rem] leading-snug sm:text-[2rem]" aria-live="polite">“{words.slice(0, shown).join(" ")}”</p>
    </div>
  );
}

function UnderstoodBeat({ beat, onReady }: { beat: Extract<Beat, { kind: "understood" }>; onReady: () => void }) {
  useEffect(() => { const id = setTimeout(onReady, pace(900)); return () => clearTimeout(id); }, [onReady]);
  return (
    <div className="settle space-y-5">
      <p className="text-[1.25rem] leading-relaxed">{beat.say}</p>
      <div>
        <p className="mb-2 text-[0.8rem] font-semibold uppercase tracking-wider text-muted-foreground">What Keeper took from that</p>
        <ul className="flex flex-wrap gap-2">
          {beat.chips.map((c, i) => <li key={c} className="settle rounded-full border border-moss/40 bg-paper px-3.5 py-1.5 text-[0.93rem]" style={{ animationDelay: `${(i + 1) * 0.35}s` }}>{c}</li>)}
        </ul>
      </div>
    </div>
  );
}

function ActBeat({ beat, onReady }: { beat: Extract<Beat, { kind: "act" }>; onReady: () => void }) {
  const [done, setDone] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setDone((n) => Math.min(n + 1, beat.steps.length)), pace(1100));
    return () => clearInterval(id);
  }, [beat.steps.length]);
  const finished = done >= beat.steps.length;
  useEffect(() => { if (finished) onReady(); }, [finished, onReady]);
  return (
    <div className="settle space-y-4">
      <p className="text-[1.25rem] leading-relaxed">{beat.say}</p>
      <ul className="space-y-2.5" aria-live="polite">
        {beat.steps.map((s, i) => i <= done && (
          <li key={s} className="settle flex gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
            <span className="mt-0.5 shrink-0">{i < done ? <Check className="h-5 w-5 text-moss" aria-hidden /> : <Loader2 className="h-5 w-5 animate-spin text-moss" aria-hidden />}</span>
            <span><span className="sr-only">{i < done ? "Done: " : "Working on: "}</span>{s}</span>
          </li>
        ))}
      </ul>
      {finished && <p className="settle border-l-2 border-apricot pl-3 text-[0.95rem] text-ink/80">{beat.note}</p>}
    </div>
  );
}

function ConfirmBeat({ beat, onReady }: { beat: Extract<Beat, { kind: "confirm" }>; onReady: () => void }) {
  const [choice, setChoice] = useState<"yes" | "no" | null>(null);
  const pick = (c: "yes" | "no") => { setChoice(c); onReady(); };
  const result = choice ? beat[choice].result : null;
  return (
    <div className="settle space-y-4">
      <div className="rounded-2xl border-2 border-apricot bg-paper p-5">
        <p className="text-[1.25rem] font-medium leading-snug">{beat.ask}</p>
        <ul className="mt-3 space-y-1.5">{beat.will.map((w) => <li key={w} className="flex gap-2"><ArrowRight className="mt-1 h-4 w-4 shrink-0 text-moss" aria-hidden />{w}</li>)}</ul>
        <p className="mt-3 text-[0.93rem] text-ink/80">{beat.never}</p>
        {!choice && (
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Your answer">
            <Btn onClick={() => pick("yes")}><Check className="h-4 w-4" aria-hidden />{beat.yes.label}</Btn>
            <Btn variant="quiet" onClick={() => pick("no")}><CircleSlash className="h-4 w-4" aria-hidden />{beat.no.label}</Btn>
          </div>
        )}
      </div>
      {result && <p role="status" className="settle flex gap-2 text-[1.02rem]"><Check className="mt-1 h-4 w-4 shrink-0 text-moss" aria-hidden />{result}</p>}
    </div>
  );
}

function CloseBeat({ beat, onReady }: { beat: Extract<Beat, { kind: "close" }>; onReady: () => void }) {
  useEffect(() => { const id = setTimeout(onReady, 200); return () => clearTimeout(id); }, [onReady]);
  return (
    <div className="settle space-y-5">
      <p className="text-[1.25rem] leading-relaxed">{beat.say}</p>
      <ul className="space-y-2" aria-label="What changed">{beat.did.map((d) => <li key={d} className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-moss" aria-hidden /><span>{d}</span></li>)}</ul>
      <div className="rounded-2xl border border-line bg-paper p-4"><p className="text-[0.78rem] font-semibold uppercase tracking-wider text-muted-foreground">Next step</p><p className="mt-1">{beat.next}</p></div>
      <p className="text-[0.88rem] text-muted-foreground">{beat.safety}</p>
    </div>
  );
}

function Stage({ story, onPick, onExit }: { story: Story; onPick: () => void; onExit: (to: "workspace" | "mine") => void }) {
  const persona = personaById(story.persona);
  const [i, setI] = useState(0);
  const [ready, setReady] = useState(false);
  const [aloud, setAloud] = useState(false);
  const next = useRef<HTMLButtonElement>(null);
  const beat = story.beats[i];
  const last = i === story.beats.length - 1;
  const markReady = useCallback(() => setReady(true), []);

  // Keeper's own lines can be read aloud, off unless asked.
  useEffect(() => {
    if (!aloud) { stopSpeaking(); return; }
    const line = beat.kind === "confirm" ? beat.ask : beat.kind === "understood" || beat.kind === "act" || beat.kind === "close" ? beat.say : "";
    if (line) speak(line);
    return () => { stopSpeaking(); };
  }, [aloud, beat]);
  useEffect(() => { if (ready) next.current?.focus(); }, [ready, i]);

  const advance = () => { setReady(false); setI((n) => n + 1); };
  const label = beat.kind === "user" ? "Keeper listens" : beat.label;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-5 pb-8">
      <div className="flex flex-col items-center gap-3 pt-2">
        <Orb phase={beat.phase} small />
        <LoopRail phase={beat.phase} />
      </div>
      <div className="flex-1">
        <p className="mb-3 text-[0.8rem] font-semibold uppercase tracking-wider text-moss" aria-live="polite">{label}</p>
        {beat.kind === "user" && <UserBeat key={i} beat={beat} who={`${persona.name}, ${persona.age}, ${persona.city}`} onReady={markReady} />}
        {beat.kind === "understood" && <UnderstoodBeat key={i} beat={beat} onReady={markReady} />}
        {beat.kind === "act" && <ActBeat key={i} beat={beat} onReady={markReady} />}
        {beat.kind === "confirm" && <ConfirmBeat key={i} beat={beat} onReady={markReady} />}
        {beat.kind === "close" && <CloseBeat key={i} beat={beat} onReady={markReady} />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {last ? (
          <>
            <Btn ref={next} className="min-h-12" onClick={() => onExit("workspace")} disabled={!ready}>Open the example workspace <ArrowRight className="h-4 w-4" aria-hidden /></Btn>
            <Btn variant="quiet" className="min-h-12" onClick={onPick}>Watch another</Btn>
            <button className="min-h-12 px-3 text-[0.93rem] text-moss underline underline-offset-4" onClick={() => onExit("mine")}>Start with my own</button>
          </>
        ) : (
          <Btn ref={next} className="min-h-12 min-w-36" onClick={advance} disabled={!ready}>Continue</Btn>
        )}
        <button onClick={() => setAloud((a) => !a)} aria-pressed={aloud} aria-label={aloud ? "Stop reading aloud" : "Read Keeper’s lines aloud"} className="ml-auto flex h-11 w-11 items-center justify-center rounded-full hover:bg-secondary">{aloud ? <Volume2 className="h-5 w-5" aria-hidden /> : <VolumeX className="h-5 w-5" aria-hidden />}</button>
      </div>
    </div>
  );
}

/** First impression for "Explore an example": one calm step at a time, with fictional people. */
export default function Tour() {
  const router = useRouter();
  const params = useSearchParams();
  const [story, setStory] = useState<Story | null>(() => storyFor(params.get("persona") ?? "") ?? null);

  const exit = (to: "workspace" | "mine", persona?: Persona) => {
    stopSpeaking();
    const who = persona ?? personaById(story?.persona);
    if (to === "workspace") { dispatch({ t: "signIn", name: who.name, mode: "sample", persona: who.id }); router.push("/app"); }
    else router.push("/app");
  };

  return (
    <div className="flex min-h-dvh flex-col bg-ivory">
      <header className="flex items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <Wordmark href="/" />
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-line bg-paper px-3 py-1 text-[0.8rem] font-medium">Example · fictional people</span>
          <button onClick={() => exit("workspace")} className="min-h-11 rounded-full px-3 text-[0.9rem] text-muted-foreground hover:bg-secondary">Skip</button>
        </div>
      </header>

      {!story ? (
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-5 pb-12">
          <div className="settle">
            <h1 className="display text-[2.3rem] leading-tight sm:text-[2.7rem]">Who would you like to follow?</h1>
            <p className="mt-3 text-[1.08rem] text-ink/80">Everything you see in the example belongs to one made-up person. Pick one. You’ll watch Keeper help them with one turn, then open their workspace. It takes about a minute.</p>
          </div>
          <ul className="space-y-3">
            {PERSONAS.map((p, i) => (
              <li key={p.id} className="settle" style={{ animationDelay: `${0.15 + i * 0.1}s` }}>
                <button onClick={() => setStory(storyFor(p.id) ?? null)} className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-moss/40 bg-paper px-5 py-4 text-left hover:bg-moss-soft">
                  <PersonaSummary p={p} />
                  <ArrowRight className="h-5 w-5 shrink-0 text-moss transition-transform group-hover:translate-x-0.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <p className="text-[0.88rem] text-muted-foreground">Prefer to look around yourself? <button className="underline underline-offset-4" onClick={() => exit("workspace")}>Open {PERSONAS[0].name}’s workspace</button>. <Link href="/" className="ml-1 underline underline-offset-4">Back</Link></p>
        </main>
      ) : (
        <main className="flex flex-1 flex-col"><Stage key={story.persona} story={story} onPick={() => setStory(null)} onExit={(to) => exit(to)} /></main>
      )}
    </div>
  );
}
