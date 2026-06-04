"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

// Submit button for server-action forms that confirms the save: shows "Saving…"
// while pending, then "Saved ✓" for a moment once it completes. Must be rendered
// inside the <form> it submits (uses useFormStatus).
export function SaveButton({ label = "Save changes", savedLabel = "Saved ✓", className = "vy-btn vy-btn-primary" }: {
  label?: string; savedLabel?: string; className?: string;
}) {
  const { pending } = useFormStatus();
  const [justSaved, setJustSaved] = useState(false);
  const prev = useRef(false);

  useEffect(() => {
    if (prev.current && !pending) { setJustSaved(true); const t = setTimeout(() => setJustSaved(false), 2500); prev.current = pending; return () => clearTimeout(t); }
    prev.current = pending;
  }, [pending]);

  return (
    <button type="submit" className={className} disabled={pending} aria-live="polite"
      style={justSaved ? { background: "#1a7f4b", borderColor: "#1a7f4b", color: "#fff" } : undefined}>
      {pending ? "Saving…" : justSaved ? savedLabel : label}
    </button>
  );
}
