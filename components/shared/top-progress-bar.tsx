"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Studio routes show their own thread-and-needle loader, so the bar stays quiet for them. */
const STUDIO_PREFIXES = ["/design-studio", "/mood-board"];
const isStudio = (path: string) => STUDIO_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));

type Phase = "idle" | "running" | "done";

/**
 * 3px gradient bar at the very top. Starts when an internal link is clicked or
 * history.pushState runs, trickles towards ~80%, and completes (then fades)
 * once the pathname/search changes. Custom instead of a library so Studio
 * navigations can be excluded. Respects prefers-reduced-motion (solid bar, no trickle).
 */
export function TopProgressBar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fade = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = useRef(pathname + "?" + search);

  function clearTimers() {
    if (timer.current) clearInterval(timer.current);
    if (fade.current) clearTimeout(fade.current);
    if (safety.current) clearTimeout(safety.current);
  }

  function finish() {
    clearTimers();
    setProgress(100);
    setPhase("done");
    fade.current = setTimeout(() => {
      setPhase("idle");
      setProgress(0);
    }, 350);
  }

  // Navigation finished: the URL changed.
  useEffect(() => {
    const now = pathname + "?" + search;
    if (now !== current.current) {
      current.current = now;
      finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  useEffect(() => {
    function start(toUrl: URL) {
      if (toUrl.origin !== location.origin) return;
      if (isStudio(toUrl.pathname)) return;
      if (toUrl.pathname === location.pathname && toUrl.search === location.search) return;
      clearTimers();
      setPhase("running");
      setProgress(8);
      timer.current = setInterval(() => {
        // ease towards 80%: big steps first, small later
        setProgress((p) => (p < 80 ? p + Math.max(0.6, (80 - p) * 0.08) : p));
      }, 200);
      // never hang if the navigation is cancelled
      safety.current = setTimeout(finish, 15000);
    }

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      try {
        start(new URL(a.href, location.href));
      } catch {
        /* not a URL */
      }
    }

    // router.push()/replace() go through history.pushState
    const push = history.pushState;
    history.pushState = function (...args: Parameters<History["pushState"]>) {
      if (args[2]) {
        try { start(new URL(String(args[2]), location.href)); } catch { /* ignore */ }
      }
      return push.apply(this, args);
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      history.pushState = push;
      clearTimers();
    };
    // clearTimers/finish only touch refs and setState, so they are safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "idle") return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
      style={{ opacity: phase === "done" ? 0 : 1, transition: phase === "done" ? "opacity 300ms ease-out 50ms" : undefined }}
    >
      <div
        className="h-full origin-left motion-reduce:!transition-none"
        style={{
          width: "100%",
          transform: `scaleX(${progress / 100})`,
          transition: "transform 200ms ease-out",
          background: "linear-gradient(90deg, var(--pri), #9ab8ff, #c6a8ff)",
          boxShadow: "0 0 8px color-mix(in srgb, var(--pri) 50%, transparent)",
        }}
      />
    </div>
  );
}
