import React from "react"
import type { Metadata } from 'next'
import { Instrument_Serif, Geist, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { PostHogProvider } from './providers'
import './globals.css'

const serif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
})

const sans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: "e-Snack — Plateforme de commande clé-en-main",
  description: "Votre restaurant en ligne en 5 minutes. Livraison, Click & Collect, dine-in via QR code.",
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <PostHogProvider>
          {children}
          <Toaster position="top-center" richColors />
          <Analytics />
        </PostHogProvider>
      </body>
    </html>
  )
}
