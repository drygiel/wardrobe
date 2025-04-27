import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'dist',
  basePath: process.env.NEXT_PUBLIC_BASEPATH || '',
  eslint: {
    ignoreDuringBuilds: !!process.env.GITHUB_PAGES,
  },
};

export default nextConfig;
