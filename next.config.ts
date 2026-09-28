import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { BASE_PATH } from "./src/lib/site";

const nextConfig: NextConfig = {
  output: "export",
  ...(BASE_PATH ? { basePath: BASE_PATH, assetPrefix: BASE_PATH } : {}),
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
  // src/app/global-not-found.tsx serves unmatched URLs. The app has no single root layout for a plain not-found.tsx.
  experimental: { globalNotFound: true },
};

export default function config(phase: string): NextConfig {
  if (phase !== PHASE_DEVELOPMENT_SERVER || !BASE_PATH) return nextConfig;
  // `next dev` only serves the base path, so the bare localhost address would be a 404. The static export never sees this.
  return {
    ...nextConfig,
    redirects: async () => [{ source: "/", destination: `${BASE_PATH}/`, basePath: false, permanent: false }],
  };
}
