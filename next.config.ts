import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "@youtube-core": path.resolve(
        __dirname,
        "packages/youtube-learning-path/src/core"
      ),
    },
  },
};

export default nextConfig;
