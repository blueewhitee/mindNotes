"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { BookmarkForm } from "@/components/bookmarks/bookmark-form"
import { useBookmarks } from "@/lib/hooks/use-bookmarks"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"
import { useAuth } from "@/components/providers/auth-provider"

export default function EditBookmarkPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { fetchBookmarkById } = useBookmarks()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bookmark, setBookmark] = useState<any>(null)

  useEffect(() => {
    const loadBookmark = async () => {
      if (!user || !params.id) {
        setIsLoading(false)
        setError("Bookmark not found or you don't have permission to edit it.")
        return
      }

      try {
        // Use the new helper function to fetch the bookmark directly
        const bookmarkId = params.id as string
        const result = await fetchBookmarkById(bookmarkId)

        if (!result) {
          setError("Bookmark not found")
        } else {
          setBookmark(result)
        }
      } catch (err) {
        console.error("Error loading bookmark:", err)
        setError(err instanceof Error ? err.message : "Failed to load bookmark")
      } finally {
        setIsLoading(false)
      }
    }

    loadBookmark()
  }, [user, params.id, fetchBookmarkById])

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-2xl py-6">
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error || !bookmark) {
    return (
      <div className="container mx-auto max-w-2xl py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || "Failed to load bookmark."}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-2xl py-6">
      <BookmarkForm initialData={bookmark} isEdit={true} />
    </div>
  )
}