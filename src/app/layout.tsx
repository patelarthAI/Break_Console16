import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/Toast';
import { ThemeProvider } from '@/context/ThemeContext';
import ErrorBoundary from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'Brigade Pulse',
  description: 'Presence Creates Momentum. Real-time attendance and break tracking for recruiters by Arth Global Systems.',
  keywords: ['Arth Global', 'recruiter', 'time tracker', 'attendance', 'break tracking', 'daily report'],
  robots: 'noindex, nofollow',
  icons: {
    icon: [{ url: '/logo.png', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3b82f6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className="dark"
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>

        <ThemeProvider>
          <ToastProvider>
            <main
              style={{
                paddingTop: 0,
                minHeight: '100vh',
                background: 'transparent',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </main>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

