import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const baseUrl = `${protocol}://${host}`;

  return {
    metadataBase: new URL(baseUrl),
    title: "BHRC Archives",
    description:
      "Ask questions across five BHRC meetings and receive source-grounded answers with page citations.",
    icons: {
      icon: "/favicon.png",
      shortcut: "/favicon.png",
    },
    openGraph: {
      title: "BHRC Archives",
      description: "Ask the minutes. Get cited answers.",
      type: "website",
      images: [
        {
          url: `${baseUrl}/og.png`,
          width: 1200,
          height: 630,
          alt: "BHRC Archives",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "BHRC Archives",
      description: "Ask the minutes. Get cited answers.",
      images: [`${baseUrl}/og.png`],
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
