import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SupplyBase — B2B Wholesale & Supplier Platform",
    template: "%s | SupplyBase",
  },
  description:
    "The premium platform for B2B wholesale management, supplier directories, and CRM operations.",
  keywords: ["B2B", "wholesale", "supplier", "CRM", "directory", "procurement"],
  authors: [{ name: "SupplyBase" }],
  creator: "SupplyBase",
  metadataBase: new URL("https://supplybase.io"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://supplybase.io",
    title: "SupplyBase — B2B Wholesale & Supplier Platform",
    description: "The premium platform for B2B wholesale management.",
    siteName: "SupplyBase",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delay={200}>
            {children}
            <Toaster position="bottom-right" richColors closeButton />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
