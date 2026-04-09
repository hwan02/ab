import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "sdtstqyuglhjnpznndde.supabase.co",
      },
    ],
  },
};

export default nextConfig;
