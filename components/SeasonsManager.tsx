"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addSeason, updateSeason, deleteSeason, quickAddSASeasons,
  addAreaGroup, updateAreaGroup, deleteAreaGroup,
} from "@/app/venue/areas/actions";

export type SeasonRow = {
  id: string;
  name: string;
  start_month: number; start_day: number;
  end_month: number; end_day: number;
  sort_order?: number | null;
};

export type GroupRow = {
  id: string;
  name: string;
  included: boolean;
  location: "venue" | "offsite";
  sort_order?: number | null;
};

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function seasonRangeLabel(s: SeasonRow): string {
  return `${s.start_day} ${MONTHS[s.start_month] ?? "?"} – ${s.end_day} ${MONTHS[s.end_month] ?? "?"}`;
}

export function SeasonsManager({
  venueId,
  seasons,
  groups,
}: {
  venueId: string;
  seasons: SeasonRow[];
  groups: GroupRow[];
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <SeasonsPanel venueId={venueId} seasons={seasons} />
      <GroupsPanel venueId={venueId} groups={groups} />
    </div>
  );
}

/* ── Seasons ───────────────────────────────────────────────────────────── */

function SeasonsPanel({ venueId, seasons }: { venueId: string; seasons: SeasonRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function run(fn: () => Promise<void>) {
    setErr(null);
    startTransition(async () => {
      try { await fn(); router.refresh(); }
      catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong"); }
    });
  }

  return (
    <div className="vy-card space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-serif text-lg" style={{ fontWeight: 700 }}>Seasons</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--ink-2)" }}>
            Recurring date ranges that set the wedding-day price (Meet &amp; Greet and Farewell stay one price).
          </p>
        </div>
        <form action={() => run(() => quickAddSASeasons(venueId))}>
          <button type="submit" disabled={pending} className="vy-btn vy-btn-ghost text-xs whitespace-nowrap">
            + Quick-add 4 SA seasons
          </button>
        </form>
      </div>

      {seasons.length === 0 ? (
        <div className="vy-empty text-sm">No seasons yet — add Peak/High/Low, or use the quick-add.</div>
      ) : (
        <ul className="space-y-2">
          {seasons.map((s) => (
            <li key={s.id}>
              {editingId === s.id ? (
                <SeasonForm
                  season={s}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(fd) => run(async () => { await updateSeason(s.id, fd); setEditingId(null); })}
                  pending={pending}
                />
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ border: "1px solid var(--line)" }}>
                  <div className="text-sm min-w-0">
                    <span className="font-medium">{s.name}</span>
                    <span className="ml-2" style={{ color: "var(--ink-2)" }}>· {seasonRangeLabel(s)}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button type="button" onClick={() => setEditingId(s.id)} className="text-xs hover:underline" style={{ color: "var(--ink-2)" }}>Edit</button>
                    <button type="button" onClick={() => run(() => deleteSeason(s.id))} disabled={pending} className="text-xs hover:underline" style={{ color: "var(--poppy)" }}>Remove</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editingId === "new" ? (
        <SeasonForm
          onCancel={() => setEditingId(null)}
          onSubmit={(fd) => run(async () => { await addSeason(venueId, fd); setEditingId(null); })}
          pending={pending}
        />
      ) : (
        <button type="button" onClick={() => setEditingId("new")} className="vy-btn vy-btn-secondary text-xs">+ Add season</button>
      )}
      {err && <p className="text-xs" style={{ color: "#b42318" }}>{err}</p>}
    </div>
  );
}

function SeasonForm({
  season,
  onSubmit,
  onCancel,
  pending,
}: {
  season?: SeasonRow;
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  return (
    <form
      action={(fd) => onSubmit(fd)}
      className="rounded-lg p-3 space-y-2"
      style={{ border: "1px solid var(--line)", background: "var(--cream)" }}
    >
      <div className="space-y-1">
        <label className="vy-label">Season name</label>
        <input name="name" required defaultValue={season?.name ?? ""} placeholder="Peak" className="vy-input" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="vy-label">Start (month / day)</label>
          <div className="flex gap-1.5">
            <input name="start_month" type="number" min="1" max="12" required defaultValue={season?.start_month ?? ""} placeholder="MM" className="vy-input" />
            <input name="start_day" type="number" min="1" max="31" required defaultValue={season?.start_day ?? ""} placeholder="DD" className="vy-input" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="vy-label">End (month / day)</label>
          <div className="flex gap-1.5">
            <input name="end_month" type="number" min="1" max="12" required defaultValue={season?.end_month ?? ""} placeholder="MM" className="vy-input" />
            <input name="end_day" type="number" min="1" max="31" required defaultValue={season?.end_day ?? ""} placeholder="DD" className="vy-input" />
          </div>
        </div>
      </div>
      <p className="text-[11px]" style={{ color: "var(--ink-2)" }}>A season may wrap the year-end (e.g. start 12/1, end 2/28).</p>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="vy-btn vy-btn-ghost text-xs">Cancel</button>
        <button type="submit" disabled={pending} className="vy-btn vy-btn-primary text-xs">{season ? "Save" : "Add season"}</button>
      </div>
    </form>
  );
}

/* ── Sub-category groups ───────────────────────────────────────────────── */

function GroupsPanel({ venueId, groups }: { venueId: string; groups: GroupRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function run(fn: () => Promise<void>) {
    setErr(null);
    startTransition(async () => {
      try { await fn(); router.refresh(); }
      catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong"); }
    });
  }

  return (
    <div className="vy-card space-y-4">
      <div>
        <h3 className="font-serif text-lg" style={{ fontWeight: 700 }}>Sub-categories</h3>
        <p className="text-xs mt-0.5" style={{ color: "var(--ink-2)" }}>
          Group areas (e.g. Gardens, Cottages, Offsite chapel). Each group is Included with a booking or an Extra, at the venue or offsite.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="vy-empty text-sm">No sub-categories yet — add one to group your areas.</div>
      ) : (
        <ul className="space-y-2">
          {groups.map((g) => (
            <li key={g.id}>
              {editingId === g.id ? (
                <GroupForm
                  group={g}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(fd) => run(async () => { await updateAreaGroup(g.id, fd); setEditingId(null); })}
                  pending={pending}
                />
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ border: "1px solid var(--line)" }}>
                  <div className="text-sm min-w-0 flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{g.name}</span>
                    <GroupBadges group={g} />
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button type="button" onClick={() => setEditingId(g.id)} className="text-xs hover:underline" style={{ color: "var(--ink-2)" }}>Edit</button>
                    <button type="button" onClick={() => run(() => deleteAreaGroup(g.id))} disabled={pending} className="text-xs hover:underline" style={{ color: "var(--poppy)" }}>Remove</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editingId === "new" ? (
        <GroupForm
          onCancel={() => setEditingId(null)}
          onSubmit={(fd) => run(async () => { await addAreaGroup(venueId, fd); setEditingId(null); })}
          pending={pending}
        />
      ) : (
        <button type="button" onClick={() => setEditingId("new")} className="vy-btn vy-btn-secondary text-xs">+ Add sub-category</button>
      )}
      {err && <p className="text-xs" style={{ color: "#b42318" }}>{err}</p>}
    </div>
  );
}

export function GroupBadges({ group }: { group: Pick<GroupRow, "included" | "location"> }) {
  const offsite = group.location === "offsite";
  return (
    <>
      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md" style={{ background: "var(--cream)", color: "var(--poppy-deep)" }}>
        {offsite || !group.included ? "Extra" : "Included"}
      </span>
      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md" style={{ background: "var(--bone)", color: "var(--ink-2)" }}>
        {offsite ? "Offsite" : "At venue"}
      </span>
    </>
  );
}

function GroupForm({
  group,
  onSubmit,
  onCancel,
  pending,
}: {
  group?: GroupRow;
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  // Track location so the "Included" toggle can disable when offsite (offsite is
  // always Extra). Submitting still passes location + included; the action
  // forces included=false for offsite regardless.
  const [location, setLocation] = useState<"venue" | "offsite">(group?.location ?? "venue");
  return (
    <form
      action={(fd) => onSubmit(fd)}
      className="rounded-lg p-3 space-y-2"
      style={{ border: "1px solid var(--line)", background: "var(--cream)" }}
    >
      <div className="space-y-1">
        <label className="vy-label">Sub-category name</label>
        <input name="name" required defaultValue={group?.name ?? ""} placeholder="Gardens" className="vy-input" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="vy-label">Location</label>
          <select name="location" className="vy-select" value={location} onChange={(e) => setLocation(e.target.value as "venue" | "offsite")}>
            <option value="venue">At the venue</option>
            <option value="offsite">Offsite</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="vy-label">Pricing</label>
          <select name="included" className="vy-select" defaultValue={group?.included ? "true" : "false"} disabled={location === "offsite"}>
            <option value="true">Included with booking</option>
            <option value="false">Extra (paid)</option>
          </select>
        </div>
      </div>
      {location === "offsite" && (
        <p className="text-[11px]" style={{ color: "var(--ink-2)" }}>Offsite spaces are always Extra (paid) and seasonally priced.</p>
      )}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="vy-btn vy-btn-ghost text-xs">Cancel</button>
        <button type="submit" disabled={pending} className="vy-btn vy-btn-primary text-xs">{group ? "Save" : "Add sub-category"}</button>
      </div>
    </form>
  );
}
