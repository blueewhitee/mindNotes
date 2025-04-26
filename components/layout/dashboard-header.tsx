"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDebounce } from "@/lib/hooks/use-debounce"
import { useNotes } from "@/lib/hooks/use-notes"
import { Plus, Search, User, Loader2, RefreshCw, Bookmark } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAuth } from "@/components/providers/auth-provider"
import { createClient } from "@/lib/supabase/client"
import { toast } from "@/components/ui/use-toast"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function DashboardHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const { createNote } = useNotes()
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [isCreating, setIsCreating] = useState(false)
  const [activeTab, setActiveTab] = useState("notes")
  
  // Get auth state and refresh function
  const { user, isLoading, refreshAuth } = useAuth()
  const supabase = createClient()

  // Update activeTab based on the current URL path
  useEffect(() => {
    if (pathname.includes("/bookmarks")) {
      setActiveTab("bookmarks")
    } else {
      setActiveTab("notes")
    }
  }, [pathname])

  const handleCreateNote = async () => {
    if (isCreating) {
      return;
    }

    // Check if user is authenticated before proceeding
    if (!user) {
      await refreshAuth();
      
      // Check again after refresh
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to create a note.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsCreating(true);
    try {
      // Create the note using the mutateAsync method
      const newNote = await createNote.mutateAsync({
        title: "Untitled Note",
      });

      if (newNote) {
        router.push(`/dashboard/note/${newNote.id}`);
      } else {
        toast({
          title: "Note created",
          description: "However, there was an issue with the response. Please try again.",
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Error creating note:", error);
      toast({
        title: "Error creating note",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  }

  const handleRefreshAuth = async () => {
    await refreshAuth()
    toast({
      title: "Auth refreshed",
      description: user ? "Authentication refreshed successfully." : "No active session found.",
    })
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const handleCreateBookmark = async () => {
    if (isCreating) {
      return;
    }

    // Check if user is authenticated before proceeding
    if (!user) {
      await refreshAuth();
      
      // Check again after refresh
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to create a bookmark.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsCreating(true);
    try {
      // Navigate to the create bookmark page
      router.push('/dashboard/bookmark/new');
    } catch (error) {
      console.error("Error navigating to create bookmark:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  }

  // Get user avatar URL from OAuth provider metadata
  const getUserAvatar = () => {
    if (user?.identities?.[0]?.provider === 'google') {
      return user.user_metadata?.avatar_url || user.user_metadata?.picture
    }
    return null
  }

  // Get user display name from OAuth provider metadata
  const getUserName = () => {
    if (user?.identities?.[0]?.provider === 'google') {
      return user.user_metadata?.full_name || user.user_metadata?.name || user.email
    }
    return user?.email
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="ml-4">
            <TabsList>
              <TabsTrigger value="notes" onClick={() => router.push('/dashboard')}>Notes</TabsTrigger>
              <TabsTrigger value="bookmarks" onClick={() => router.push('/dashboard/bookmarks')}>Bookmarks</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex flex-1 items-center gap-2 md:max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={activeTab === "notes" ? "Search notes..." : "Search bookmarks..."}
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button 
            onClick={async () => {
              if (activeTab === "notes") {
                try {
                  // First, check if we already have a user
                  if (!user) {
                    await refreshAuth();
                    if (!user) {
                      toast({
                        title: "Authentication Required",
                        description: "Please log in to create notes",
                        variant: "destructive",
                      });
                      router.push('/login');
                      return;
                    }
                  }
                  
                  // Create the note
                  console.log("Attempting to create note for user:", user?.id || "unknown");
                  const newNote = await createNote.mutateAsync({
                    title: "Untitled Note",
                  });

                  if (newNote && newNote.id) {
                    router.push(`/dashboard/note/${newNote.id}`);
                  } else {
                    toast({
                      title: "Error",
                      description: "Failed to create a new note. No valid response received.",
                      variant: "destructive",
                    });
                  }
                } catch (error) {
                  console.error("Error creating note:", error);
                  // Provide more helpful error messages
                  let errorMessage = "An unexpected error occurred";
                  
                  if (error instanceof Error) {
                    errorMessage = error.message;
                  } else if (typeof error === 'object' && error !== null) {
                    errorMessage = JSON.stringify(error);
                  }
                  
                  toast({
                    title: "Error creating note",
                    description: errorMessage,
                    variant: "destructive",
                  });
                }
              } else {
                // Handle bookmark creation
                handleCreateBookmark();
              }
            }} 
            className="relative"
          >
            {activeTab === "notes" ? (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create Note
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Bookmark
              </>
            )}
          </Button>
          
          {/* Debug button in development for auth refresh */}
          {process.env.NODE_ENV === 'development' && (
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleRefreshAuth} 
              title="Refresh Auth State"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          
          {isLoading ? (
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 rounded-full" aria-label="User menu">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={getUserAvatar()} alt={getUserName()} />
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    {getUserName() && (
                      <p className="font-medium">{getUserName()}</p>
                    )}
                    {user.email && (
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    )}
                  </div>
                </div>
                <DropdownMenuItem onClick={handleSignOut}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </div>
  )
}
