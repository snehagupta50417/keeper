"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileText, History, Layers, MessageCircle, Plus, ScrollText, Settings2, Users } from "lucide-react";
import { connectBackend, refreshBackend, useBackendStatus, dispatch, useKeeper } from "@/keeper/store";
import { cn } from "@/lib/utils";
import { PersonaChip } from "./persona-chip";
import { Btn, Wordmark } from "./ui";

const NAV = [
  { href: "/app", label: "Conversation", short: "Talk", icon: MessageCircle },
  { href: "/app/assets", label: "Assets", short: "Assets", icon: Layers },
  { href: "/app/family", label: "Family record", short: "Family", icon: Users },
  { href: "/app/claims", label: "Claims", short: "Claims", icon: ScrollText },
  { href: "/app/documents", label: "Documents", short: "Docs", icon: FileText },
  { href: "/app/activity", label: "Activity", short: "Activity", icon: History },
] as const;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { state, loaded, c } = useKeeper();
  const backend = useBackendStatus();
  const [accountChecked, setAccountChecked] = useState(false);
  const path = usePathname();
  const router = useRouter();

  // No sign-in: a first visit starts a workspace in this browser straight away.
  useEffect(() => { if (loaded && !state) dispatch({ t: "signIn", name: "You", mode: "signin" }); }, [loaded, state]);

  useEffect(() => {
    if (!loaded || !state) return;
    let active = true;
    if (state.session?.mode !== "signin") return;
    fetch("/api/auth/config", { cache: "no-store" }).then(r => r.json()).then(async config => {
      if (config.mode === "supabase") {
        const identity = await (await import("@/lib/auth")).account();
        if (!identity.authenticated || identity.accountId !== localStorage.getItem("keeper.account")) { if (active) { dispatch({ t: "signOut" }); router.replace("/signin"); } return; }
      }
      if (active) { setAccountChecked(true); connectBackend(); }
    }).catch(() => { if (active) router.replace("/signin"); });
    return () => { active = false; };
  }, [loaded, state?.session?.mode, router]);


  useEffect(() => {
    const changed = (event: StorageEvent) => { if (event.key === "keeper.account") { setAccountChecked(false); router.replace("/signin"); } };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [router]);

  if (!state || !c || (state.session?.mode === "signin" && !accountChecked)) return <div className="grid min-h-dvh place-items-center text-muted-foreground" role="status">Opening Keeper…</div>;

  const counts: Record<string, number> = { "/app/assets": c.assets.length, "/app/documents": c.docs.length, "/app/claims": c.claims.length };
  const isActive = (h: string) => (h === "/app" ? path === "/app" : path.startsWith(h));
  const caseSelect = (cls?: string) => (
    <label className={cn("block", cls)}>
      <span className="mb-1 block text-[0.75rem] font-semibold uppercase tracking-wider text-moss">{state.session?.mode === "sample" ? "Example workspace" : "Whose information"}</span>
      <select aria-label="Whose information" value={state.activeCase} onChange={(e) => { dispatch({ t: "switchCase", id: e.target.value }); router.push("/app"); }} className="min-h-11 w-full rounded-xl border border-input bg-paper px-3 font-medium">
        {state.order.map((id) => <option key={id} value={id}>{state.cases[id].name}</option>)}
      </select>
    </label>
  );

  return (
    <div className="keeper-app flex h-dvh flex-col bg-ivory lg:flex-row">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-ivory">Skip to content</a>

      {/* Desktop navigation */}
      <aside className="keeper-sidebar scroll-soft hidden w-64 shrink-0 flex-col gap-5 overflow-y-auto border-r border-line bg-paper px-4 py-5 lg:flex" aria-label="Keeper navigation">
        <div className="keeper-brand"><Wordmark href="/app" /><span className="keeper-brand-tag">A little clarity. A lasting legacy.</span></div>
        <PersonaChip />
        {caseSelect()}
        <Btn variant="ink" className="w-full" onClick={() => { dispatch({ t: "newThread" }); router.push("/app"); }}><Plus className="h-4 w-4" aria-hidden />New conversation</Btn>
        <nav aria-label="Sections" className="keeper-nav flex flex-col gap-0.5">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 font-medium", isActive(n.href) ? "bg-ink text-ivory" : "hover:bg-secondary")}>
              <n.icon className="h-[1.1rem] w-[1.1rem]" aria-hidden />{n.label}
              {counts[n.href] ? <span className={cn("ml-auto rounded-full px-2 text-[0.78rem]", isActive(n.href) ? "bg-ivory/20" : "bg-secondary")}>{counts[n.href]}</span> : null}
            </Link>
          ))}
        </nav>
        <div>
          <p className="keeper-nav-label mb-1 text-[0.75rem] font-semibold uppercase tracking-wider text-moss">Your conversations</p>
          <ul className="space-y-0.5">
            {c.threads.slice(0, 6).map((t) => (
              <li key={t.id}><button onClick={() => { dispatch({ t: "switchThread", id: t.id }); router.push("/app"); }} aria-current={t.id === c.activeThread ? "true" : undefined} className={cn("w-full truncate rounded-xl px-3 py-2 text-left text-[0.9rem]", t.id === c.activeThread ? "bg-secondary font-medium" : "hover:bg-secondary/70")}>{t.title}</button></li>
            ))}
          </ul>
        </div>
        <div className="mt-auto space-y-2 border-t border-line pt-4"><div className="keeper-sidebar-note"><span aria-hidden>✧</span><p>A little at a time.<br /><strong>You don’t have to figure it out alone.</strong></p></div>
          <Link href="/app/settings" aria-current={path === "/app/settings" ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 font-medium", path === "/app/settings" ? "bg-ink text-ivory" : "hover:bg-secondary")}><Settings2 className="h-[1.1rem] w-[1.1rem]" aria-hidden />Settings</Link>
          <p className="px-3 text-[0.82rem] text-muted-foreground">{state.session?.name}</p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="keeper-mobile-header flex items-end justify-between gap-3 border-b border-line bg-paper px-4 py-2.5 lg:hidden">
        <Wordmark href="/app" />
        <div className="flex min-w-0 flex-1 justify-end gap-2">
          {caseSelect("min-w-0 max-w-[13rem] flex-1")}
          <PersonaChip variant="mobile" />
          <details className="relative self-end">
            <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full border border-line bg-ivory" aria-label="More"><Settings2 className="h-5 w-5" aria-hidden /></summary>
            <div className="absolute right-0 z-30 mt-2 w-56 rounded-2xl border border-line bg-paper p-2 shadow-lg">
              <button className="block min-h-11 w-full rounded-xl px-3 text-left hover:bg-secondary" onClick={() => { dispatch({ t: "newThread" }); router.push("/app"); }}>New conversation</button>
              <Link href="/app/activity" className="block min-h-11 rounded-xl px-3 py-2.5 hover:bg-secondary">Activity</Link>
              <Link href="/app/settings" className="block min-h-11 rounded-xl px-3 py-2.5 hover:bg-secondary">Settings</Link>
            </div>
          </details>
        </div>
      </header>

      <main id="content" className={cn("relative min-h-0 min-w-0 flex-1", path === "/app" ? "overflow-hidden" : "scroll-soft overflow-y-auto")}>{backend.error && <div className="absolute inset-x-3 top-2 z-40 mx-auto max-w-2xl rounded-xl border border-line bg-paper/95 px-4 py-2 text-sm shadow-sm" role={backend.error ? "alert" : "status"}>{backend.error}{backend.error && <button className="ml-3 underline" onClick={refreshBackend}>Retry</button>}</div>}<div key={path} className="keeper-route h-full min-h-0">{children}</div></main>

      {/* Mobile bottom navigation */}
      <nav aria-label="Sections" className="keeper-mobile-nav grid grid-cols-5 border-t border-line bg-paper lg:hidden">
        {NAV.filter((n) => n.href !== "/app/activity").map((n) => (
          <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined} className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.72rem] font-medium", isActive(n.href) ? "text-ink" : "text-muted-foreground")}>
            <n.icon className={cn("h-5 w-5", isActive(n.href) && "text-apricot-deep")} aria-hidden />{n.short}
          </Link>
        ))}
      </nav>
    </div>
  );
}
