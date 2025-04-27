import type { NextConfig } from 'next';

console.log('🍉 BASEPATH', process.env.BASEPATH);

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'dist',
  env: {
    BASEPATH: process.env.BASEPATH || '',
  },
};

export default nextConfig;
