import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { I18nProvider } from "@/lib/i18n/context";
import DevToolbar from "@/components/dev/DevToolbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "popo's stay",
  description: "숙소 게스트를 위한 컨시어지 서비스",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-gray-50 font-sans text-gray-900">
        <I18nProvider>
          {children}
          {process.env.NODE_ENV === "development" && <DevToolbar />}
        </I18nProvider>
      </body>
    </html>
  );
}
