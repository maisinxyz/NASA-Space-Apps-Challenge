import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OFFLINE=1 at build/dev time -> client reads only local files (lib/api/client.ts).
  env: { NEXT_PUBLIC_OFFLINE: process.env.OFFLINE ?? "" },
};

export default nextConfig;
