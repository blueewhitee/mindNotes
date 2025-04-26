import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "@/components/ui/use-toast"
import { useAuth } from "@/components/providers/auth-provider"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export interface Bookmark {
  id: string
  user_id: string
  title: string
  url: string
  description?: string
  tags?: string[]
  favicon_url?: string
  is_favorite?: boolean
  folder_id?: string | null
  created_at?: string
  updated_at?: string
}

export interface BookmarkInsert {
  title: string
  url: string
  description?: string
  tags?: string[]
  favicon_url?: string
  is_favorite?: boolean
  folder_id?: string | null
}

export function useBookmarks() {
  const { user } = useAuth()
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Get all bookmarks for the current user
  const getBookmarks = useQuery({
    queryKey: ["bookmarks", user?.id],
    queryFn: async () => {
      if (!user) {
        return []
      }

      const { data, error } = await supabase
        .from("bookmarks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) {
        throw new Error(`Error fetching bookmarks: ${error.message}`)
      }

      return data || []
    },
    enabled: !!user,
  })

  // Get a single bookmark by ID
  const getBookmarkById = useQuery({
    queryKey: ["bookmark"],
    queryFn: async ({ queryKey }: { queryKey: string[] }) => {
      // The full queryKey will be ["bookmark", userId, bookmarkId]
      const [_, userId, bookmarkId] = queryKey
      
      if (!userId || !bookmarkId) {
        throw new Error("Missing userId or bookmarkId")
      }

      const { data, error } = await supabase
        .from("bookmarks")
        .select("*")
        .eq("id", bookmarkId)
        .eq("user_id", userId)
        .single()

      if (error) {
        throw new Error(`Error fetching bookmark: ${error.message}`)
      }

      return data
    },
    enabled: false, // Disabled by default, enable when needed with a specific ID
  })

  // Create a new bookmark
  const createBookmark = useMutation({
    mutationFn: async (bookmark: BookmarkInsert) => {
      if (!user) {
        throw new Error("User not authenticated")
      }

      const { data, error } = await supabase
        .from("bookmarks")
        .insert([{ ...bookmark, user_id: user.id }])
        .select()
        .single()

      if (error) {
        throw new Error(`Error creating bookmark: ${error.message}`)
      }

      return data
    },
    onSuccess: () => {
      toast({
        title: "Bookmark created",
        description: "Your bookmark has been created successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["bookmarks", user?.id] })
    },
    onError: (error) => {
      toast({
        title: "Error creating bookmark",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      })
    },
  })

  // Update an existing bookmark
  const updateBookmark = useMutation({
    mutationFn: async ({ id, ...bookmark }: Partial<Bookmark> & { id: string }) => {
      if (!user) {
        throw new Error("User not authenticated")
      }

      const { data, error } = await supabase
        .from("bookmarks")
        .update(bookmark)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single()

      if (error) {
        throw new Error(`Error updating bookmark: ${error.message}`)
      }

      return data
    },
    onSuccess: (data) => {
      toast({
        title: "Bookmark updated",
        description: "Your bookmark has been updated successfully",
      })
      // Invalidate both the list and the individual bookmark
      queryClient.invalidateQueries({ queryKey: ["bookmarks", user?.id] })
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ["bookmark", user?.id, data.id] })
      }
    },
    onError: (error) => {
      toast({
        title: "Error updating bookmark",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      })
    },
  })

  // Delete a bookmark
  const deleteBookmark = useMutation({
    mutationFn: async (id: string) => {
      if (!user) {
        throw new Error("User not authenticated")
      }

      const { error } = await supabase
        .from("bookmarks")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)

      if (error) {
        throw new Error(`Error deleting bookmark: ${error.message}`)
      }

      return id
    },
    onSuccess: (id) => {
      toast({
        title: "Bookmark deleted",
        description: "Your bookmark has been deleted",
      })
      queryClient.invalidateQueries({ queryKey: ["bookmarks", user?.id] })
      queryClient.invalidateQueries({ queryKey: ["bookmark", user?.id, id] })
    },
    onError: (error) => {
      toast({
        title: "Error deleting bookmark",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      })
    },
  })

  // Move bookmark to folder
  const moveBookmarkToFolder = useMutation({
    mutationFn: async ({ bookmarkId, folderId }: { bookmarkId: string, folderId: string | null }) => {
      if (!user) {
        throw new Error("User not authenticated")
      }

      const { data, error } = await supabase
        .from("bookmarks")
        .update({ folder_id: folderId })
        .eq("id", bookmarkId)
        .eq("user_id", user.id)
        .select()
        .single()

      if (error) {
        throw new Error(`Error moving bookmark: ${error.message}`)
      }

      return data
    },
    onSuccess: (data) => {
      toast({
        title: "Bookmark moved",
        description: "Your bookmark has been moved successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["bookmarks", user?.id] })
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ["bookmark", user?.id, data.id] })
      }
    },
    onError: (error) => {
      toast({
        title: "Error moving bookmark",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      })
    },
  })

  // Helper function to fetch a single bookmark directly
  const fetchBookmarkById = async (bookmarkId: string) => {
    if (!user) {
      throw new Error("User not authenticated")
    }

    try {
      // Use direct Supabase query instead of depending on React Query's queryFn
      const { data, error } = await supabase
        .from("bookmarks")
        .select("*")
        .eq("id", bookmarkId)
        .eq("user_id", user.id)
        .single()

      if (error) {
        throw new Error(`Error fetching bookmark: ${error.message}`)
      }

      return data
    } catch (error) {
      console.error("Error fetching bookmark:", error)
      throw error
    }
  }

  return {
    getBookmarks,
    getBookmarkById,
    createBookmark,
    updateBookmark,
    deleteBookmark,
    moveBookmarkToFolder,
    fetchBookmarkById,
  }
}