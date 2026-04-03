import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'StockWise — Portfolio Intelligence',
  description: 'Track, analyze, and discover stocks with AI-powered insights.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        {/* Apply saved theme before page renders to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            const s = JSON.parse(localStorage.getItem('sw_settings') || '{}');
            const theme = s.theme || 'dark';
            const h = document.documentElement;
            if (theme === 'light') {
              h.classList.remove('dark'); h.classList.add('light');
            } else if (theme === 'system') {
              const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              h.classList.toggle('dark', dark); h.classList.toggle('light', !dark);
            } else {
              h.classList.add('dark'); h.classList.remove('light');
            }
          } catch(e) {}
        `}} />
      </head>
      <body className={inter.className + ' bg-surface text-white antialiased'}>
        {children}
      </body>
    </html>
  );
}