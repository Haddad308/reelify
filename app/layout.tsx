import "./globals.css";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next"

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Realify | ريلز عربية بالذكاء الاصطناعي",
    template: "%s | Realify",
  },
  description: "حوّل الفيديوهات العربية الطويلة إلى ريلز قصيرة احترافية مع عناوين جذابة خلال دقائق.",
  keywords: [
    "ريلز",
    "فيديوهات قصيرة",
    "تحويل فيديو",
    "ذكاء اصطناعي",
    "مقاطع عربية",
    "Shorts",
    "Reels",
    "TikTok",
    "Instagram Reels",
    "YouTube Shorts",
  ],
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.svg",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "ar_AR",
    url: "/",
    siteName: "Realify",
    title: "Realify | ريلز عربية بالذكاء الاصطناعي",
    description: "حوّل الفيديوهات العربية الطويلة إلى ريلز قصيرة احترافية مع عناوين جذابة خلال دقائق.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Realify | ريلز عربية بالذكاء الاصطناعي",
    description: "حوّل الفيديوهات العربية الطويلة إلى ريلز قصيرة احترافية مع عناوين جذابة خلال دقائق.",
  },
  alternates: {
    canonical: "/",
  },
};

// RootLayout is the layout for the entire application
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}
        <Analytics />
      </body>
    </html>
  );
}
