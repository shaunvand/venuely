import { getCurrentVenue } from "@/lib/venue/current";
import { createAdminClient } from "@/lib/supabase/server";
import { addTable, updateTable, deleteTable } from "./actions";
import { SaveButton } from "@/components/SaveButton";

const SHAPES = ["round", "square", "long", "other"];

export default async function VenueSeating() {
  const venue = await getCurrentVenue();
  const db = createAdminClient();
  const { data: tables } = db
    ? await db.from("venue_tables").select("id, label, shape, seats, quantity").eq("venue_id", venue.id).order("sort_order").order("created_at")
    : { data: [] };
  const rows = (tables ?? []) as Array<{ id: string; label: string; shape: string; seats: number; quantity: number }>;
  const totalTables = rows.reduce((s, r) => s + r.quantity, 0);
  const totalSeats = rows.reduce((s, r) => s + r.quantity * r.seats, 0);

  return (
    <div className="space-y-8">
      <header>
        <div className="vy-eyebrow">Setup</div>
        <h1 className="vy-h1 mt-1">Seating &amp; tables</h1>
        <p className="text-stone-600 text-sm mt-1">
          Define the tables you have — type, how many seats each, and how many of them. Couples plan their seating from exactly what you offer.
        </p>
      </header>

      <form action={addTable} className="vy-card grid gap-3 md:grid-cols-6 items-end">
        <div className="md:col-span-2 space-y-1">
          <label className="vy-label">Table name</label>
          <input name="label" required placeholder="Round banquet table" className="vy-input" />
        </div>
        <div className="space-y-1">
          <label className="vy-label">Shape</label>
          <select name="shape" defaultValue="round" className="vy-select">
            {SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="vy-label">Seats each</label>
          <input name="seats" type="number" min="1" defaultValue={8} className="vy-input" />
        </div>
        <div className="space-y-1">
          <label className="vy-label">How many</label>
          <input name="quantity" type="number" min="1" defaultValue={1} className="vy-input" />
        </div>
        <div className="flex"><button className="vy-btn vy-btn-primary w-full">+ Add</button></div>
      </form>

      {rows.length === 0 ? (
        <div className="vy-empty">No tables yet — add your round/long/square tables above.</div>
      ) : (
        <>
          <div className="text-sm text-stone-600">{totalTables} table{totalTables === 1 ? "" : "s"} · seats up to <strong>{totalSeats}</strong> guests</div>
          <div className="space-y-3">
            {rows.map((t) => (
              <form key={t.id} action={updateTable.bind(null, t.id)} className="vy-card grid gap-3 md:grid-cols-6 items-end">
                <div className="md:col-span-2 space-y-1"><label className="vy-label">Table name</label><input name="label" defaultValue={t.label} className="vy-input" /></div>
                <div className="space-y-1"><label className="vy-label">Shape</label><select name="shape" defaultValue={t.shape} className="vy-select">{SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
                <div className="space-y-1"><label className="vy-label">Seats each</label><input name="seats" type="number" min="1" defaultValue={t.seats} className="vy-input" /></div>
                <div className="space-y-1"><label className="vy-label">How many</label><input name="quantity" type="number" min="1" defaultValue={t.quantity} className="vy-input" /></div>
                <div className="flex gap-2">
                  <SaveButton label="Save" className="vy-btn vy-btn-secondary text-xs flex-1" />
                  <button formAction={deleteTable.bind(null, t.id)} className="vy-btn vy-btn-danger text-xs">✕</button>
                </div>
              </form>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
