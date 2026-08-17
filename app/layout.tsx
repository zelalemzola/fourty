import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, DM_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StoreProvider } from "@/components/providers/store-provider";
import { AuthSync } from "@/components/providers/auth-sync";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const sans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const nav = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Fourty · Inventory & Sales",
    template: "%s · Fourty",
  },
  description:
    "Enterprise inventory, sales, and subagent management for Fourty cigarette distribution.",
  manifest: "/manifest.webmanifest",
  applicationName: "Fourty",
  appleWebApp: {
    capable: true,
    title: "Fourty",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
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
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} ${nav.variable} h-full`}
    >
      <body className="min-h-full font-sans antialiased">
        <StoreProvider>
          <AuthSync>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <TooltipProvider>
                {children}
                <Toaster richColors position="top-center" closeButton />
              </TooltipProvider>
            </ThemeProvider>
          </AuthSync>
        </StoreProvider>
      </body>
    </html>
  );
}
