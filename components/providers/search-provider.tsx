import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSemanticSearch } from '@/lib/hooks/use-semantic-search';

// Define the shape of our context
type SearchContextType = {
  isSearchActive: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: any;
  isSearching: boolean;
  searchError: string | null;
  clearSearch: () => void;
  searchType: "all" | "notes" | "bookmarks";
  setSearchType: (type: "all" | "notes" | "bookmarks") => void;
};

// Create the context with a default value
const SearchContext = createContext<SearchContextType>({
  isSearchActive: false,
  searchQuery: '',
  setSearchQuery: () => {},
  searchResults: null,
  isSearching: false,
  searchError: null,
  clearSearch: () => {},
  searchType: "all",
  setSearchType: () => {},
});

// Hook to use the search context
export const useSearch = () => useContext(SearchContext);

// Provider component
export const SearchProvider: React.FC<{ children: React.ReactNode, initialType?: "all" | "notes" | "bookmarks" }> = ({ 
  children,
  initialType = "notes"
}) => {
  // Use our semantic search hook
  const { 
    searchQuery, 
    setSearchQuery, 
    results, 
    isSearching, 
    error, 
    resetSearch,
    searchType,
    setSearchType
  } = useSemanticSearch({ 
    initialType,
    minQueryLength: 3,
    debounceMs: 800
  });

  // Derived state - is search active
  const isSearchActive = searchQuery.trim().length > 0;

  // Function to clear search
  const clearSearch = () => {
    resetSearch();
  };

  return (
    <SearchContext.Provider
      value={{
        isSearchActive,
        searchQuery,
        setSearchQuery,
        searchResults: results,
        isSearching,
        searchError: error,
        clearSearch,
        searchType,
        setSearchType
      }}
    >
      {children}
    </SearchContext.Provider>
  );
};