"use client"

import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/components/providers/auth-provider"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/use-toast"

export interface BookmarkFolder {
  id: string
  user_id: string
  name: string
  parent_id: string | null
  created_at?: string
  updated_at?: string
}

export interface BookmarkFolderInsert {
  name: string
  parent_id?: string | null
}

export function useBookmarkFolders() {
  const { user } = useAuth()
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Get all folders
  const getFolders = useQuery({
    queryKey: ["bookmark-folders", user?.id],
    queryFn: async () => {
      if (!user) return []

      const { data, error } = await supabase
        .from("bookmark_folders")
        .select("*")
        .eq("user_id", user.id)
        .order("name")

      if (error) throw new Error(`Error fetching folders: ${error.message}`)
      return data || []
    },
    enabled: !!user,
  })

  // Create a new folder
  const createFolder = useMutation({
    mutationFn: async (folder: BookmarkFolderInsert) => {
      if (!user) throw new Error("User not authenticated")

      const { data, error } = await supabase
        .from("bookmark_folders")
        .insert([{ ...folder, user_id: user.id }])
        .select()
        .single()

      if (error) throw new Error(`Error creating folder: ${error.message}`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmark-folders", user?.id] })
      toast({
        title: "Folder created",
        description: "Your folder has been created successfully",
      })
    },
    onError: (error) => {
      toast({
        title: "Error creating folder",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      })
    },
  })

  // Update a folder
  const updateFolder = useMutation({
    mutationFn: async ({ id, ...folder }: Partial<BookmarkFolder> & { id: string }) => {
      if (!user) throw new Error("User not authenticated")

      const { data, error } = await supabase
        .from("bookmark_folders")
        .update(folder)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single()

      if (error) throw new Error(`Error updating folder: ${error.message}`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmark-folders", user?.id] })
      toast({
        title: "Folder updated",
        description: "Your folder has been updated successfully",
      })
    },
    onError: (error) => {
      toast({
        title: "Error updating folder",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      })
    },
  })

  // Delete a folder
  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("User not authenticated")

      // First, move all bookmarks in this folder to null (root)
      const { error: bookmarkError } = await supabase
        .from("bookmarks")
        .update({ folder_id: null })
        .eq("folder_id", id)
        .eq("user_id", user.id)

      if (bookmarkError) throw new Error(`Error updating bookmarks: ${bookmarkError.message}`)

      // Then delete the folder
      const { error } = await supabase
        .from("bookmark_folders")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)

      if (error) throw new Error(`Error deleting folder: ${error.message}`)
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmark-folders", user?.id] })
      queryClient.invalidateQueries({ queryKey: ["bookmarks", user?.id] })
      toast({
        title: "Folder deleted",
        description: "Your folder has been deleted successfully",
      })
    },
    onError: (error) => {
      toast({
        title: "Error deleting folder",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      })
    },
  })

  return {
    folders: getFolders.data || [],
    isLoading: getFolders.isLoading,
    error: getFolders.error,
    createFolder,
    updateFolder,
    deleteFolder,
  }
}