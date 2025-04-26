"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown, Folder, FolderPlus, MoreVertical, Edit, Trash, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useBookmarkFolders, BookmarkFolder } from "@/lib/hooks/use-bookmark-folders"
import { useAuth } from "@/components/providers/auth-provider"
import { isDemoUser } from "@/lib/utils"

interface FolderTreeProps {
  selectedFolderId: string | null
  onSelectFolder: (folderId: string | null) => void
}

export function FolderTree({ selectedFolderId, onSelectFolder }: FolderTreeProps) {
  const { folders, isLoading, createFolder, updateFolder, deleteFolder } = useBookmarkFolders()
  const { user } = useAuth() // Get the current user
  const isDemo = isDemoUser(user) // Check if demo user
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [newFolderName, setNewFolderName] = useState("")
  const [editingFolder, setEditingFolder] = useState<BookmarkFolder | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading folders...</div>
  }

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId)
    } else {
      newExpanded.add(folderId)
    }
    setExpandedFolders(newExpanded)
  }

  const handleCreateFolder = () => {
    if (!newFolderName.trim() || isDemo) return

    createFolder.mutate({
      name: newFolderName,
      parent_id: null, // Create at root level for now
    })

    setNewFolderName("")
    setIsDialogOpen(false)
  }

  const handleUpdateFolder = () => {
    if (!editingFolder || !newFolderName.trim() || isDemo) return

    updateFolder.mutate({
      id: editingFolder.id,
      name: newFolderName,
    })

    setEditingFolder(null)
    setNewFolderName("")
    setIsDialogOpen(false)
  }

  const handleDeleteFolder = (folderId: string) => {
    if (isDemo) return
    
    if (confirm("Are you sure you want to delete this folder? Bookmarks in this folder will be moved to the root level.")) {
      deleteFolder.mutate(folderId)
      if (selectedFolderId === folderId) {
        onSelectFolder(null)
      }
    }
  }

  const getFoldersByParentId = (parentId: string | null) => {
    return folders.filter(folder => folder.parent_id === parentId)
  }

  const renderFolder = (folder: BookmarkFolder, depth: number = 0) => {
    const childFolders = getFoldersByParentId(folder.id)
    const hasChildren = childFolders.length > 0
    const isExpanded = expandedFolders.has(folder.id)
    const isSelected = selectedFolderId === folder.id

    return (
      <div key={folder.id} className="w-full">
        <div 
          className={`group flex items-center px-2 py-1.5 hover:bg-accent/50 rounded-md cursor-pointer 
            ${isSelected ? 'bg-accent text-accent-foreground' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {hasChildren ? (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0 mr-1"
              onClick={(e) => {
                e.stopPropagation()
                toggleFolder(folder.id)
              }}
            >
              {isExpanded ? 
                <ChevronDown className="h-3.5 w-3.5" /> : 
                <ChevronRight className="h-3.5 w-3.5" />
              }
            </Button>
          ) : (
            <div className="w-6 h-6 mr-1" />
          )}
          
          <div 
            className="flex-1 flex items-center truncate"
            onClick={() => onSelectFolder(folder.id)}
          >
            <Folder className="h-4 w-4 mr-2 text-blue-500" />
            <span className="text-sm truncate">{folder.name}</span>
          </div>
          
          {!isDemo && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => {
                    setEditingFolder(folder)
                    setNewFolderName(folder.name)
                    setIsDialogOpen(true)
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  <span>Rename</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleDeleteFolder(folder.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        
        {isExpanded && hasChildren && (
          <div>
            {childFolders.map(childFolder => renderFolder(childFolder, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-full">
      {isDemo && (
        <div className="mb-2 px-2 py-1.5 bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200 rounded-md text-xs">
          <div className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            <span>Demo accounts cannot modify folders</span>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mb-2 px-2">
        <h3 className="font-medium text-sm">Folders</h3>
        {!isDemo ? (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 w-7 p-0"
                onClick={() => {
                  setEditingFolder(null)
                  setNewFolderName("")
                }}
              >
                <FolderPlus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  {editingFolder ? "Rename Folder" : "Create New Folder"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Input
                    id="folderName"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="col-span-4"
                    placeholder="Folder name"
                    autoFocus
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={editingFolder ? handleUpdateFolder : handleCreateFolder}
                  disabled={!newFolderName.trim()}
                >
                  {editingFolder ? "Save" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 w-7 p-0 opacity-60"
            disabled
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <div className="space-y-0.5">
        <div 
          className={`flex items-center px-2 py-1.5 hover:bg-accent/50 rounded-md cursor-pointer 
            ${selectedFolderId === null ? 'bg-accent text-accent-foreground' : ''}`}
          onClick={() => onSelectFolder(null)}
        >
          <Folder className="h-4 w-4 mr-2" />
          <span className="text-sm font-medium">Bookmarks</span>
        </div>
        
        {getFoldersByParentId(null).map(folder => renderFolder(folder))}
      </div>
    </div>
  )
}