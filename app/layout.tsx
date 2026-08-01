import type { Metadata } from "next";
import "./globals.css";
import { Noto_Sans, Figtree } from "next/font/google";
import { cn } from "@/lib/utils";

const figtreeHeading = Figtree({subsets:['latin'],variable:'--font-heading'});

const notoSans = Noto_Sans({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "tudo",
  description: "tudo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en" className={cn("font-sans", notoSans.variable, figtreeHeading.variable)}
    >
      <body>{children}</body>
    </html>
  );
}
