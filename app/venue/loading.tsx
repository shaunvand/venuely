// Content-pane skeleton for /venue/* routes. The venue layout (sidebar) persists
// during navigation, so only the main content area is skeletonned. Blocks mirror
// the overview page: header, stat row, big calendar.
export default function VenueLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading page">
      {/* Header bar */}
      <div className="space-y-2.5">
        <div className="vy-skeleton h-3 w-24" />
        <div className="vy-skeleton h-9 w-72 max-w-full" />
        <div className="vy-skeleton h-4 w-96 max-w-full" />
      </div>

      {/* Stat blocks */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="vy-skeleton h-24" />
        ))}
      </div>

      {/* Large calendar block */}
      <div className="vy-skeleton h-[440px]" />
    </div>
  );
}
