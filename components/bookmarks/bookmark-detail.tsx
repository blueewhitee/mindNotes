"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  ExternalLink, 
  Edit, 
  Star, 
  Trash, 
  FolderClosed,
  Share 
} from "lucide-react"
import { Bookmark } from "@/lib/hooks/use-bookmarks"
import { formatDistanceToNow } from "date-fns"

interface BookmarkDetailProps {
  bookmark: Bookmark | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (bookmark: Bookmark) => void
  onDelete?: (bookmarkId: string) => void
  onToggleFavorite?: (bookmark: Bookmark) => void
  folderName?: string | null
}

export function BookmarkDetail({ 
  bookmark, 
  open, 
  onOpenChange, 
  onEdit, 
  onDelete, 
  onToggleFavorite,
  folderName
}: BookmarkDetailProps) {
  const router = useRouter()
  
  if (!bookmark) return null

  const handleEdit = () => {
    onOpenChange(false)
    if (onEdit) {
      onEdit(bookmark)
    } else {
      router.push(`/dashboard/bookmark/${bookmark.id}`)
    }
  }

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this bookmark?")) {
      onOpenChange(false)
      if (onDelete) {
        onDelete(bookmark.id)
      }
    }
  }

  const handleToggleFavorite = () => {
    if (onToggleFavorite) {
      onToggleFavorite(bookmark)
    }
  }

  const openLink = () => {
    window.open(bookmark.url, "_blank")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            {bookmark.favicon_url ? (
              <img 
                src={bookmark.favicon_url} 
                alt={bookmark.title} 
                className="h-6 w-6 rounded-sm" 
              />
            ) : null}
            <DialogTitle className="text-xl">{bookmark.title}</DialogTitle>
          </div>
          <DialogDescription className="text-blue-500 break-all">
            <a 
              href={bookmark.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {bookmark.url}
            </a>
          </DialogDescription>
          <div className="flex flex-wrap gap-2 mt-2">
            {bookmark.tags?.map((tag, index) => (
              <Badge key={index} variant="outline">
                {tag}
              </Badge>
            ))}
            {folderName && (
              <Badge variant="secondary">
                <FolderClosed className="mr-1 h-3 w-3" />
                {folderName}
              </Badge>
            )}
            {bookmark.is_favorite && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                <Star className="mr-1 h-3 w-3 fill-yellow-500 text-yellow-500" />
                Favorite
              </Badge>
            )}
          </div>
        </DialogHeader>
        
        <Separator className="my-4" />
        
        {bookmark.description && (
          <div className="mt-2 mb-4">
            <h4 className="text-sm font-medium mb-1">Description</h4>
            <p className="text-sm whitespace-pre-wrap">{bookmark.description}</p>
          </div>
        )}
        
        <div className="text-xs text-muted-foreground mt-2">
          {bookmark.created_at && (
            <p>Added {formatDistanceToNow(new Date(bookmark.created_at), { addSuffix: true })}</p>
          )}
        </div>
        
        <DialogFooter className="flex sm:justify-between gap-2 mt-6">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={openLink}
              className="text-xs gap-1"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open Link
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleFavorite}
              className="text-xs gap-1"
            >
              <Star className={`h-3.5 w-3.5 ${bookmark.is_favorite ? "fill-yellow-400 text-yellow-400" : ""}`} />
              {bookmark.is_favorite ? "Unfavorite" : "Favorite"}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              className="text-xs gap-1"
            >
              <Edit className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              className="text-xs gap-1"
            >
              <Trash className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}