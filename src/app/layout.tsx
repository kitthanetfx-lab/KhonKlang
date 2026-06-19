/* eslint-disable @next/next/no-page-custom-font */
import type { Metadata } from "next";
import "./globals.css";
import { CookieConsent } from "@/components/CookieConsent";
import { DialogProvider } from "@/components/Dialog";
import { SupportWidget } from "@/components/SupportWidget";

export const metadata: Metadata = {
  title: "คนกลาง — ซื้อขายปลอดภัยผ่านคนกลาง",
  description: "แพลตฟอร์มซื้อขายปลอดภัยผ่านคนกลางที่ผ่านการรับรอง พักเงินไว้กับระบบจนกว่าจะได้รับของจริง",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700&family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body><DialogProvider>{children}<SupportWidget /><CookieConsent /></DialogProvider></body>
    </html>
  );
}
