"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/theme/mode-toggle"
import { cn } from "@/lib/utils"
import { Brain } from "lucide-react"

export function SiteHeader() {
  const pathname = usePathname()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  const isAuthPage = pathname === "/login" || pathname === "/signup"
  const isDashboard = pathname.startsWith("/dashboard")

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/" className="flex items-center space-x-2">
            <Brain className="h-6 w-6" />
            <span className="font-bold">MindNotes</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <nav className="flex items-center space-x-2">
            {!isDashboard && !isAuthPage && (
              <>
                <Button variant="ghost" asChild>
                  <Link
                    href="/login"
                    className={cn(
                      "text-sm font-medium transition-colors hover:text-primary",
                      pathname === "/login" ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    Sign In
                  </Link>
                </Button>
                <Button asChild>
                  <Link
                    href="/signup"
                    className={cn(
                      "text-sm font-medium transition-colors",
                      pathname === "/signup" ? "text-primary" : "",
                    )}
                  >
                    Get Started
                  </Link>
                </Button>
              </>
            )}
            {isDashboard && (
              <Button variant="ghost" onClick={handleSignOut}>
                Sign Out
              </Button>
            )}
            <ModeToggle />
          </nav>
        </div>
      </div>
    </header>
  )
}
