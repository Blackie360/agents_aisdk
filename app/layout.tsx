import { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SchemaMind - Database Schema Visualizer",
  description:
    "Explore SQL, ORM and document schemas. Interactive diagrams, field details and portable exports.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
