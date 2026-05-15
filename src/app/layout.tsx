import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Growth Automation Harness",
  description: "MVP workflow for AI tattoo generator growth research"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
