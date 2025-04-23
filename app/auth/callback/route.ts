import { createClient } from "@/lib/supabase/server" // Use the simplified server client
import { NextResponse } from "next/server"
// No need to import cookies here anymore

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")

  if (code) {
    try {
      // Await the createClient function since it's now async
      const supabase = await createClient()
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error("Auth error:", error.message)
        return NextResponse.redirect(requestUrl.origin + "/login?error=" + encodeURIComponent(error.message))
      }

      if (!data.session) {
        console.error("No session returned from exchangeCodeForSession")
        return NextResponse.redirect(requestUrl.origin + "/login?error=No+session+created")
      }

      console.log("Session successfully created in callback route")
      // Successfully authenticated - redirect to dashboard
      return NextResponse.redirect(requestUrl.origin + "/dashboard")
    } catch (err) {
      console.error("Unexpected error during auth:", err)
      // It's better to show a generic error here unless err is an expected AuthError
      const errorMessage = err instanceof Error ? err.message : "Unexpected error during authentication"
      return NextResponse.redirect(requestUrl.origin + "/login?error=" + encodeURIComponent(errorMessage))
    }
  }

  // No code provided - redirect to login
  return NextResponse.redirect(requestUrl.origin + "/login?error=No+code+provided")
}
