import type { Metadata, Viewport } from "next";
import { Noto_Sans, Figtree } from "next/font/google";
import { cn } from "@/lib/utils";
import PwaRegister from "@/components/PwaRegister";

import "./globals.css";

const figtreeHeading = Figtree({subsets:['latin'],variable:'--font-heading'});

const notoSans = Noto_Sans({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "tudo",
	description: "Everything...",
	appleWebApp: {
		capable: true,
		statusBarStyle: "black-translucent",
		title: "Everything",
	},
};

export const viewport: Viewport = {
	themeColor: "#090b0c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en" className={cn("dark", "font-sans", notoSans.variable, figtreeHeading.variable)}
    >
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
