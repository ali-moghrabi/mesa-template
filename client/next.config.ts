import type { NextConfig } from "next";

const media = process.env.NEXT_PUBLIC_MEDIA_URL
  ? new URL(process.env.NEXT_PUBLIC_MEDIA_URL)
  : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: media
      ? [{ protocol: "https", hostname: media.hostname, pathname: "/**" }]
      : [],
  },
  experimental: {
    serverActions: { bodySizeLimit: "16mb" },
    proxyClientMaxBodySize: "16mb",
  },
};

export default nextConfig;
