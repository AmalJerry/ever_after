import type { NextConfig } from "next";

const apiOrigin = process.env.DJANGO_API_ORIGIN ||
  (process.env.DJANGO_API_HOSTPORT ? `http://${process.env.DJANGO_API_HOSTPORT}` : "http://127.0.0.1:8000");

if (process.env.RENDER === "true" && !process.env.DJANGO_API_ORIGIN && !process.env.DJANGO_API_HOSTPORT) {
  throw new Error("Configure DJANGO_API_HOSTPORT or DJANGO_API_ORIGIN before building on Render.");
}

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: { root: __dirname },
  skipTrailingSlashRedirect: true,
  experimental: { proxyClientMaxBodySize: "55mb" },
  images: {
    localPatterns: [
      { pathname: "/images/**", search: "" },
      { pathname: "/animations/**", search: "" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin.replace(/\/$/, "")}/api/:path*/`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
