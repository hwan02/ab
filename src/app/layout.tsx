import type { Metadata, Viewport } from "next";
import { Geist, Noto_Sans_KR, Jua } from "next/font/google";
import { I18nProvider } from "@/lib/i18n/context";
import DevToolbar from "@/components/dev/DevToolbar";
import TopLoader from "@/components/layout/TopLoader";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

const jua = Jua({
  variable: "--font-jua",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "포포톡",
  description: "에어비앤비 게스트 메시지 자동응답",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "포포톡",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#3b82f6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${notoSansKr.variable} ${jua.variable} h-full antialiased overflow-x-hidden`}>
      <body className="min-h-full overflow-x-hidden bg-gray-50 font-sans text-gray-900">
        <I18nProvider>
          <TopLoader />
          {children}
          {process.env.NODE_ENV === "development" && <DevToolbar />}
        </I18nProvider>
      </body>
    </html>
  );
}
