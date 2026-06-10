"use client";

// App-wide loading overlay. Any client component calls useLoading() and does:
//   const loading = useLoading();
//   loading.show("Saving your design…");      // indeterminate — synthetic climb
//   …await the work…
//   loading.complete("Saved ✓");              // shimmer + fade out
// or, for real progress (e.g. Smart Import): loading.show(msg, { determinate: true })
// then loading.set(pct, msg) and loading.complete().
//
// One BrandedLoader instance renders here so EVERY loading state looks identical.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { BrandedLoader } from "@/components/BrandedLoader";

type ShowOpts = {
  determinate?: boolean; // false → synthetic slow climb capped below 100 until complete()
  subMessage?: string;
  messages?: string[]; // cycle through these while running (indeterminate)
  doneMessage?: string;
  onCancel?: () => void;
  cancelLabel?: string;
  showPercent?: boolean;
};

type LoadingApi = {
  show: (message: string, opts?: ShowOpts) => void;
  set: (progress: number, message?: string) => void; // for determinate work
  complete: (doneMessage?: string) => void;
  hide: () => void;
  busy: boolean;
};

const LoadingContext = createContext<LoadingApi | null>(null);

export function useLoading(): LoadingApi {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    // No provider in scope (e.g. unit context) — no-op so callers never crash.
    return { show: () => {}, set: () => {}, complete: () => {}, hide: () => {}, busy: false };
  }
  return ctx;
}

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [subMessage, setSubMessage] = useState<string | undefined>(undefined);
  const [doneMessage, setDoneMessage] = useState("Done ✓");
  const [showPercent, setShowPercent] = useState(true);
  const [onCancel, setOnCancel] = useState<(() => void) | undefined>(undefined);
  const [cancelLabel, setCancelLabel] = useState<string | undefined>(undefined);

  const climbRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const determinateRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (climbRef.current) { clearInterval(climbRef.current); climbRef.current = null; }
    if (msgRef.current) { clearInterval(msgRef.current); msgRef.current = null; }
  }, []);

  const show = useCallback((msg: string, opts: ShowOpts = {}) => {
    clearTimers();
    determinateRef.current = !!opts.determinate;
    setDone(false);
    setProgress(opts.determinate ? 0 : 8);
    setMessage(msg);
    setSubMessage(opts.subMessage);
    setDoneMessage(opts.doneMessage ?? "Done ✓");
    setShowPercent(opts.showPercent ?? true);
    setOnCancel(() => opts.onCancel);
    setCancelLabel(opts.cancelLabel);
    setActive(true);

    if (!opts.determinate) {
      // Synthetic ease toward ~92% so indeterminate work always feels alive;
      // complete() finishes it to 100.
      climbRef.current = setInterval(() => {
        setProgress((p) => (p >= 92 ? p : p + Math.max(0.4, (92 - p) * 0.04)));
      }, 120);
    }
    if (opts.messages && opts.messages.length > 0) {
      let i = 0;
      msgRef.current = setInterval(() => {
        i = (i + 1) % opts.messages!.length;
        setMessage(opts.messages![i]);
      }, 1600);
    }
  }, [clearTimers]);

  const set = useCallback((p: number, msg?: string) => {
    setProgress((prev) => (determinateRef.current ? Math.max(0, Math.min(100, p)) : Math.max(prev, Math.min(96, p))));
    if (msg != null) setMessage(msg);
  }, []);

  const hide = useCallback(() => {
    clearTimers();
    setActive(false);
    setDone(false);
    setProgress(0);
  }, [clearTimers]);

  const complete = useCallback((dm?: string) => {
    clearTimers();
    if (dm) setDoneMessage(dm);
    setProgress(100);
    setDone(true);
    // BrandedLoader handles the shimmer + fade, then we reset state.
    setTimeout(() => { setActive(false); setDone(false); setProgress(0); }, 2100);
  }, [clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return (
    <LoadingContext.Provider value={{ show, set, complete, hide, busy: active && !done }}>
      {children}
      <BrandedLoader
        active={active}
        progress={progress}
        message={message}
        subMessage={subMessage}
        done={done}
        doneMessage={doneMessage}
        showPercent={showPercent}
        onCancel={onCancel}
        cancelLabel={cancelLabel}
      />
    </LoadingContext.Provider>
  );
}
