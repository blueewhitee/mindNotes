import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/components/providers/auth-provider";
import { QueryClientProvider } from "@/components/providers/query-provider"; // Import QueryClientProvider
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mind Notes",
  description: "Capture and organize your thoughts with AI assistance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryClientProvider> {/* Wrap with QueryClientProvider */}
            <AuthProvider> {/* AuthProvider should be inside QueryClientProvider if it uses query hooks */}
              {children}
              <Toaster />
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
