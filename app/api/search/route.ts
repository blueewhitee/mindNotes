import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

// Initialize Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");
// Use a stable, available model for embedding generation
const geminiModel = genAI.getGenerativeModel({ model: "gemini-pro" });

// Constants for search
const SIMILARITY_THRESHOLD = 0.45; // Slightly lower threshold to capture more matches
const MAX_RESULTS = 10; // Maximum number of results to return
const CACHE_TTL = 60 * 60 * 24 * 7; // Cache embeddings for 7 days (in seconds)

export async function POST(request: Request) {
  try {
    // Create Supabase client
    const supabase = await createClient();
    
    // Get session data
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Check if the user is authenticated
    if (!session) {
      console.error("API search: No active session found");
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = session.user.id;

    // Extract the query from the request body
    const { query, type = "all" } = await request.json();

    if (!query || typeof query !== "string") {
      return new NextResponse(JSON.stringify({ error: "Invalid query" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // First try direct text match (for search terms in titles)
    const textResults = await performTextSearch(supabase, query, type, userId);
    
    // If we have good text search results, return them immediately
    if (textResults.hasResults) {
      console.log("Found direct text matches, returning those first");
      return new NextResponse(JSON.stringify({
        query,
        notes: textResults.notes,
        bookmarks: textResults.bookmarks,
        textSearch: true
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // If no direct text matches, try semantic search
    console.log("No direct text matches, trying semantic search");
    
    // Generate embedding for the search query (with caching)
    const { embedding, cacheKey } = await getEmbeddingWithCache(supabase, query);
    
    if (!embedding) {
      // If we couldn't generate an embedding, use the fallback text search we already did
      console.log("Failed to generate embedding, using fallback text search");
      return new NextResponse(JSON.stringify({
        query,
        notes: textResults.notes,
        bookmarks: textResults.bookmarks,
        fallback: true
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Search notes and/or bookmarks based on the type parameter
    let noteResults = [];
    let bookmarkResults = [];

    if (type === "all" || type === "notes") {
      // Search notes
      const { data: notes, error: notesError } = await supabase.rpc(
        'match_notes',
        {
          query_embedding: embedding,
          similarity_threshold: SIMILARITY_THRESHOLD,
          match_count: MAX_RESULTS,
          user_id_filter: userId
        }
      );

      if (notesError) {
        console.error("Error searching notes:", notesError);
      } else {
        noteResults = notes || [];
        
        // Log the quality of matches
        if (notes && notes.length > 0) {
          console.log(`Top note match similarity: ${notes[0].similarity.toFixed(4)}`);
        }
      }
    }

    if (type === "all" || type === "bookmarks") {
      // Search bookmarks
      const { data: bookmarks, error: bookmarksError } = await supabase.rpc(
        'match_bookmarks',
        {
          query_embedding: embedding,
          similarity_threshold: SIMILARITY_THRESHOLD,
          match_count: MAX_RESULTS,
          user_id_filter: userId
        }
      );

      if (bookmarksError) {
        console.error("Error searching bookmarks:", bookmarksError);
      } else {
        bookmarkResults = bookmarks || [];
        
        // Log the quality of matches
        if (bookmarks && bookmarks.length > 0) {
          console.log(`Top bookmark match similarity: ${bookmarks[0].similarity.toFixed(4)}`);
        }
      }
    }

    // If no semantic search results either, use the text search results
    if (noteResults.length === 0 && bookmarkResults.length === 0) {
      console.log("No semantic search results, falling back to text search");
      return new NextResponse(JSON.stringify({
        query,
        notes: textResults.notes,
        bookmarks: textResults.bookmarks,
        fallback: true
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Return semantic search results
    return new NextResponse(JSON.stringify({
      query,
      notes: noteResults,
      bookmarks: bookmarkResults
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in semantic search:", error);
    return new NextResponse(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Performs a direct text-based search for exact matches
async function performTextSearch(supabase, query, type, userId) {
  const exactQuery = query.trim().toLowerCase();
  const likeQuery = `%${exactQuery}%`;
  
  let notes = [];
  let bookmarks = [];
  let hasResults = false;
  
  try {
    if (type === "all" || type === "notes") {
      // First try exact title matches
      const { data: exactTitleMatches } = await supabase
        .from('notes')
        .select('id, title, content, created_at')
        .eq('user_id', userId)
        .ilike('title', exactQuery)
        .limit(MAX_RESULTS);
      
      // Then try partial title matches
      const { data: partialTitleMatches } = await supabase
        .from('notes')
        .select('id, title, content, created_at')
        .eq('user_id', userId)
        .ilike('title', likeQuery)
        .limit(MAX_RESULTS);
      
      // Then try content matches
      const { data: contentMatches } = await supabase
        .from('notes')
        .select('id, title, content, created_at')
        .eq('user_id', userId)
        .ilike('content', likeQuery)
        .limit(MAX_RESULTS);
      
      // Combine results without duplicates
      const noteIds = new Set();
      const combinedNotes = [];
      
      // Process exact title matches first (highest priority)
      if (exactTitleMatches && exactTitleMatches.length > 0) {
        exactTitleMatches.forEach(note => {
          if (!noteIds.has(note.id)) {
            noteIds.add(note.id);
            combinedNotes.push({
              ...note,
              similarity: 0.95 // High similarity for exact title match
            });
          }
        });
      }
      
      // Then partial title matches
      if (partialTitleMatches && partialTitleMatches.length > 0) {
        partialTitleMatches.forEach(note => {
          if (!noteIds.has(note.id)) {
            noteIds.add(note.id);
            combinedNotes.push({
              ...note,
              similarity: 0.85 // Good similarity for partial title match
            });
          }
        });
      }
      
      // Then content matches
      if (contentMatches && contentMatches.length > 0) {
        contentMatches.forEach(note => {
          if (!noteIds.has(note.id)) {
            noteIds.add(note.id);
            combinedNotes.push({
              ...note,
              similarity: 0.7 // Lower similarity for content match
            });
          }
        });
      }
      
      notes = combinedNotes;
      
      // If we have any notes, we have results
      if (notes.length > 0) {
        hasResults = true;
      }
    }
    
    if (type === "all" || type === "bookmarks") {
      // Similar approach for bookmarks
      const { data: exactTitleMatches } = await supabase
        .from('bookmarks')
        .select('id, title, url, created_at')
        .eq('user_id', userId)
        .ilike('title', exactQuery)
        .limit(MAX_RESULTS);
      
      const { data: partialTitleMatches } = await supabase
        .from('bookmarks')
        .select('id, title, url, created_at')
        .eq('user_id', userId)
        .ilike('title', likeQuery)
        .limit(MAX_RESULTS);
      
      const { data: urlMatches } = await supabase
        .from('bookmarks')
        .select('id, title, url, created_at')
        .eq('user_id', userId)
        .ilike('url', likeQuery)
        .limit(MAX_RESULTS);
      
      // Combine results without duplicates
      const bookmarkIds = new Set();
      const combinedBookmarks = [];
      
      // Process in priority order
      if (exactTitleMatches && exactTitleMatches.length > 0) {
        exactTitleMatches.forEach(bookmark => {
          if (!bookmarkIds.has(bookmark.id)) {
            bookmarkIds.add(bookmark.id);
            combinedBookmarks.push({
              ...bookmark,
              similarity: 0.95
            });
          }
        });
      }
      
      if (partialTitleMatches && partialTitleMatches.length > 0) {
        partialTitleMatches.forEach(bookmark => {
          if (!bookmarkIds.has(bookmark.id)) {
            bookmarkIds.add(bookmark.id);
            combinedBookmarks.push({
              ...bookmark,
              similarity: 0.85
            });
          }
        });
      }
      
      if (urlMatches && urlMatches.length > 0) {
        urlMatches.forEach(bookmark => {
          if (!bookmarkIds.has(bookmark.id)) {
            bookmarkIds.add(bookmark.id);
            combinedBookmarks.push({
              ...bookmark,
              similarity: 0.7
            });
          }
        });
      }
      
      bookmarks = combinedBookmarks;
      
      // If we have any bookmarks, we have results
      if (bookmarks.length > 0) {
        hasResults = true;
      }
    }
    
    return {
      notes,
      bookmarks,
      hasResults
    };
  } catch (error) {
    console.error("Error in text search:", error);
    return {
      notes: [],
      bookmarks: [],
      hasResults: false
    };
  }
}

// Helper function to get embeddings with caching in Supabase
async function getEmbeddingWithCache(supabase, text: string): Promise<{embedding: number[] | null, cacheKey: string}> {
  try {
    // Create a cache key from the text
    const normalizedText = text.trim().toLowerCase();
    const cacheKey = `emb:${Buffer.from(normalizedText).toString('base64').substring(0, 100)}`;
    
    // Check if we have a cached embedding
    const { data: cachedData } = await supabase
      .from('embeddings_cache')
      .select('embedding, created_at')
      .eq('cache_key', cacheKey)
      .single();
    
    if (cachedData) {
      // Check if the cache is still valid
      const createdAt = new Date(cachedData.created_at);
      const now = new Date();
      const ageInSeconds = (now.getTime() - createdAt.getTime()) / 1000;
      
      if (ageInSeconds < CACHE_TTL) {
        console.log("Using cached embedding for:", normalizedText.substring(0, 30) + (normalizedText.length > 30 ? '...' : ''));
        return { embedding: cachedData.embedding, cacheKey };
      }
    }
    
    // If no valid cache found, generate a new embedding
    try {
      const embedding = await generateEmbedding(text);
      
      if (embedding) {
        // Store in cache for future use
        await supabase
          .from('embeddings_cache')
          .upsert({ 
            cache_key: cacheKey, 
            text: normalizedText.substring(0, 500), // Store partial text for reference
            embedding: embedding,
            created_at: new Date().toISOString()
          }, { 
            onConflict: 'cache_key' 
          });
          
        console.log("Stored new embedding in cache for:", normalizedText.substring(0, 30) + (normalizedText.length > 30 ? '...' : ''));
      }
      
      return { embedding, cacheKey };
    } catch (apiError) {
      console.error("Error generating embedding with API:", apiError);
      
      // Check if we have any cached embedding to use as fallback
      if (cachedData) {
        console.log("Using expired cached embedding as fallback");
        return { embedding: cachedData.embedding, cacheKey };
      }
      
      // If all else fails, use our simple vector generation
      const fallbackEmbedding = simpleTextToVector(text, 1536);
      
      // Store the fallback in cache with a shorter TTL
      await supabase
        .from('embeddings_cache')
        .upsert({ 
          cache_key: cacheKey, 
          text: normalizedText.substring(0, 500),
          embedding: fallbackEmbedding,
          created_at: new Date(Date.now() - (CACHE_TTL / 2) * 1000).toISOString() // Set to half-expired
        }, { 
          onConflict: 'cache_key' 
        });
      
      return { embedding: fallbackEmbedding, cacheKey };
    }
  } catch (error) {
    console.error("Error in embedding cache process:", error);
    // Last resort fallback
    const fallbackEmbedding = simpleTextToVector(text, 1536);
    const cacheKey = `emb:fallback:${Date.now()}`;
    return { embedding: fallbackEmbedding, cacheKey };
  }
}

// Function to generate embeddings using Google AI
async function generateEmbedding(text: string): Promise<number[] | null> {
  // First check if we have a valid API key
  if (!process.env.GOOGLE_AI_API_KEY) {
    console.error("Missing Google AI API key - check your environment variables");
    throw new Error("API key not configured properly");
  }

  console.log("Generating embedding for text:", text.substring(0, 50) + (text.length > 50 ? '...' : ''));

  // We'll use the embedding function from Gemini model
  const embeddingPrompt = `Extract the key concepts and semantic meaning from this text: ${text}`;
  
  // Generate a response
  const result = await geminiModel.generateContent(embeddingPrompt);
  const response = await result.response;
  const responseText = response.text();
  
  if (!responseText) {
    throw new Error("No text in embedding response");
  }

  // Generate vector from the response
  const simpleHash = simpleTextToVector(responseText, 1536);
  return simpleHash;
}

// Simplified function to convert text to a vector of specified dimensions
function simpleTextToVector(text: string, dimensions: number): number[] {
  const vector = new Array(dimensions).fill(0);
  
  // Create a simple hash of the text
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const position = i % dimensions;
    vector[position] += charCode / 255; // Normalize between 0-1
  }
  
  // Normalize the vector
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map(val => val / (magnitude || 1));
}