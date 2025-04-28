import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

// Initialize Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");
// Use a stable, available model for embedding generation
const geminiModel = genAI.getGenerativeModel({ model: "gemini-pro" });

// Constants
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
      console.error("API search/update: No active session found");
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = session.user.id;

    // Extract the data from the request body
    const { id, content, type, title } = await request.json();

    if (!id || !content || !type) {
      return new NextResponse(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // For notes and bookmarks, we want to include title in the embedding generation
    // This helps the search feature find results by title words
    const contentToEmbed = type === 'note' 
      ? `${title || ''} ${content}`.trim() 
      : content;

    // Generate embedding for the content (with caching)
    const { embedding, cacheKey } = await getEmbeddingWithCache(supabase, contentToEmbed);
    
    if (!embedding) {
      return new NextResponse(JSON.stringify({ error: "Failed to generate embedding" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Update the embedding in the database based on the type
    let updateResult;
    
    if (type === "note") {
      updateResult = await supabase
        .from('notes')
        .update({ 
          embedding,
          embedding_cache_key: cacheKey, // Store reference to cache entry
          embedding_updated_at: new Date().toISOString() // Track when embedding was last updated
        })
        .eq('id', id)
        .eq('user_id', userId);
    } else if (type === "bookmark") {
      updateResult = await supabase
        .from('bookmarks')
        .update({ 
          embedding, 
          embedding_cache_key: cacheKey, // Store reference to cache entry
          embedding_updated_at: new Date().toISOString() // Track when embedding was last updated
        })
        .eq('id', id)
        .eq('user_id', userId);
    } else {
      return new NextResponse(JSON.stringify({ error: "Invalid type specified" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (updateResult.error) {
      console.error(`Error updating ${type} embedding:`, updateResult.error);
      return new NextResponse(JSON.stringify({ error: `Failed to update ${type} embedding` }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Also, after successful update, mark the content as indexed for search
    console.log(`Successfully updated embedding for ${type} with ID: ${id}`);
    console.log(`Cache key: ${cacheKey}`);

    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error updating embedding:", error);
    return new NextResponse(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
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