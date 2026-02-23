import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Electricity Price in Estonia',
  description: 'Live Nord Pool spot prices for electricity in Estonia',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark scroll-smooth overflow-x-hidden w-full">
      <body className={`${inter.className} bg-zinc-950 text-zinc-50 min-h-screen overflow-x-hidden w-full selection:bg-green-500/30 selection:text-green-200 relative`}>
        {/* Animated Background */}
        <div className="fixed inset-0 z-0 pointer-events-none bg-mesh-gradient"></div>

        <div className="relative z-10 w-full min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
