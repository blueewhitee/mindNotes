"use client"

import { useNotes } from "@/lib/hooks/use-notes"
import { DashboardHeader } from "@/components/layout/dashboard-header"
import { NoteGrid } from "@/components/notes/note-grid"
import { SearchResultsGrid } from "@/components/notes/search-results-grid"
import { useSearch } from "@/components/providers/search-provider"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, SearchX } from "lucide-react"

export default function DashboardPage() {
  const { notes, isLoading } = useNotes()
  const { isSearchActive, searchResults, isSearching, searchQuery, searchError } = useSearch()

  // Show search results when search is active, otherwise show regular notes
  const showSearchResults = isSearchActive && searchResults && !isSearching;
  const showNoSearchResults = isSearchActive && (!searchResults?.notes || searchResults.notes.length === 0) && !isSearching;

  return (
    <main className="container flex-1 py-6">
      <DashboardHeader />
      
      {/* Search status bar */}
      {isSearchActive && !isSearching && (
        <div className="mt-6 mb-2">
          {showNoSearchResults ? (
            <Alert variant="destructive">
              <SearchX className="h-4 w-4" />
              <AlertTitle>No results found</AlertTitle>
              <AlertDescription>
                No notes found matching "{searchQuery}". Try a different search term.
              </AlertDescription>
            </Alert>
          ) : searchResults?.notes && searchResults.notes.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Search Results</AlertTitle>
              <AlertDescription>
                Found {searchResults.notes.length} {searchResults.notes.length === 1 ? 'note' : 'notes'} matching "{searchQuery}"
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
      
      {/* Show search error if any */}
      {searchError && (
        <div className="mt-6 mb-2">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Search Error</AlertTitle>
            <AlertDescription>{searchError}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="mt-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[200px] rounded-xl" />
            ))}
          </div>
        ) : isSearching ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[200px] rounded-xl" />
            ))}
          </div>
        ) : showSearchResults ? (
          <SearchResultsGrid searchResults={searchResults.notes} />
        ) : (
          <NoteGrid notes={notes} />
        )}
      </div>
    </main>
  )
}
