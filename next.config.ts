import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure the wedding-portal HTML template is bundled into the server output
  // so the [wedding] route handler can fs.readFileSync it at runtime on Render.
  outputFileTracingIncludes: {
    "/[wedding]": ["./templates/**/*"],
  },
};

export default nextConfig;
