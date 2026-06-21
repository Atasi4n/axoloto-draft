import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compile the shared workspace package (ships TypeScript source).
  transpilePackages: ["@axoloto/supabase"],
};

export default nextConfig;
