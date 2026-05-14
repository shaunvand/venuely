"use client";

import { useState, useTransition } from "react";

export function PortalLinkCard({
  portalUrl,
  passwordSet,
  setPasswordAction,
}: {
  portalUrl: string;
  passwordSet: boolean;
  setPasswordAction: (formData: FormData) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pw, setPw] = useState("");
  const [isPending, startTransition] = useTransition();

  function copyUrl() {
    navigator.clipboard.writeText(portalUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function submit() {
    const fd = new FormData();
    fd.set("password", pw);
    startTransition(async () => {
      await setPasswordAction(fd);
      setEditing(false); setPw("");
    });
  }
  function clearPw() {
    const fd = new FormData();
    fd.set("password", "");
    startTransition(async () => { await setPasswordAction(fd); });
  }

  return (
    <div className="vy-card space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="vy-eyebrow">Couple portal access</div>
        <span className={`vy-tag ${passwordSet ? "vy-tag-active" : "vy-tag-soft"}`}>
          {passwordSet ? "🔒 password protected" : "open (Supabase login)"}
        </span>
      </div>

      <div className="flex gap-2">
        <input readOnly value={portalUrl} className="flex-1 vy-input font-mono text-sm" />
        <button onClick={copyUrl} className="vy-btn vy-btn-secondary whitespace-nowrap">
          {copied ? "✓ Copied" : "Copy URL"}
        </button>
      </div>

      {!editing ? (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setEditing(true)} className="vy-btn vy-btn-ghost text-sm">
            {passwordSet ? "Change password" : "Set a password"}
          </button>
          {passwordSet && (
            <button onClick={clearPw} disabled={isPending} className="vy-btn vy-btn-ghost text-sm">
              Remove password
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-2 items-center flex-wrap">
          <input
            type="text"
            autoFocus
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="New password"
            className="vy-input flex-1 min-w-[200px]"
          />
          <button disabled={isPending || !pw.trim()} onClick={submit} className="vy-btn vy-btn-primary">
            {isPending ? "Saving…" : "Save"}
          </button>
          <button onClick={() => { setEditing(false); setPw(""); }} className="vy-btn vy-btn-ghost">Cancel</button>
        </div>
      )}

      <p className="text-xs text-stone-500">
        With a password set, the couple opens the URL and enters the password — no Venuely account required.
        Without one, they must sign in with their Supabase email.
      </p>
    </div>
  );
}
