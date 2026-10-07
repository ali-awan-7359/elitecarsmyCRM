import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Elite Cars — Sales OS",
  description: "Premium automotive sales intelligence and CRM.",
};

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
