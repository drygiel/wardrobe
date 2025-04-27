import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'dist',
  basePath: process.env.NEXT_PUBLIC_BASEPATH || '',
  eslint: {
    ignoreDuringBuilds: process.env.GITHUB_PAGES === 'true',
  },
  env: {
    NEXT_PUBLIC_BASEPATH: process.env.NEXT_PUBLIC_BASEPATH || '',
  },
};

export default nextConfig;
