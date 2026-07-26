import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Budget Tracker',
  description: 'Personal finance and budget tracking app',
  applicationName: 'Budget Tracker',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    // Point apple-touch-icon at the generated PNG route explicitly. Declaring
    // `icons.icon` above suppresses the automatic link from app/apple-icon.tsx,
    // so without this iOS gets no home-screen icon.
    apple: [{ url: '/apple-icon', sizes: '180x180', type: 'image/png' }],
  },
  // Drives the iOS "add to home screen" experience: launches without Safari
  // chrome and shows this title under the icon.
  appleWebApp: {
    capable: true,
    title: 'Budget',
    // The app's top chrome is dark (slate-900) everywhere, so use the
    // translucent style — its status-bar text is white and stays readable.
    // Content extends under the bar; the mobile top bar's safe-area padding
    // keeps its logo/menu below the inset.
    statusBarStyle: 'black-translucent',
  },
  // Belt-and-suspenders for older iOS, which honours only the apple-prefixed
  // capable meta. Modern iOS (16.4+) reads the manifest's display:standalone.
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Let content extend under the notch/home indicator; pages opt back in with
  // env(safe-area-inset-*) padding where it matters.
  viewportFit: 'cover',
  themeColor: '#4f46e5',
  colorScheme: 'light',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full`} style={{ colorScheme: 'light' }}>
      <body className="h-full antialiased">{children}</body>
    </html>
  )
}
