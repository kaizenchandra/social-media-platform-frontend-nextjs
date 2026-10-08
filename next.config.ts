import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security/headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  headers: async () => [{ source: "/:path*", headers: securityHeaders }],
  // Isolate browser-test output from an already-running IDE development server.
  distDir:
    process.env.COMMON_AUTH_TEST_RUN === "1" ? ".next/auth-preview" : ".next",
  // Keep the framework indicator from obscuring mobile navigation in previews.
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
