"use client"

import Link from "next/link"
import { SiteHeader } from "@/components/layout/site-header"
import { AuthForm } from "@/components/auth/auth-form"

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center p-4">
        <AuthForm />
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground">
        <p>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </footer>
    </div>
  )
}
