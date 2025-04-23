"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Note } from "@/lib/types/database.types"
import { toast } from "@/components/ui/use-toast"
import { useAuth } from "@/components/providers/auth-provider"

export function useNotes() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { user, isLoading: isAuthLoading, refreshAuth } = useAuth()

  const {
    data: notes = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      console.log("Fetching notes with user:", user?.id)
      // Don't fetch if auth is still loading
      if (isAuthLoading) {
        console.log("Auth is still loading, returning empty notes array")
        return []
      }

      // If no user, try refreshing auth once
      if (!user) {
        console.log("No user found when fetching notes, attempting to refresh auth")
        await refreshAuth()
        
        // If still no user after refresh, return empty array
        if (!user) {
          console.log("Still no user after refresh, returning empty notes array")
          return []
        }
      }

      try {
        const { data, error } = await supabase
          .from("notes")
          .select("*")
          .eq("user_id", user.id) // Add filter for current user
          .order("updated_at", { ascending: false })
          .eq("is_archived", false)

        if (error) {
          console.error("Error fetching notes:", error.message || JSON.stringify(error))
          toast({
            title: "Error fetching notes",
            description: error.message || "Failed to load your notes",
            variant: "destructive",
          })
          return [] // Return empty array instead of throwing error
        }

        return data as Note[]
      } catch (err) {
        // Catch any unexpected errors
        console.error("Exception in notes query:", err)
        toast({
          title: "Error loading notes",
          description: err instanceof Error ? err.message : "An unexpected error occurred",
          variant: "destructive",
        })
        return [] // Return empty array instead of throwing
      }
    },
    // Only run query if auth state is initialized (whether user exists or not)
    enabled: !isAuthLoading,
  })

  const createNote = useMutation({
    mutationFn: async ({ title, content }: { title: string; content?: string }) => {
      // Extra safety check - wait for auth state to be ready
      if (isAuthLoading) {
        console.log("Auth is still loading, waiting...")
        await refreshAuth()
      }

      // Try to refresh auth if no user is found
      if (!user) {
        console.log("No user found when creating note, attempting to refresh auth")
        await refreshAuth()
      }

      // Final check after possible refresh
      if (!user) {
        console.error("Still no user after refresh, cannot create note")
        throw new Error("User not authenticated")
      }

      console.log("Creating note for user:", user.id)
      
      try {
        // First, ensure a profile exists for this user
        const { data: existingProfile, error: profileCheckError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single();
          
        if (profileCheckError && profileCheckError.code !== 'PGRST116') {
          // If it's an error other than "not found", throw it
          console.error("Error checking for profile:", profileCheckError.message);
          throw new Error("Failed to check if profile exists: " + profileCheckError.message);
        }
          
        if (!existingProfile) {
          console.log("No profile found for user, creating one now...");
          
          // Insert a profile for the user
          const { error: profileInsertError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email || '',
              full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
              avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null
            });
            
          if (profileInsertError) {
            console.error("Error creating user profile:", profileInsertError);
            throw new Error("Failed to create user profile: " + (profileInsertError.message || JSON.stringify(profileInsertError)));
          }
          
          console.log("Profile created successfully for user:", user.id);
        } else {
          console.log("Profile already exists for user:", user.id);
        }
      
        // Now proceed with note creation
        const { data, error } = await supabase
          .from("notes")
          .insert({
            user_id: user.id,
            title,
            content: content || "",
            is_archived: false // Explicitly set default value
          })
          .select()
          .single()

        if (error) {
          console.error("Error inserting note:", error.message)
          throw new Error(error.message || "Failed to create note")
        }

        if (!data) {
          throw new Error("No data returned from note creation")
        }

        return data as Note
      } catch (err) {
        console.error("Exception in note creation:", err)
        throw err
      }
    },
    onSuccess: (newNote) => {
      queryClient.invalidateQueries({ queryKey: ["notes"] })
      toast({
        title: "Note created",
        description: "Your note has been created successfully.",
      })
      return newNote
    },
    onError: (error: any) => {
      console.error("Error in createNote mutation:", error)
      toast({
        title: "Error creating note",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      })
    },
  })

  const updateNote = useMutation({
    mutationFn: async ({ id, title, content }: { id: string; title?: string; content?: string }) => {
      // Authentication checks - similar to createNote
      if (isAuthLoading) {
        console.log("Auth is still loading when updating note, waiting...")
        await refreshAuth()
      }

      // Try to refresh auth if no user is found
      if (!user) {
        console.log("No user found when updating note, attempting to refresh auth")
        await refreshAuth()
      }

      // Final check after possible refresh
      if (!user) {
        console.error("Still no user after refresh, cannot update note")
        throw new Error("User not authenticated")
      }

      console.log("Updating note for user:", user.id)

      try {
        const { data, error } = await supabase
          .from("notes")
          .update({
            ...(title !== undefined && { title }),
            ...(content !== undefined && { content }),
            updated_at: new Date().toISOString() // Explicitly update the timestamp
          })
          .eq("id", id)
          .select()
          .single()

        if (error) {
          console.error("Error updating note:", error.message)
          throw new Error(error.message || "Failed to update note")
        }

        if (!data) {
          throw new Error("No data returned from note update")
        }

        return data as Note
      } catch (err) {
        console.error("Exception in note update:", err)
        throw err
      }
    },
    onSuccess: (updatedNote) => {
      queryClient.invalidateQueries({ queryKey: ["notes"] })
      queryClient.invalidateQueries({ queryKey: ["note", updatedNote.id] })
    },
    onError: (error: any) => {
      console.error("Error in updateNote mutation:", error)
      toast({
        title: "Error updating note",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      })
    },
  })

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id)

      if (error) throw error
      return id
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["notes"] })
      toast({
        title: "Note deleted",
        description: "Your note has been deleted successfully.",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting note",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const archiveNote = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("notes").update({ is_archived: true }).eq("id", id).select().single()

      if (error) throw error
      return data as Note
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] })
      toast({
        title: "Note archived",
        description: "Your note has been archived successfully.",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error archiving note",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  return {
    notes,
    isLoading: isLoading || isAuthLoading,
    error,
    createNote,
    updateNote,
    deleteNote,
    archiveNote,
    isAuthReady: !isAuthLoading,
    refetchNotes: refetch,
  }
}

export function useNote(id: string) {
  const supabase = createClient()
  const { user } = useAuth()

  const {
    data: note,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["note", id],
    queryFn: async () => {
      if (!user) {
        throw new Error("User not authenticated")
      }
      
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id) // Only allow access to user's own notes
        .single()

      if (error) {
        console.error("Error fetching note:", error.message)
        throw error
      }

      return data as Note
    },
    enabled: !!id && !!user,
  })

  return {
    note,
    isLoading,
    error,
  }
}
