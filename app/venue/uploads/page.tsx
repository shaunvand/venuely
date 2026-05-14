import { getCurrentVenue } from "@/lib/venue/current";
import { BulkUploader } from "@/components/BulkUploader";

export default async function UploadsPage() {
  const venue = await getCurrentVenue();
  return (
    <div className="space-y-8">
      <header>
        <div className="vy-eyebrow">Customers · bulk import</div>
        <h1 className="vy-h1 mt-1">Uploads</h1>
        <p className="text-stone-600 text-sm mt-1">
          Drop in any mix of PDF quotes, brochures, supplier lists or Excel/CSV exports.
          We&apos;ll extract each line, categorise it (catalogue / rentals / accommodation / 7 vendor types),
          and let you review and edit before it lands in your dashboards.
        </p>
      </header>

      <BulkUploader venueId={venue.id} />
    </div>
  );
}
