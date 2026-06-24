import type { Metadata, Viewport } from "next";
import { Anuphan, IBM_Plex_Mono, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";
import { CookieConsent } from "@/components/CookieConsent";
import { DialogProvider } from "@/components/Dialog";
import { SupportWidget } from "@/components/SupportWidget";
import { HomeButton } from "@/components/HomeButton";
import { AuthGate } from "@/components/AuthGate";

const displayFont = Anuphan({
  subsets: ["latin", "thai"],
  weight: ["500", "600", "700"],
  variable: "--font-display-next",
  display: "swap",
});

const bodyFont = IBM_Plex_Sans_Thai({
  subsets: ["thai"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body-next",
  display: "swap",
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-mono-next",
  display: "swap",
});

export const metadata: Metadata = {
  title: "คนกลาง — ซื้อขายปลอดภัยผ่านคนกลาง",
  description: "แพลตฟอร์มซื้อขายปลอดภัยผ่านคนกลางที่ผ่านการรับรอง พักเงินไว้กับระบบจนกว่าจะได้รับของจริง",
};

// interactive-widget=overlays-content: บนมือถือ คีย์บอร์ดจะ "ทับ" จอแทนที่จะดันเนื้อหาขึ้น (ทุกบริการ)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "overlays-content",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`h-full antialiased ${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
      <body className={bodyFont.className}>
        <DialogProvider><AuthGate>{children}<HomeButton /><SupportWidget /><CookieConsent /></AuthGate></DialogProvider>
      </body>
    </html>
  );
}
