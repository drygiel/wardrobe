import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'dist',
  env: {
    BASEPATH: process.env.BASEPATH || '',
  },
};

export default nextConfig;
