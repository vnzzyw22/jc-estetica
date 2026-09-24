import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Newsreader } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// latin-ext é obrigatório em português: sem ele, Ç/Ã podem cair para outra fonte.
const newsreader = Newsreader({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-newsreader",
  display: "swap",
});

const hanken = Hanken_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-hanken",
  display: "swap",
});

const DESCRIPTION =
  "Jennifer Camila — estética facial e corporal. Conheça os procedimentos e agende seu horário online.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Jennifer Camila — Estética facial e corporal",
    template: "%s — Jennifer Camila",
  },
  description: DESCRIPTION,
  applicationName: "Jennifer Camila",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Jennifer Camila — Estética facial e corporal",
    title: "Jennifer Camila — Estética facial e corporal",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#efe9e3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${newsreader.variable} ${hanken.variable}`}>
      <body>{children}</body>
    </html>
  );
}
