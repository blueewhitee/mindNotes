"use client"

import type React from "react";
import { QueryProvider } from "@/components/providers/query-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { SearchProvider } from "@/components/providers/search-provider";

export const dynamic = 'force-dynamic';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <QueryProvider>
        <SearchProvider>
          <div className="flex min-h-screen flex-col">
            <main className="flex-1">{children}</main>
          </div>
        </SearchProvider>
      </QueryProvider>
    </AuthProvider>
  );
}
