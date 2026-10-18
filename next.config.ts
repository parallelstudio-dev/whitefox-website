import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  trailingSlash: false,
  // Pages are generated from content/pages at build time.
  outputFileTracingIncludes: { "/**": ["./content/pages/**"] },
};

export default nextConfig;
