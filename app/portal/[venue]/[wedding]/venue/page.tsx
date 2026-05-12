import { getPortalContext } from "@/lib/portal/context";

export default async function OurVenue({ params }: { params: Promise<{ venue: string; wedding: string }> }) {
  const { venue: vSlug, wedding: wSlug } = await params;
  const { venue } = await getPortalContext(vSlug, wSlug);

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-semibold">Our Venue</h1>
      <h2 className="text-xl">{venue.name}</h2>
      <p className="text-gray-600">{venue.region}</p>
      <p>
        Pat Busch Mountain Reserve sits in a fynbos-and-vineyard valley outside Robertson, Western Cape.
        The estate features a Barn venue, multiple cottages, a lakeside ceremony arch, and on-site accommodation
        for up to 80 guests.
      </p>
      <p className="text-sm text-gray-500">
        (Phase 2 stub — fuller venue page with photos to be ported from the reference HTML.)
      </p>
    </div>
  );
}
