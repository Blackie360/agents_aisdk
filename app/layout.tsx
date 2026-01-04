import { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SchemaMind - Database Schema Visualizer",
  description: "Visualize and understand your database with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased dark">
        {children}
      </body>
    </html>
  );
}
