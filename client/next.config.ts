import type { NextConfig } from "next";

const media = process.env.NEXT_PUBLIC_MEDIA_URL
  ? new URL(process.env.NEXT_PUBLIC_MEDIA_URL)
  : null;

const upgrade =
  process.env.NODE_ENV === "production" ? "; upgrade-insecure-requests" : "";
const csp = (frameAncestors: string) =>
  `object-src 'none'; base-uri 'self'; frame-ancestors ${frameAncestors}${upgrade}`;

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  {
    key: "Content-Security-Policy",
    value: csp("'none'"),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactCompiler: true,
  images: {
    remotePatterns: media
      ? [{ protocol: "https", hostname: media.hostname, pathname: "/**" }]
      : [],
    formats: ["image/avif", "image/webp"],
    qualities: [75, 90],
    minimumCacheTTL: 2_678_400,
  },
  experimental: {
    serverActions: { bodySizeLimit: "16mb" },
    proxyClientMaxBodySize: "16mb",
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/3ds-return",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Content-Security-Policy",
            value: csp("'self'"),
          },
        ],
      },
      {
        source: "/site/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
