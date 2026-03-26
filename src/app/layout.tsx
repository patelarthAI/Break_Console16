import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/Toast';
export const metadata: Metadata = {
  title: 'Brigade Pulse',
  description: 'Presence Creates Momentum. Real-time attendance and break tracking for recruiters by Arth Global Systems.',
  keywords: ['Arth Global', 'recruiter', 'time tracker', 'attendance', 'break tracking', 'daily report'],
  robots: 'noindex, nofollow',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3b82f6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
      </head>
      <body className="antialiased font-sans" suppressHydrationWarning>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
