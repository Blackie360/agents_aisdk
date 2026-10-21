import { Metadata } from "next";
import "./globals.css";

const title = "SchemaMind — Your schema, visualized";
const description =
  "Turn SQL, Prisma, Drizzle and JSON schemas into interactive diagrams. Explore relationships, inspect fields and export your schema. No database login needed.";
export const metadata: Metadata = {
  metadataBase: new URL("https://schema.blackielabs.com"),
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "SchemaMind",
    title,
    description,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SchemaMind: your schema, visualized, with linked authors and books tables",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Fetch the UI font with the HTML so text settles before first paint. */}
        <link
          rel="preload"
          href="/fonts/geist.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
