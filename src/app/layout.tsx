import type { Metadata } from "next";
import "antd/dist/reset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocBook",
  description: "Local dispensary doctor booking and live queue tracking"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
