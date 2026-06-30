import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native binary — must stay external (Turbopack can't bundle the .node addon).
  serverExternalPackages: ["@napi-rs/canvas"],
  // Quick Import uploads can be 30MB+ packs of PDFs. Default 10MB cap breaks FormData parsing.
  experimental: {
    proxyClientMaxBodySize: "100mb",
    serverActions: { bodySizeLimit: "100mb" },
  },
};

export default nextConfig;
