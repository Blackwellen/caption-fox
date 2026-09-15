import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optional alternate build dir so a production build can run alongside `next dev`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    // 90 is used for the homepage's product-demo photography (small crops that need to stay sharp).
    qualities: [75, 90],
  },
};

export default nextConfig;
