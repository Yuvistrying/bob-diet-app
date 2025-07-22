import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "./providers/ConvexClientProvider";
import { ThemeProvider } from "./components/ThemeProvider";
import { Analytics } from "@vercel/analytics/react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ClientErrorHandler } from "./components/ClientErrorHandler";
import { ChunkErrorHandler } from "./components/ChunkErrorHandler";
import { ServiceWorkerManager } from "./components/ServiceWorkerManager";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bob - Your AI Diet Coach",
  description:
    "Personalized AI-powered diet coaching to help you achieve your health goals",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bob Diet",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <meta name="theme-color" content="#10b981" />
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
          <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
          <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
          <link rel="dns-prefetch" href="https://api.convex.dev" />
          <link rel="dns-prefetch" href="https://clerk.dev" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />
        </head>
        <body className={inter.className}>
          <ErrorBoundary>
            <ConvexClientProvider>
              <ThemeProvider>
                <ClientErrorHandler />
                <ChunkErrorHandler />
                <ServiceWorkerManager />
                {children}
              </ThemeProvider>
            </ConvexClientProvider>
          </ErrorBoundary>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
