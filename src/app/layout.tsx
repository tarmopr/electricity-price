import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Estonia Electricity Prices',
  description: 'Live Nord Pool spot prices for electricity in Estonia',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className={`${inter.className} bg-zinc-950 text-zinc-50 min-h-screen selection:bg-green-500/30 selection:text-green-200`}>
        {children}
      </body>
    </html>
  );
}
