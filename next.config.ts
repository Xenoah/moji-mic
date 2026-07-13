import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/").pop() || "moji-mic";
const pagesBasePath = process.env.NEXT_PUBLIC_BASE_PATH || `/${repositoryName}`;

const nextConfig: NextConfig = isGitHubPages
  ? {
      output: "export",
      basePath: pagesBasePath,
      assetPrefix: pagesBasePath,
      trailingSlash: true,
      images: { unoptimized: true },
      typescript: { tsconfigPath: "tsconfig.pages.json" },
      env: { NEXT_PUBLIC_BASE_PATH: pagesBasePath },
    }
  : {
      env: { NEXT_PUBLIC_BASE_PATH: "" },
    };

export default nextConfig;
