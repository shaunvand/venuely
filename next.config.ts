import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure the wedding-portal HTML template is bundled into the server output
  // so the [wedding] route handler can fs.readFileSync it at runtime on Render.
  outputFileTracingIncludes: {
    "/[wedding]": ["./templates/**/*"],
  },
  // Quick Import uploads can be 30MB+ packs of PDFs. Default 10MB cap breaks FormData parsing.
  experimental: {
    proxyClientMaxBodySize: "100mb",
    serverActions: { bodySizeLimit: "100mb" },
  },
};

export default nextConfig;
