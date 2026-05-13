import { VenuelyLogo } from "@/components/VenuelyLogo";

export default function BrandPage() {
  return (
    <main className="min-h-screen bg-stone-50 p-12 space-y-12">
      <header className="max-w-3xl">
        <div className="text-xs uppercase tracking-widest text-stone-500">Brand</div>
        <h1 className="font-serif text-4xl mt-2">Venuely logo</h1>
        <p className="text-stone-600 text-sm mt-2">
          A minimal venue arch — the universal symbol of a wedding altar — paired with the wordmark in a refined serif.
          Pure SVG, scales infinitely, editable in <code>components/VenuelyLogo.tsx</code>.
        </p>
      </header>

      <section className="space-y-3">
        <div className="text-xs uppercase tracking-widest text-stone-500">Primary lockup</div>
        <div className="bg-white rounded-xl border border-stone-200 p-12 flex items-center justify-center">
          <VenuelyLogo variant="full" className="h-24" />
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-widest text-stone-500">Mark only</div>
          <div className="bg-white rounded-xl border border-stone-200 p-10 flex items-center justify-center h-40">
            <VenuelyLogo variant="mark" className="h-20" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-widest text-stone-500">Wordmark only</div>
          <div className="bg-white rounded-xl border border-stone-200 p-10 flex items-center justify-center h-40">
            <VenuelyLogo variant="wordmark" className="h-12" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-widest text-stone-500">Reverse (on forest)</div>
          <div className="rounded-xl p-10 flex items-center justify-center h-40" style={{ background: "#2d4a3a" }}>
            <VenuelyLogo variant="full" className="h-16" color="#f5efe6" />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="text-xs uppercase tracking-widest text-stone-500">Sizes</div>
        <div className="bg-white rounded-xl border border-stone-200 p-10 flex items-end gap-12">
          <VenuelyLogo variant="full" className="h-6" />
          <VenuelyLogo variant="full" className="h-10" />
          <VenuelyLogo variant="full" className="h-16" />
          <VenuelyLogo variant="full" className="h-24" />
        </div>
      </section>

      <section className="space-y-3">
        <div className="text-xs uppercase tracking-widest text-stone-500">Colour palette</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: "Forest", hex: "#2d4a3a" },
            { name: "Sage", hex: "#5e7a6a" },
            { name: "Cream", hex: "#f5efe6" },
            { name: "Gold", hex: "#b8762a" },
          ].map((c) => (
            <div key={c.hex} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="h-24" style={{ background: c.hex }} />
              <div className="px-4 py-3 text-sm">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-stone-500 font-mono">{c.hex}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
