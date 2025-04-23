"use client";

import { QueryClient, QueryClientProvider as TanstackQueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import React, { useState } from "react";

export function QueryClientProvider({ children }: { children: React.ReactNode }) {
  // Use useState to ensure the client is only created once per render
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false, // Optional: Adjust as needed
      },
    },
  }));

  return (
    <TanstackQueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} /> {/* Optional: DevTools */}
    </TanstackQueryClientProvider>
  );
}
