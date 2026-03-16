import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CosmoSentinel — Global Disease Intelligence',
  description: 'Real-time AI-powered global disease intelligence platform with 3D globe visualization, ICD-10/11 classification, genomic associations, ML forecasting, and outbreak detection.',
  keywords: ['disease surveillance', 'global disease intelligence', 'pandemic intelligence', 'outbreak detection', 'genomics', 'ICD-10', 'epidemiology'],
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
