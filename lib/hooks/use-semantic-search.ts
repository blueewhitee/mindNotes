import { useState, useRef, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useDebounce } from "@/lib/hooks/use-debounce";

interface SearchResult {
  notes: Array<{
    id: string;
    title: string;
    content: string;
    created_at: string;
    similarity: number;
  }>;
  bookmarks: Array<{
    id: string;
    title: string;
    url: string;
    created_at: string;
    similarity: number;
  }>;
  fallback?: boolean;
}

interface UseSemanticSearchProps {
  initialType?: "all" | "notes" | "bookmarks";
  minQueryLength?: number;
  debounceMs?: number;
}

export function useSemanticSearch({ 
  initialType = "all", 
  minQueryLength = 3, 
  debounceMs = 800 
}: UseSemanticSearchProps = {}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"all" | "notes" | "bookmarks">(initialType);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Track the last executed search query to avoid duplicates
  const lastQueryRef = useRef<string>("");
  // Track if a search is in progress
  const searchInProgressRef = useRef<boolean>(false);
  // Keep a queue of the most recent search request
  const pendingSearchRef = useRef<{query: string, type: string} | null>(null);
  
  // Debounce the search query input
  const debouncedSearchQuery = useDebounce(searchQuery, debounceMs);
  
  // Effect to handle debounced search
  useEffect(() => {
    if (debouncedSearchQuery && debouncedSearchQuery.trim().length >= minQueryLength) {
      executeSearch(debouncedSearchQuery, searchType);
    } else if (!debouncedSearchQuery.trim()) {
      // Clear results when query is empty
      setResults(null);
    }
  }, [debouncedSearchQuery, searchType]);

  // Function to execute the actual search with throttling
  const executeSearch = useCallback(async (query: string, type: "all" | "notes" | "bookmarks") => {
    // Skip if same as last search
    if (query === lastQueryRef.current) {
      return;
    }
    
    // If already searching, queue this request for later
    if (searchInProgressRef.current) {
      pendingSearchRef.current = { query, type };
      return;
    }
    
    // Execute search
    searchInProgressRef.current = true;
    lastQueryRef.current = query;
    
    await performSearch(query, type);
    
    // After search completes, check if we have a pending search
    searchInProgressRef.current = false;
    if (pendingSearchRef.current) {
      const { query: pendingQuery, type: pendingType } = pendingSearchRef.current;
      pendingSearchRef.current = null;
      executeSearch(pendingQuery, pendingType);
    }
  }, []);

  // Function to perform semantic search
  const performSearch = async (query: string, type: "all" | "notes" | "bookmarks" = searchType) => {
    if (!query.trim() || query.trim().length < minQueryLength) {
      setResults(null);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      console.log(`Executing search for: "${query}" (type: ${type})`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout
      
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, type }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to perform search");
      }

      const data = await response.json();
      setResults(data);
      
      // Log some metrics about the search
      if (data.fallback) {
        console.log("Used fallback text search instead of semantic search");
      }
      console.log(
        `Found ${data.notes?.length || 0} notes and ${data.bookmarks?.length || 0} bookmarks matching "${query}"`
      );
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn("Search request timed out after 10 seconds");
        setError("Search request timed out. Please try again with a more specific query.");
      } else {
        console.error("Search error:", error);
        setError(error instanceof Error ? error.message : "An unexpected error occurred");
        
        // Only show toast for non-timeout errors to avoid spamming the user
        if (error.name !== 'AbortError') {
          toast({
            title: "Search failed",
            description: "Failed to perform search. Please try again later.",
            variant: "destructive",
          });
        }
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Reset search state
  const resetSearch = useCallback(() => {
    setSearchQuery("");
    setResults(null);
    setError(null);
    lastQueryRef.current = "";
  }, []);

  // Function to update the embedding for a note (call this when saving a note)
  const updateNoteEmbedding = async (noteId: string, content: string) => {
    try {
      if (!content.trim()) return;

      const response = await fetch("/api/search/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: noteId, content, type: "note" }),
      });

      if (!response.ok) {
        console.error("Failed to update note embedding");
      }
    } catch (error) {
      console.error("Error updating note embedding:", error);
    }
  };

  // Function to update the embedding for a bookmark (call this when saving a bookmark)
  const updateBookmarkEmbedding = async (bookmarkId: string, title: string, description: string) => {
    try {
      const content = `${title} ${description}`.trim();
      if (!content) return;

      const response = await fetch("/api/search/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: bookmarkId, content, type: "bookmark" }),
      });

      if (!response.ok) {
        console.error("Failed to update bookmark embedding");
      }
    } catch (error) {
      console.error("Error updating bookmark embedding:", error);
    }
  };

  return {
    searchQuery,
    setSearchQuery,
    searchType,
    setSearchType,
    isSearching,
    results,
    error,
    performSearch,
    resetSearch,
    updateNoteEmbedding,
    updateBookmarkEmbedding,
  };
}