"use client"

import { useIsMobile } from "@/hooks/use-mobile"
import { NoteCard } from "@/components/notes/note-card"
import { Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"

// Define the search result item type
interface SearchResultNote {
  id: string
  title: string
  content: string
  created_at: string
  updated_at?: string
  similarity: number
}

interface SearchResultsGridProps {
  searchResults: SearchResultNote[]
}

export function SearchResultsGrid({ searchResults }: SearchResultsGridProps) {
  const isMobile = useIsMobile()

  if (!searchResults || searchResults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h3 className="text-xl font-medium">No search results</h3>
        <p className="text-muted-foreground">Try a different search term</p>
      </div>
    )
  }

  return (
    <>
      <div className={isMobile ? "space-y-4" : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
        {searchResults.map((note) => (
          <div key={note.id} className="relative group">
            <NoteCard note={note} />
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-yellow-500" />
                <span>{Math.round(note.similarity * 100)}%</span>
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}