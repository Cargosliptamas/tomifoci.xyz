import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import PwaRegister from '../components/pwa-register'

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-inter'
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono'
})

export const metadata: Metadata = {
  title: 'Tomifoci 2026 — VB Tippjáték',
  description: 'Világbajnoki tippjáték 2026 — eredmény-tipp, Wizard of ODDS és Svájci liga.',
  icons: { icon: '/favicon.svg' },
  manifest: '/manifest.webmanifest'
}

export const viewport: Viewport = {
  themeColor: '#00B8A9',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu" className={`${inter.variable} ${mono.variable}`}>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  )
}
