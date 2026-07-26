import type { MetadataRoute } from 'next'

// Served at /manifest.webmanifest. Makes the app installable to the home
// screen and, in standalone mode, launches without browser chrome.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Budget Tracker',
    short_name: 'Budget',
    description: 'Personal finance and budget tracking',
    // Open straight into the app rather than the marketing/login root.
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#4f46e5',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon-maskable.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  }
}
