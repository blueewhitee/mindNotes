"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Bookmark, Edit, ExternalLink, MoreVertical, Star, Trash, FolderClosed } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { useBookmarks, Bookmark as BookmarkType } from "@/lib/hooks/use-bookmarks"
import { useBookmarkFolders } from "@/lib/hooks/use-bookmark-folders"
import { formatDistanceToNow } from "date-fns"
import { BookmarkDetail } from "./bookmark-detail"
import { useAuth } from "@/components/providers/auth-provider"
import { isDemoUser } from "@/lib/utils"

interface BookmarkCardProps {
  bookmark: BookmarkType
}

export function BookmarkCard({ bookmark }: BookmarkCardProps) {
  const router = useRouter()
  const { deleteBookmark, updateBookmark, moveBookmarkToFolder } = useBookmarks()
  const { folders } = useBookmarkFolders()
  const { user } = useAuth() // Get the current user
  const isDemo = isDemoUser(user) // Check if demo user
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const handleDelete = async () => {
    if (isDeleting) return
    
    setIsDeleting(true)
    try {
      await deleteBookmark.mutateAsync(bookmark.id)
    } catch (error) {
      console.error("Error deleting bookmark:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggleFavorite = async () => {
    if (isUpdating) return
    
    setIsUpdating(true)
    try {
      await updateBookmark.mutateAsync({
        id: bookmark.id,
        is_favorite: !bookmark.is_favorite
      })
    } catch (error) {
      console.error("Error updating bookmark:", error)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleMoveToFolder = async (folderId: string | null) => {
    if (isMoving || bookmark.folder_id === folderId) return
    
    setIsMoving(true)
    try {
      await moveBookmarkToFolder.mutateAsync({
        bookmarkId: bookmark.id,
        folderId
      })
    } catch (error) {
      console.error("Error moving bookmark:", error)
    } finally {
      setIsMoving(false)
    }
  }

  const openBookmark = (e?: React.MouseEvent) => {
    if (e) e.preventDefault()
    window.open(bookmark.url, "_blank")
  }

  const editBookmark = (e?: React.MouseEvent) => {
    if (e) e.preventDefault()
    router.push(`/dashboard/bookmark/${bookmark.id}`)
  }

  const openDetail = (e?: React.MouseEvent) => {
    if (e) e.preventDefault()
    setIsDetailOpen(true)
  }

  // Find the current folder name
  const currentFolder = bookmark.folder_id 
    ? folders.find(f => f.id === bookmark.folder_id)
    : null

  return (
    <>
      <Card 
        className={`group flex flex-col justify-between transition-all hover:shadow-md ${isHovered ? 'transform scale-105 z-10' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={openDetail}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <a 
              className="flex items-center gap-2 cursor-pointer hover:underline"
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation()
                openBookmark(e)
              }}
            >
              {bookmark.favicon_url ? (
                <img 
                  src={bookmark.favicon_url} 
                  alt={bookmark.title} 
                  className="h-5 w-5 rounded-sm" 
                />
              ) : (
                <Bookmark className="h-5 w-5 text-muted-foreground" />
              )}
              <CardTitle className="text-base font-medium">{bookmark.title}</CardTitle>
            </a>
            {!isDemo && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={openBookmark}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    <span>Open URL</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={editBookmark}>
                    <Edit className="mr-2 h-4 w-4" />
                    <span>Edit</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleToggleFavorite}>
                    <Star className={`mr-2 h-4 w-4 ${bookmark.is_favorite ? "fill-yellow-400 text-yellow-400" : ""}`} />
                    <span>{bookmark.is_favorite ? "Remove from favorites" : "Add to favorites"}</span>
                  </DropdownMenuItem>
                  
                  {/* Folder options submenu */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <FolderClosed className="mr-2 h-4 w-4" />
                      <span>Move to folder</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => handleMoveToFolder(null)}>
                        <span className={bookmark.folder_id === null ? "font-medium" : ""}>Root</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {folders.map(folder => (
                        <DropdownMenuItem 
                          key={folder.id} 
                          onClick={() => handleMoveToFolder(folder.id)}
                        >
                          <span className={bookmark.folder_id === folder.id ? "font-medium" : ""}>
                            {folder.name}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash className="mr-2 h-4 w-4" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <a 
            className="line-clamp-1 break-all pt-1 cursor-pointer text-blue-500 hover:underline"
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation()
              openBookmark(e)
            }}
          >
            {bookmark.url}
          </a>
        </CardHeader>
        <CardContent className="pb-2">
          {bookmark.description && (
            <div className="relative">
              <p className={isHovered ? "text-sm" : "line-clamp-2 text-sm text-muted-foreground"}>
                {bookmark.description}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {bookmark.tags?.map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {currentFolder && (
              <Badge variant="secondary" className="text-xs">
                <FolderClosed className="mr-1 h-3 w-3" />
                {currentFolder.name}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {bookmark.created_at && (
              formatDistanceToNow(new Date(bookmark.created_at), { addSuffix: true })
            )}
          </div>
        </CardFooter>
      </Card>

      <BookmarkDetail
        bookmark={bookmark}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onDelete={handleDelete}
        onToggleFavorite={handleToggleFavorite}
        folderName={currentFolder?.name}
        isDemo={isDemo}
      />
    </>
  )
}