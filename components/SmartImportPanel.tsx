import { BulkUploader } from "@/components/BulkUploader";

// The ONE "Smart Import" surface, reused across every inventory page (catalogue,
// rentals, accommodation, suppliers). Collapsed by default so it doesn't crowd
// the list. Same engine + same name everywhere — no more competing importers.
export function SmartImportPanel({
  venueId,
  title = "Smart Import — fill this in from a document",
  blurb = "Missed this in setup? Upload a PDF, Excel, Word or CSV and Smart Import reads it and pre-fills the list — you review before anything saves.",
}: {
  venueId: string;
  title?: string;
  blurb?: string;
}) {
  return (
    <details className="rounded-2xl group" style={{ border: "1px solid var(--line)", background: "var(--cream)" }}>
      <summary className="cursor-pointer select-none list-none px-5 py-4 flex items-center gap-3">
        <span className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0" style={{ background: "var(--peach)" }}>✨</span>
        <span className="flex-1 min-w-0">
          <span className="font-serif text-lg block leading-tight" style={{ fontWeight: 700 }}>{title}</span>
          <span className="text-sm" style={{ color: "var(--ink-2)" }}>{blurb}</span>
        </span>
        <span className="text-xs flex-shrink-0" style={{ color: "var(--poppy)" }}>
          <span className="group-open:hidden">Open ▾</span>
          <span className="hidden group-open:inline">Close ▴</span>
        </span>
      </summary>
      <div className="px-5 pb-5 pt-1">
        <BulkUploader venueId={venueId} />
      </div>
    </details>
  );
}
