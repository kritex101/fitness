import { Analytics } from '@vercel/analytics/next'
import { Geist } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import { PwaRegistration } from '@/components/pwa-registration'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'FitPilot — Training, on your terms',
  description: 'Private, evidence-informed fitness plans with body-area exercise guides, coach-matched tutorials, timed workout intervals, guided rest, and progress tracking.',
  applicationName: 'FitPilot',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'FitPilot',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icons/fitpilot-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/fitpilot-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/fitpilot-icon-192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light',
  themeColor: '#17251F',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-background" data-scroll-behavior="smooth">
      <body className={`${geist.variable} antialiased`}>
        {children}
        <PwaRegistration />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
