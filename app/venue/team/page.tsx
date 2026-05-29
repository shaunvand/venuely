import { createClient as createAdmin } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth/require-role";
import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { InviteManagerForm } from "./InviteManagerForm";
import { revokeInvite, removeMember, setReviewStatus } from "./actions";

type MemberRow = { user_id: string; is_primary: boolean; created_at: string };
type InviteRow = {
  id: string;
  email: string | null;
  status: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  created_at: string;
};
type ReviewRow = {
  id: string;
  author_name: string | null;
  rating: number | null;
  body: string | null;
  status: "pending" | "published" | "hidden";
  created_at: string;
};

// Cross-profile name lookup needs the service-role client: the profiles table's
// RLS only lets a user read their own row (or owner reads all), so a venue_admin
// can't see co-managers' names via the anon-keyed client.
function admin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return null;
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

export default async function VenueTeam() {
  const { user } = await requireRole(["venue_admin", "owner"]);
  const venue = await getCurrentVenue();
  const supabase = await createClient();

  const [membersRes, invitesRes, reviewsRes] = await Promise.all([
    supabase
      .from("venue_members")
      .select("user_id, is_primary, created_at")
      .eq("venue_id", venue.id)
      .order("created_at"),
    supabase
      .from("venue_invites")
      .select("id, email, status, expires_at, accepted_at, created_at")
      .eq("venue_id", venue.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("id, author_name, rating, body, status, created_at")
      .eq("venue_id", venue.id)
      .order("created_at", { ascending: false }),
  ]);

  const members = (membersRes.data ?? []) as MemberRow[];
  const invites = (invitesRes.data ?? []) as InviteRow[];
  const reviews = (reviewsRes.data ?? []) as ReviewRow[];

  // Resolve member display names (service-role; falls back to the id tail).
  const nameById: Record<string, { name: string | null }> = {};
  const ad = admin();
  if (ad && members.length > 0) {
    const { data: profiles } = await ad
      .from("profiles")
      .select("id, full_name")
      .in("id", members.map((m) => m.user_id));
    (profiles ?? []).forEach((p) => {
      nameById[p.id as string] = { name: (p.full_name as string | null) || null };
    });
  }

  const pendingInvites = invites.filter((i) => !i.accepted_at && i.status !== "accepted");
  const pendingReviews = reviews.filter((r) => r.status === "pending");
  const otherReviews = reviews.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-10">
      <header>
        <div className="vy-eyebrow">Settings</div>
        <h1 className="vy-h1 mt-1">Team &amp; reviews</h1>
        <p className="text-stone-600 text-sm mt-1">
          Add co-managers to {venue.name}, and moderate the reviews couples leave on your public
          listing.
        </p>
      </header>

      {/* ── Team ──────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="vy-h2">Managers</h2>

        <div className="vy-card p-0 overflow-hidden">
          <table className="vy-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const name = nameById[m.user_id]?.name;
                const isSelf = m.user_id === user.id;
                return (
                  <tr key={m.user_id}>
                    <td>
                      <span style={{ color: "var(--ink)", fontWeight: 500 }}>
                        {name || `Member ${m.user_id.slice(0, 8)}`}
                      </span>
                      {isSelf && <span className="vy-tag vy-tag-soft ml-2">You</span>}
                    </td>
                    <td>
                      {m.is_primary ? (
                        <span className="vy-tag vy-tag-active">Primary</span>
                      ) : (
                        <span className="vy-tag vy-tag-soft">Manager</span>
                      )}
                    </td>
                    <td style={{ color: "var(--ink-2)" }}>{fmtDate(m.created_at)}</td>
                    <td className="text-right">
                      {!m.is_primary && !isSelf && (
                        <form action={removeMember.bind(null, m.user_id)}>
                          <button type="submit" className="vy-btn-danger">Remove</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <InviteManagerForm />

        {pendingInvites.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Pending invites</h3>
            {pendingInvites.map((inv) => {
              const expired = inv.expires_at ? new Date(inv.expires_at).getTime() < Date.now() : false;
              return (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3"
                  style={{ border: "1px solid var(--line)" }}
                >
                  <div className="min-w-0">
                    <div className="text-sm truncate" style={{ color: "var(--ink)" }}>{inv.email || "—"}</div>
                    <div className="text-xs" style={{ color: "var(--ink-2)" }}>
                      Sent {fmtDate(inv.created_at)}
                      {inv.expires_at ? ` · ${expired ? "expired" : `expires ${fmtDate(inv.expires_at)}`}` : ""}
                    </div>
                  </div>
                  <form action={revokeInvite.bind(null, inv.id)}>
                    <button type="submit" className="vy-btn-danger">Cancel</button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Reviews moderation ───────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="vy-h2">Reviews</h2>
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          New reviews arrive as <strong>pending</strong> and stay hidden until you publish them.
          Published reviews show on your public listing at{" "}
          <span className="font-mono">/v/{venue.slug}</span>.
        </p>

        {pendingReviews.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
              Awaiting moderation ({pendingReviews.length})
            </h3>
            {pendingReviews.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        )}

        {otherReviews.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Published &amp; hidden</h3>
            {otherReviews.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        )}

        {reviews.length === 0 && (
          <div className="vy-empty">
            No reviews yet. Couples can leave one from your public listing once it&apos;s live.
          </div>
        )}
      </section>
    </div>
  );
}

function Stars({ value }: { value: number }) {
  const filled = Math.round(value);
  return (
    <span aria-label={`${value} out of 5`} className="inline-flex leading-none">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden style={{ color: n <= filled ? "var(--poppy)" : "var(--line)" }}>
          ★
        </span>
      ))}
    </span>
  );
}

function ReviewCard({ review: r }: { review: ReviewRow }) {
  const statusTag =
    r.status === "published" ? "vy-tag-active" : r.status === "hidden" ? "vy-tag-paused" : "vy-tag-trial";
  return (
    <div className="rounded-2xl bg-white p-4" style={{ border: "1px solid var(--line)" }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="font-serif text-base" style={{ color: "var(--ink)", fontWeight: 700 }}>
            {r.author_name || "Anonymous"}
          </span>
          {typeof r.rating === "number" && <Stars value={r.rating} />}
        </div>
        <span className={`vy-tag ${statusTag}`}>{r.status}</span>
      </div>
      {r.body && (
        <p className="text-sm mt-2 leading-relaxed whitespace-pre-line" style={{ color: "var(--ink-2)" }}>
          {r.body}
        </p>
      )}
      <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-2" style={{ borderColor: "var(--line)" }}>
        <span className="text-xs" style={{ color: "var(--ink-2)" }}>{fmtDate(r.created_at)}</span>
        <span className="flex-1" />
        {r.status !== "published" && (
          <form action={setReviewStatus.bind(null, r.id, "published")}>
            <button type="submit" className="vy-btn vy-btn-primary" style={{ padding: "0.35rem 0.8rem" }}>
              Publish
            </button>
          </form>
        )}
        {r.status !== "hidden" && (
          <form action={setReviewStatus.bind(null, r.id, "hidden")}>
            <button type="submit" className="vy-btn vy-btn-secondary" style={{ padding: "0.35rem 0.8rem" }}>
              Hide
            </button>
          </form>
        )}
        {r.status === "hidden" && (
          <form action={setReviewStatus.bind(null, r.id, "pending")}>
            <button type="submit" className="vy-btn vy-btn-ghost" style={{ padding: "0.35rem 0.8rem" }}>
              Move to pending
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
