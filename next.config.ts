import type { NextConfig } from "next";
import site from "./config/site.json";

const nextConfig: NextConfig = {
  output: "export",
  basePath: site.basePath,
  assetPrefix: site.basePath,
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
};

export default nextConfig;
