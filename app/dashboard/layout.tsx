import type React from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server" // Use the simplified server client
import { SiteHeader } from "@/components/layout/site-header"
import { QueryProvider } from "@/components/providers/query-provider"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    // Await the createClient function since it's now async
    const supabase = await createClient()
    
    // Get session data
    const { data, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error("Session error:", error.message)
      redirect("/login?error=" + encodeURIComponent(error.message))
    }
    
    if (!data.session) {
      console.error("No active session found in dashboard layout") // Added more context
      redirect("/login?error=No+active+session")
    }
    
    // If we get here, we have a valid session
    console.log("Active session found in dashboard layout, rendering children.") // Added success log
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <QueryProvider>{children}</QueryProvider>
      </div>
    )
  } catch (err) {
    // Check if it's a redirect error, which is expected
    if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT')) {
      throw err; // Re-throw redirect errors
    }
    console.error("Unexpected error in dashboard layout:", err)
    // Provide a more specific error message if possible
    const errorMessage = err instanceof Error ? err.message : "Unexpected error checking session"
    redirect("/login?error=" + encodeURIComponent(errorMessage))
  }
}
