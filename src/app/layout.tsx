import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/lib/i18n/language-provider";
import { NotificationProvider } from "@/components/dashboard/notification-center";
import { SettingsProvider } from "@/components/dashboard/settings-panel";
import { FavoritesProvider } from "@/components/dashboard/favorites-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agent CaMate — StoreOps Decision Agent for KFC · Agentic AI Build Week 2026",
  description:
    "Agent CaMate is a StoreOps Decision Agent that turns weather and store operation signals into approved, evidence-backed actions for each KFC store. A pilot-oriented prototype for Agentic AI Build Week 2026.",
  keywords: [
    "Agentic AI",
    "F&B Operations",
    "KFC",
    "Agent CaMate",
    "StoreOps",
    "Weather Risk",
    "Hyperlocal",
    "Hackathon",
    "Build Week 2026",
  ],
  authors: [{ name: "Agent CaMate Team" }],
  openGraph: {
    title: "Agent CaMate — StoreOps Decision Agent for KFC",
    description:
      "Agent CaMate turns weather and store operation signals into approved, evidence-backed actions for each KFC store.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          defaultTheme="light"
        >
          <LanguageProvider>
            <NotificationProvider>
              <SettingsProvider>
                <FavoritesProvider>
                  {children}
                  <Toaster />
                </FavoritesProvider>
              </SettingsProvider>
            </NotificationProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
