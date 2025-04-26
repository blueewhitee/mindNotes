"use client"

import { useState } from "react"
import { useBookmarks, Bookmark } from "@/lib/hooks/use-bookmarks"
import { BookmarkCard } from "@/components/bookmarks/bookmark-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"

interface BookmarkGridProps {
  folderId?: string | null
}

export function BookmarkGrid({ folderId }: BookmarkGridProps) {
  const { getBookmarks } = useBookmarks()
  const [currentView, setCurrentView] = useState<"all" | "favorites">("all")
  
  if (getBookmarks.isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  
  if (getBookmarks.isError) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {getBookmarks.error instanceof Error
            ? getBookmarks.error.message
            : "Failed to load bookmarks."}
        </AlertDescription>
      </Alert>
    )
  }

  // Filter bookmarks by folder
  const allBookmarks = getBookmarks.data || []
  
  // Filter by folder if folderId is provided
  const folderFilteredBookmarks = folderId !== undefined
    ? allBookmarks.filter(bookmark => bookmark.folder_id === folderId)
    : allBookmarks
  
  // Then filter by favorite status
  const displayedBookmarks = currentView === "all" 
    ? folderFilteredBookmarks 
    : folderFilteredBookmarks.filter(bookmark => bookmark.is_favorite)
  
  if (allBookmarks.length === 0) {
    return (
      <div className="mt-16 flex flex-col items-center justify-center gap-2 text-center">
        <h3 className="text-xl font-semibold">No bookmarks yet</h3>
        <p className="text-muted-foreground">
          Add your first bookmark by clicking the "Add Bookmark" button above.
        </p>
      </div>
    )
  }

  // Show folder-specific empty state
  if (folderId !== undefined && folderFilteredBookmarks.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center justify-center gap-2 text-center">
        <h3 className="text-xl font-semibold">No bookmarks in this folder</h3>
        <p className="text-muted-foreground">
          Add bookmarks to this folder or select a different folder.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Tabs 
        defaultValue="all" 
        value={currentView} 
        onValueChange={(value) => setCurrentView(value as "all" | "favorites")}
        className="w-[200px]"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
        </TabsList>
      </Tabs>

      {displayedBookmarks.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center gap-2 text-center">
          <h3 className="text-xl font-semibold">No favorite bookmarks</h3>
          <p className="text-muted-foreground">
            Mark bookmarks as favorites to see them here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayedBookmarks.map((bookmark) => (
            <BookmarkCard key={bookmark.id} bookmark={bookmark} />
          ))}
        </div>
      )}
    </div>
  )
}