import { RsvpForm } from "@/components/RsvpForm";

export const dynamic = "force-dynamic";

// Public, white-label RSVP page. All data is fetched client-side from
// /api/rsvp/[token] (the token is the only credential), so this stays a thin shell.
export default async function RsvpPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <RsvpForm token={token} />;
}
