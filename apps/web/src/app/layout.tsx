import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "@fontsource/instrument-serif/400-italic.css";
import "./globals.css";
import { AppProvider } from "@/components/provider";

export const metadata: Metadata = {
  title: { default: "PROOFBOUND — Intelligence you own", template: "%s · PROOFBOUND" },
  description: "Mint an Agent. Put it to work. Build verifiable proof and retain ownership on NEAR. A testnet research agent economy.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body><a className="skip-link" href="#main">Skip to content</a><AppProvider>{children}</AppProvider></body></html>;
}
