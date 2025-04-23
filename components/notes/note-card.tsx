"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Note } from "@/lib/types/database.types"
import { formatDate, truncateText } from "@/lib/utils"
import { useNotes } from "@/lib/hooks/use-notes"
import { useIsMobile } from "@/components/ui/use-mobile"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { 
  Archive, 
  MoreVertical, 
  Trash, 
  FileText 
} from "lucide-react"

interface NoteCardProps {
  note: Note
}

export function NoteCard({ note }: NoteCardProps) {
  const router = useRouter()
  const { deleteNote, archiveNote } = useNotes()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const isMobile = useIsMobile()

  const handleDelete = async () => {
    await deleteNote.mutateAsync(note.id)
    setShowDeleteDialog(false)
  }

  const handleArchive = async () => {
    await archiveNote.mutateAsync(note.id)
  }

  // Determine card content based on what's available
  // Show more content on hover for desktop, but keep it shorter on mobile regardless
  const displayContent = note.content 
    ? truncateText(note.content, isHovered && !isMobile ? 300 : 150) 
    : "No content"

  return (
    <>
      <Card 
        className={`relative flex h-full flex-col transition-all duration-300 ${
          isHovered && !isMobile ? 'scale-[1.03] shadow-lg z-10' : 'hover:shadow-md'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-medium">
            <Link href={`/dashboard/note/${note.id}`} className="hover:underline">
              {truncateText(note.title, 50)}
            </Link>
          </CardTitle>
          <div className="flex items-center gap-1">
            {note.summary && (
              <span className="text-blue-500">
                <FileText className="h-3.5 w-3.5" />
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push(`/dashboard/note/${note.id}`)}>Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={handleArchive}>
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <p className="text-sm text-muted-foreground">{displayContent}</p>
          
          {/* Summary section that appears on hover for desktop, always visible on mobile */}
          {(isHovered || isMobile) && note.summary && (
            <div className="mt-4 border-t pt-3 animate-fadeIn">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-blue-500" />
                <h4 className="font-medium text-sm">Summary</h4>
              </div>
              <p className="text-xs text-muted-foreground">{note.summary}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="pt-2">
          <p className="text-xs text-muted-foreground">Updated {formatDate(note.updated_at)}</p>
        </CardFooter>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the note.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
