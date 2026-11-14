import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "@fontsource/instrument-serif/400-italic.css";
import "./globals.css";
import { AppProvider } from "@/components/provider";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  applicationName: BRAND.name,
  appleWebApp: { title: BRAND.name, capable: true, statusBarStyle: "default" },
  openGraph: { title: BRAND.name, siteName: BRAND.name, description: BRAND.description, type: "website" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: BRAND.forest, colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body><a className="skip-link" href="#main">Skip to content</a><AppProvider>{children}</AppProvider></body></html>;
}
