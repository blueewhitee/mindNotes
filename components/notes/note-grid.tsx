"use client"

import type { Note } from "@/lib/types/database.types"
import { NoteCard } from "@/components/notes/note-card"
import { useIsMobile } from "@/hooks/use-mobile"

interface NoteGridProps {
  notes: Note[]
}

export function NoteGrid({ notes }: NoteGridProps) {
  const isMobile = useIsMobile()

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h3 className="text-xl font-medium">No notes yet</h3>
        <p className="text-muted-foreground">Create your first note to get started</p>
      </div>
    )
  }

  return (
    <div className={isMobile ? "space-y-4" : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} />
      ))}
    </div>
  )
}
