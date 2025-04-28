"use client"

import { useState } from "react"
import { DashboardHeader } from "@/components/layout/dashboard-header"
import { BookmarkGrid } from "@/components/bookmarks/bookmark-grid"
import { SearchResultsBookmarkGrid } from "@/components/bookmarks/search-results-bookmark-grid"
import { FolderTree } from "@/components/bookmarks/folder-tree"
import { useSearch } from "@/components/providers/search-provider"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, SearchX } from "lucide-react"

export default function BookmarksPage() {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const { isSearchActive, searchResults, isSearching, searchQuery, searchError } = useSearch()
  
  // Show search results when search is active, otherwise show regular bookmarks
  const showSearchResults = isSearchActive && searchResults && !isSearching;
  const showNoSearchResults = isSearchActive && (!searchResults?.bookmarks || searchResults.bookmarks.length === 0) && !isSearching;
  
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
                No bookmarks found matching "{searchQuery}". Try a different search term.
              </AlertDescription>
            </Alert>
          ) : searchResults?.bookmarks && searchResults.bookmarks.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Search Results</AlertTitle>
              <AlertDescription>
                Found {searchResults.bookmarks.length} {searchResults.bookmarks.length === 1 ? 'bookmark' : 'bookmarks'} matching "{searchQuery}"
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
      
      <div className="mt-6 grid grid-cols-1 md:grid-cols-[250px_1fr] gap-6">
        {/* Only show folder tree when not searching */}
        <div className={`border rounded-lg p-4 ${showSearchResults ? 'md:hidden' : ''}`}>
          <FolderTree 
            selectedFolderId={selectedFolderId} 
            onSelectFolder={setSelectedFolderId} 
          />
        </div>
        
        <div className={`${showSearchResults ? 'md:col-span-2' : ''}`}>
          {isSearching ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[200px] rounded-xl" />
              ))}
            </div>
          ) : showSearchResults ? (
            <SearchResultsBookmarkGrid searchResults={searchResults.bookmarks} />
          ) : (
            <BookmarkGrid folderId={selectedFolderId} />
          )}
        </div>
      </div>
    </main>
  )
}