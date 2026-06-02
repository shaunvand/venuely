// Brand-palette colours for wedding + enquiry statuses, so the pipeline reads at
// a glance. Returns a soft background + readable text.
export function statusColor(status: string | null | undefined): { bg: string; text: string } {
  switch ((status ?? "").toLowerCase()) {
    case "booked":
      return { bg: "var(--leaf)", text: "#1f5d3e" };          // green — confirmed
    case "inquiry":
    case "new":
    case "interest":
      return { bg: "var(--sage-2)", text: "#3f5246" };        // sage — early lead
    case "provisional":
    case "quoted":
      return { bg: "#FAF2E8", text: "#8a6a1f" };              // gold — in progress
    case "in_planning":
      return { bg: "var(--peach)", text: "var(--poppy-deep)" }; // peach — active planning
    case "completed":
      return { bg: "var(--cream)", text: "var(--sage)" };     // calm — done
    case "cancelled":
    case "lost":
      return { bg: "#fdecea", text: "#b42318" };              // red — dead
    default:
      return { bg: "var(--bone)", text: "var(--ink-2)" };
  }
}
