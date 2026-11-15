import type { Metadata } from "next";
import { BRAND } from "./brand";

export function siteMetadata(path: string, title: string, description: string): Metadata {
  const origin = process.env.PROOFBOUND_PUBLIC_ORIGIN;
  const url = origin ? new URL(path, origin) : undefined;
  const image = url ? new URL("/brand/icon-512.png", url) : undefined;
  return {
    alternates: url ? { canonical: url } : undefined,
    openGraph: {
      title, description, siteName: BRAND.name, type: "website", url,
      images: image ? [{ url: image, alt: "PROOFBOUND mark", width: 512, height: 512 }] : undefined,
    },
    twitter: {
      card: "summary", title, description,
      images: image ? [{ url: image, alt: "PROOFBOUND mark" }] : undefined,
    },
  };
}
