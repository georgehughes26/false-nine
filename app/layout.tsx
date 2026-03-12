import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { GoogleAnalytics } from '@next/third-parties/google'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import CookieBanner from '@/components/CookieBanner'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://falsenineapp.com'),
  title: {
    default: 'False Nine — Football Predictions & Stats',
    template: '%s | False Nine',
  },
  description: 'Data-driven football predictions, live scores and deep stats for the Premier League and Championship. Poisson model probabilities, xG analysis, player picks and more.',
  keywords: ['football predictions', 'Premier League predictions', 'Championship predictions', 'football stats', 'xG', 'BTTS predictions', 'over under football', 'match predictions', 'false nine'],
  authors: [{ name: 'False Nine', url: 'https://falsenineapp.com' }],
  creator: 'False Nine',
  publisher: 'False Nine',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: 'https://falsenineapp.com',
    siteName: 'False Nine',
    title: 'False Nine — Football Predictions & Stats',
    description: 'Data-driven football predictions, live scores and deep stats for the Premier League and Championship.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'False Nine — Football Predictions & Stats',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'False Nine — Football Predictions & Stats',
    description: 'Data-driven football predictions, live scores and deep stats for the Premier League and Championship.',
    images: ['/og-image.png'],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'False Nine',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#080c10" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ServiceWorkerRegistration />
        <CookieBanner />
        {children}
      </body>
      <GoogleAnalytics gaId="G-8LCQM0K62T" />
    </html>
  );
}