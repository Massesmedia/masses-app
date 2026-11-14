import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = { 
  title: "MASSES", 
  description: "Zero-Identity Social",
  manifest: "/manifest.json",
  icons: {
    apple: "/svgviewer-png-output%20(3).png",
  }
};

export const viewport: Viewport = { 
  themeColor: "#050505", 
  width: "device-width", 
  initialScale: 1 
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}