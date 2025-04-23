"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { type Session, type User } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"

// Create a context for the auth state
type AuthContextType = {
  user: User | null
  session: Session | null
  isLoading: boolean
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  refreshAuth: async () => {}
})

// Hook to use the auth context
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  // Function to get the current session and user
  const getInitialSession = useCallback(async () => {
    console.log("[AuthProvider] Attempting to get initial session...");
    setIsLoading(true);
    try {
      // Use Promise.all to fetch session and user concurrently
      const [{ data: sessionData }, { data: userData }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.auth.getUser(),
      ]);

      const currentSession = sessionData.session;
      const currentUser = userData.user;

      console.log("[AuthProvider] getInitialSession - Session:", currentSession ? `Found (Expires: ${currentSession.expires_at})` : "Not found");
      console.log("[AuthProvider] getInitialSession - User:", currentUser ? `Found (${currentUser.email})` : "Not found");

      setSession(currentSession);
      setUser(currentUser);

    } catch (error) {
      console.error("[AuthProvider] Error getting initial session:", error);
      setSession(null);
      setUser(null);
    } finally {
      console.log("[AuthProvider] Initial session check complete. isLoading: false");
      setIsLoading(false); // Always ensure isLoading is set to false when complete
    }
  }, [supabase]); // Include supabase in dependencies

  // Function to refresh auth state
  const refreshAuth = useCallback(async () => {
    console.log("[AuthProvider] Refreshing auth state manually...");
    await getInitialSession();
  }, [getInitialSession]); // Include getInitialSession in dependencies

  useEffect(() => {
    // Get initial session on mount
    getInitialSession();

    // Subscribe to auth changes
    console.log("[AuthProvider] Subscribing to onAuthStateChange...");
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log(`[AuthProvider] onAuthStateChange event: ${event}`, currentSession ? `Session (Expires: ${currentSession.expires_at})` : "No session");
        
        setSession(currentSession);
        
        if (currentSession) {
          // If session exists, update user state
          // Avoid calling getUser again if session is already available
          const currentUser = currentSession.user; 
          console.log("[AuthProvider] onAuthStateChange - User:", currentUser ? `Found (${currentUser.email})` : "Not found (but session exists)");
          setUser(currentUser);
        } else {
          // If no session, clear user state
          console.log("[AuthProvider] onAuthStateChange - No session, clearing user.");
          setUser(null);
        }
        
        // Always ensure loading is false after auth events
        console.log("[AuthProvider] onAuthStateChange setting isLoading to false.");
        setIsLoading(false);
      }
    );

    // Clean up the subscription
    return () => {
      console.log("[AuthProvider] Unsubscribing from onAuthStateChange.");
      subscription.unsubscribe();
    };
    // Fixing dependency array - remove isLoading which causes re-renders
  }, [supabase, router, getInitialSession]);

  return (
    <AuthContext.Provider value={{ user, session, isLoading, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}