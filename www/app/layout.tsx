import React from "react"
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { PostHogProvider } from './providers'
import './globals.css'

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });

export const metadata: Metadata = {
  title: "BELDY'S CLUB | Vos restaurants préférés à Monaco",
  description: 'La plateforme unique pour commander vos marques préférées : Smash Burgers, Tacos, Bowls et Desserts. Livraison rapide à Monaco et alentours.',
  generator: 'v0.app',
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
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <PostHogProvider>
          {children}
          <Toaster position="top-center" richColors />
          <Analytics />
        </PostHogProvider>
      </body>
    </html>
  )
}
