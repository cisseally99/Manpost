import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Manpost",
  description: "A beginner-friendly HTTP API testing workspace.",
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
