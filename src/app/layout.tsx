import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SELVARENA · En vivo",
  description: "Circuito de beach vóley — Circuito Mixto Principiantes 2026, en vivo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div
          className="pointer-events-none fixed inset-0 z-0"
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/jungle-bg.jpg"
            alt=""
            className="h-full w-full object-cover opacity-70"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-sand-50/30 via-sand-100/10 to-sand-200/30" />
        </div>
        <div className="relative z-10 flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
