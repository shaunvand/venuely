import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native binary — must stay external (Turbopack can't bundle the .node addon).
  serverExternalPackages: ["@napi-rs/canvas"],
  // Quick Import uploads can be 30MB+ packs of PDFs. Default 10MB cap breaks FormData parsing.
  experimental: {
    proxyClientMaxBodySize: "100mb",
    serverActions: { bodySizeLimit: "100mb" },
    // Don't reuse dynamic pages from the client router cache — otherwise a save on
    // one tab (e.g. seating) leaves another (the Inventory hub) showing stale counts
    // until a hard reload. revalidatePath fixes the server cache; this fixes the
    // browser-side cache so soft navigations always refetch fresh data.
    staleTimes: { dynamic: 0 },
  },
};

export default nextConfig;
