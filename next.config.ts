import type { NextConfig } from 'next';

console.log('ENV', {
  NEXT_PUBLIC_BASEPATH: process.env.NEXT_PUBLIC_BASEPATH,
  GITHUB_PAGES: process.env.GITHUB_PAGES,
});

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'dist',
  basePath: process.env.NEXT_PUBLIC_BASEPATH || '',
  eslint: {
    ignoreDuringBuilds: process.env.GITHUB_PAGES === 'true',
  },
  typescript: {
    ignoreBuildErrors: process.env.GITHUB_PAGES === 'true',
  },
};

export default nextConfig;
