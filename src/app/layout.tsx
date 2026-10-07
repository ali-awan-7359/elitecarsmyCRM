import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Elite Cars Sales OS",
  description: "Research and outbound sales workspace for Elite Cars",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
