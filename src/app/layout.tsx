import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const cairo = Cairo({
  subsets: ['arabic'],
  display: 'swap',
  variable: '--font-cairo',
});

export const metadata: Metadata = {
  title: 'الفرماوي جروب للتجارة والتوزيع — منصة التوريدات',
  description: 'منصة الفرماوي جروب للتجارة والتوزيع - توريدات الجملة والتجزئة بأفضل الأسعار',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('theme') || localStorage.getItem('app-theme');
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className={`${cairo.className} bg-slate-50 text-slate-900 antialiased min-h-screen`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
