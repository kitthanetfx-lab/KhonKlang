import type { Metadata, Viewport } from "next";
import { Anuphan, IBM_Plex_Mono, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";
import { CookieConsent } from "@/components/CookieConsent";
import { MetaPixel } from "@/components/MetaPixel";
import { DialogProvider } from "@/components/Dialog";
import { SupportWidget } from "@/components/SupportWidget";
import { HomeButton } from "@/components/HomeButton";
import { AuthGate } from "@/components/AuthGate";
import { AppPreferencesProvider } from "@/components/AppPreferences";
import { AppChrome } from "@/components/AppChrome";
import { GlobalPreferenceDock } from "@/components/GlobalPreferenceDock";
import { GlobalLoadingProvider, GlobalButtonGuard } from "@/components/GlobalLoadingProvider";
import { NativePushBridge } from "@/components/NativePushBridge";

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
  metadataBase: new URL("https://www.glanghub.com"),
  // Meta App "Glanghub" — สำหรับ Facebook Insights / Sharing Debugger
  facebook: { appId: "1054122313862171" },
  // ยืนยันความเป็นเจ้าของโดเมนกับ Meta Business (Brand Safety → Domains)
  other: { "facebook-domain-verification": "6y3aq4aeheh9zhvu1lifxznie35f62" },
  title: "กลางฮับ — คิดถึงคนกลาง คิดถึง Glanghub",
  description: "แพลตฟอร์มซื้อขายปลอดภัยด้วยระบบตัวกลางที่ผ่านการรับรอง พักเงินไว้กับระบบจนกว่าจะได้รับของจริง",
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: "https://www.glanghub.com",
    siteName: "กลางฮับ",
    title: "กลางฮับ — คิดถึงคนกลาง คิดถึง Glanghub",
    description: "แพลตฟอร์มซื้อขายปลอดภัยด้วยระบบตัวกลางที่ผ่านการรับรอง พักเงินไว้กับระบบจนกว่าจะได้รับของจริง",
    images: [
      {
        url: "/og-tag.webp",
        width: 1200,
        height: 630,
        alt: "กลางฮับ — แพลตฟอร์มซื้อขายปลอดภัย",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "กลางฮับ — คิดถึงคนกลาง คิดถึง Glanghub",
    description: "แพลตฟอร์มซื้อขายปลอดภัยด้วยระบบตัวกลางที่ผ่านการรับรอง พักเงินไว้กับระบบจนกว่าจะได้รับของจริง",
    images: ["/og-tag.webp"],
  },
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
        <AppPreferencesProvider>
          <GlobalLoadingProvider>
          <DialogProvider>
            <AuthGate>
              <GlobalButtonGuard />
              <NativePushBridge />
              <AppChrome>
                {children}
              </AppChrome>
              <GlobalPreferenceDock />
              <HomeButton />
              <SupportWidget />
              <CookieConsent />
              <MetaPixel />
            </AuthGate>
          </DialogProvider>
          </GlobalLoadingProvider>
        </AppPreferencesProvider>
      </body>
    </html>
  );
}
