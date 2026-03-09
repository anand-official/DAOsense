import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DAOSense | Governance Intelligence for Avalanche",
  description:
    "AI-powered governance copilot — transform dense DAO proposals into clear, verifiable insights in under two minutes.",
  keywords: ["DAO", "governance", "Avalanche", "AI", "proposals", "DeFi"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${jetbrainsMono.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
