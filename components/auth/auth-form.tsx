"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"

export function AuthForm() {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [activeTab, setActiveTab] = useState("signin")

  useEffect(() => {
    console.log("Supabase client initialized:", !!supabase)
    console.log("Auth methods available:", !!supabase?.auth)
  }, [supabase])

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Sign in initiated with email:", email)
    setIsLoading(true)

    try {
      console.log("Calling supabase.auth.signInWithPassword...")
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log("Sign in response:", { data: { ...data, session: data?.session ? "Session exists" : "No session" }, error })

      if (error) {
        console.error("Login error:", error)
        throw error
      }

      // Check if we successfully got a session
      if (!data.session) {
        console.error("No session returned from signInWithPassword")
        throw new Error("Login failed - no session created")
      }

      console.log("Login successful, session established")
      
      // Wait for the session to be fully established
      await new Promise(resolve => setTimeout(resolve, 500))
      
      toast({
        title: "Success",
        description: "You have successfully signed in.",
      })
      
      // Instead of using router.push first, use replace to avoid state issues
      router.replace("/dashboard")
    } catch (error: any) {
      console.error("Login error caught:", error)
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Sign up form submitted", { email, password })

    if (!email || !password) {
      console.log("Email or password missing")
      toast({
        title: "Missing information",
        description: "Please provide both email and password",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      console.log("About to call Supabase signup...")

      const debugDirectFetch = async () => {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
            },
            body: JSON.stringify({
              email,
              password,
              options: {
                email_redirect_to: `${window.location.origin}/auth/callback`,
              },
            }),
          })

          console.log("Direct fetch response status:", response.status)
          const data = await response.json()
          console.log("Direct fetch response:", data)
        } catch (error) {
          console.error("Direct fetch error:", error)
        }
      }

      console.log("Calling standard Supabase signup")
      const response = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      console.log("Signup standard response:", response)

      if (response.error) {
        console.log("Standard signup failed, trying direct fetch")
        await debugDirectFetch()

        throw response.error
      }

      toast({
        title: "Check your email",
        description: "We sent you a confirmation link to complete your registration.",
      })
    } catch (error: any) {
      console.error("Signup error caught:", error)
      toast({
        title: "Sign up failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        throw error
      }
    } catch (error: any) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  const debugSubmit = (e: React.FormEvent) => {
    console.log("Form submit triggered", { activeTab })
    if (activeTab === "signup") {
      handleEmailSignUp(e)
    } else {
      handleEmailSignIn(e)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <Tabs defaultValue="signin" onValueChange={setActiveTab} value={activeTab}>
        <CardHeader>
          <CardTitle className="text-2xl text-center">Welcome to MindNotes</CardTitle>
          <CardDescription className="text-center">
            Capture and organize your thoughts with AI assistance
          </CardDescription>
          <TabsList className="grid w-full grid-cols-2 mt-4">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent>
          <TabsContent value="signin">
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Sign In
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form onSubmit={debugSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-signup">Email</Label>
                <Input
                  id="email-signup"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-signup">Password</Label>
                <Input
                  id="password-signup"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                onClick={(e) => {
                  console.log("Sign Up button clicked")
                }}
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Sign Up
              </Button>
            </form>
          </TabsContent>
        </CardContent>
        <CardFooter className="flex flex-col">
          <div className="relative w-full mb-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isLoading}>
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google
          </Button>
        </CardFooter>
      </Tabs>
    </Card>
  )
}
