import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Outfit } from 'next/font/google';

import { APP_NAME, APP_TAGLINE } from '@/lib/constants';
import { QueryProvider } from '@/components/providers/query-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Toaster } from '@/components/providers/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LocaleProvider } from '@/i18n/provider';
import { resolveLocale } from '@/i18n/server';

import './globals.css';

// Outfit carries the whole interface, headings included — a single geometric
// face is what gives the Obsidian Electric direction its uniform, machined feel.
const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-outfit',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: `${APP_NAME} — ${APP_TAGLINE}`, template: `%s · ${APP_NAME}` },
  description:
    'A realtime messaging workspace with threads, groups, presence and search — fast, private and beautiful.',
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icons/favicon.png', sizes: '48x48', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    // iOS ignores the manifest icons for the home screen and looks for this.
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eef1f2' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // El idioma se resuelve en el servidor para que el primer pintado ya venga en
  // el correcto. Hacerlo en el cliente ensenaria un parpadeo en ingles a todo
  // el que no lo hable, que es justo a quien va dirigido esto.
  const locale = await resolveLocale();

  return (
    <html
      lang={locale.toLowerCase()}
      suppressHydrationWarning
      data-accent="electric"
      className={`${outfit.variable} ${jetbrains.variable}`}
    >
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          <QueryProvider>
            <TooltipProvider delayDuration={260} skipDelayDuration={400}>
              <LocaleProvider locale={locale}>
                {children}
                <Toaster />
              </LocaleProvider>
            </TooltipProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
