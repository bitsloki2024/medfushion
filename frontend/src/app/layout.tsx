import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PATHOSENSE — Intelligent Global Disease Surveillance',
  description: 'Real-time AI-powered pandemic intelligence system with 3D globe visualization, ML forecasting, and anomaly detection.',
  keywords: ['disease surveillance', 'pandemic intelligence', 'global health', 'outbreak detection'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-[#000814] text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
