import { Metadata } from "next";
import { Toaster } from "sonner";

import { Navbar } from "@/components/custom/navbar";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://gemini.vercel.ai"),
  title: "Community Management Assistant",
  description: "AI-powered community management assistant with Google Calendar integration.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased dark">
        <Toaster position="top-center" />
        <Navbar />
        {children}
      </body>
    </html>
  );
}
