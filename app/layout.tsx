import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { Geist, Geist_Mono } from 'next/font/google';
import './layout.scss';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Szafa 2025',
  description: 'Projet szafy do gabinetu 2025',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AntdRegistry>{children}</AntdRegistry>
      </body>
    </html>
  );
}
