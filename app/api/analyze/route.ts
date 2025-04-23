import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { Redis } from "@upstash/redis"
import { GoogleGenerativeAI } from "@google/generative-ai"

// Initialize Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");
// Use gemini-2.0-flash consistently for all requests
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Initialize Redis client for rate limiting and caching
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null

// Rate limit settings
const MAX_REQUESTS_PER_USER = 10 // Max requests per hour
const WINDOW_DURATION = 60 * 60 // 1 hour in seconds
const MAX_CONTENT_LENGTH = 10000 // Max characters to process
const MINIMUM_REQUEST_INTERVAL = 10 // Minimum seconds between requests

export async function POST(request: Request) {
  try {
    // Await the createClient function since it's now async
    const supabase = await createClient()
    
    // Get session data
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // Check if the user is authenticated
    if (!session) {
      console.error("API analyze: No active session found")
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const userId = session.user.id

    // Extract the content from the request body
    const { content } = await request.json()

    if (!content || typeof content !== "string") {
      return new NextResponse(JSON.stringify({ error: "Invalid content" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Check content length
    if (content.length > MAX_CONTENT_LENGTH) {
      return new NextResponse(JSON.stringify({ 
        error: `Content too large. Maximum ${MAX_CONTENT_LENGTH} characters allowed.` 
      }), {
        status: 413, // Payload Too Large
        headers: { "Content-Type": "application/json" },
      })
    }

    // Rate limiting and caching logic
    if (redis) {
      // 1. Check for rate limiting
      const requestCountKey = `user:${userId}:request_count`
      const requestCount = await redis.get(requestCountKey) || 0
      
      if (Number(requestCount) >= MAX_REQUESTS_PER_USER) {
        return new NextResponse(JSON.stringify({ 
          error: "Rate limit exceeded. Try again later.",
          retryAfter: WINDOW_DURATION
        }), {
          status: 429, // Too Many Requests
          headers: { 
            "Content-Type": "application/json",
            "Retry-After": WINDOW_DURATION.toString()
          },
        })
      }
      
      // 2. Check for minimum interval between requests
      const lastRequestTimeKey = `user:${userId}:last_request_time`
      const lastRequestTime = await redis.get(lastRequestTimeKey) || 0
      const currentTime = Math.floor(Date.now() / 1000)
      
      if (currentTime - Number(lastRequestTime) < MINIMUM_REQUEST_INTERVAL) {
        return new NextResponse(JSON.stringify({ 
          error: "Please wait before making another request",
          retryAfter: MINIMUM_REQUEST_INTERVAL - (currentTime - Number(lastRequestTime))
        }), {
          status: 429,
          headers: { 
            "Content-Type": "application/json",
            "Retry-After": (MINIMUM_REQUEST_INTERVAL - (currentTime - Number(lastRequestTime))).toString()
          },
        })
      }
      
      // Update last request time
      await redis.set(lastRequestTimeKey, currentTime)
      
      // 3. Check cache for existing content summary
      // Create a content hash for lookup (first 100 chars + length is a good balance)
      const contentHash = Buffer.from(content.substring(0, 100) + content.length.toString()).toString('base64')
      const cacheKey = `summary:${contentHash}`
      
      const cachedResult = await redis.get(cacheKey)
      if (cachedResult) {
        console.log("Cache hit for content summary")
        // Increment the request count for rate limiting
        await redis.incr(requestCountKey)
        await redis.expire(requestCountKey, WINDOW_DURATION)
        
        return new NextResponse(cachedResult as string, {
          status: 200,
          headers: { 
            "Content-Type": "application/json",
            "X-Cache": "HIT"
          },
        })
      }
      
      // Increment the request count for rate limiting
      await redis.incr(requestCountKey)
      await redis.expire(requestCountKey, WINDOW_DURATION)
    }

    try {
      // Generate both text summary and graph data using Gemini
      const summary = await generateSummaryWithGemini(content)
      const graphData = await generateConceptMapWithGemini(content)
      
      const responseData = JSON.stringify({ summary, graphData })
      
      // Store in cache if Redis is available
      if (redis) {
        const contentHash = Buffer.from(content.substring(0, 100) + content.length.toString()).toString('base64')
        const cacheKey = `summary:${contentHash}`
        // Cache result for 24 hours
        await redis.set(cacheKey, responseData, { ex: 24 * 60 * 60 })
      }

      return new NextResponse(responseData, {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "X-Cache": "MISS"
        },
      })
    } catch (aiError) {
      console.error("Error calling Gemini API:", aiError)
      
      // Fallback to simulated responses if Gemini fails
      const summary = simulateAISummary(content)
      const graphData = generateKnowledgeGraph(content)
      
      const responseData = JSON.stringify({ 
        summary, 
        graphData,
        notice: "Using simulated analysis due to API error"
      })
      
      return new NextResponse(responseData, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }
  } catch (error) {
    console.error("Error analyzing content:", error)
    return new NextResponse(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

async function generateSummaryWithGemini(content: string): Promise<string> {
  try {
    // First check if we have a valid API key
    if (!process.env.GOOGLE_AI_API_KEY) {
      console.error("Missing Gemini API key - check your environment variables");
      throw new Error("API key not configured properly");
    }

    console.log("Calling Gemini API for summary generation with content length:", content.length);

    const prompt = `Summarize the following content with no fluff or introduction. Start immediately with the key points and main ideas. Focus on clarity, brevity, and core insights only.
    ${content}`;

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Gemini API request timed out")), 20000); // 20 second timeout for both functions
    });

    const apiPromise = geminiModel.generateContent(prompt);
    const result = await Promise.race([apiPromise, timeoutPromise]) as any;
    
    // Add detailed debug logging
    console.log("Gemini API response status:", result?.response ? "Success" : "No response");
    
    if (!result || !result.response) {
      throw new Error("Empty response from Gemini API");
    }
    
    const response = await result.response;
    const text = response?.text();
    
    if (!text) {
      throw new Error("No text in Gemini API response");
    }

    console.log("Gemini API summary generation successful, text length:", text.length);
    
    return text;
  } catch (error) {
    // Detailed error logging
    console.error("Gemini API error:", error);
    if (error instanceof Error) {
      console.error("Error type:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    } else {
      console.error("Unknown error type:", typeof error);
    }
    throw error; // Re-throw so the caller knows there was an error
  }
}

async function generateConceptMapWithGemini(content: string) {
  try {
    // First check if we have a valid API key
    if (!process.env.GOOGLE_AI_API_KEY) {
      console.error("Missing Gemini API key - check your environment variables");
      throw new Error("API key not configured properly");
    }

    const prompt = `
    Analyze the following note content and extract:
    1. Main concepts (5-10 key ideas)
    2. Relationships between concepts
    3. Theme categorization for concepts (technology, business, science, philosophy, personal, health)
    4. Importance level for each concept (1-3, with 3 being most important)
    
    Format your response as a JSON object with exactly this structure:
    {
      "concepts": [
        {
          "id": "concept-1",
          "label": "concept name",
          "theme": "theme name",
          "importance": 2
        },
        ...more concepts
      ],
      "relationships": [
        {
          "source": "concept-1",
          "target": "concept-2", 
          "label": "relationship description"
        },
        ...more relationships
      ]
    }

    Note content to analyze:
    ${content}
    
    Return ONLY the raw JSON with no markdown formatting, code blocks, or additional text.
    `;

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Gemini API request timed out")), 20000); // 20 second timeout for both functions
    });

    const apiPromise = geminiModel.generateContent(prompt);
    const result = await Promise.race([apiPromise, timeoutPromise]) as any;
    
    // Add debug logging
    console.log("Gemini Concept Map API response status:", result?.response ? "Success" : "No response");
    
    if (!result || !result.response) {
      throw new Error("Empty response from Gemini API for concept map");
    }
    
    const response = await result.response;
    let text = response?.text();
    
    if (!text) {
      throw new Error("No text in Gemini API response for concept map");
    }
    
    // Clean up the response text to handle markdown code blocks
    // This is the critical fix - Gemini sometimes returns responses wrapped in markdown code blocks
    console.log("Raw response text preview:", text.substring(0, 60));
    
    // Remove markdown code blocks if present
    if (text.includes("```json")) {
      text = text.replace(/```json\s*/g, "").replace(/\s*```\s*$/g, "");
      console.log("Cleaned markdown code blocks from JSON response");
    }
    
    // Remove any trailing commas which can cause JSON parse errors
    text = text.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
    
    try {
      const parsedData = JSON.parse(text);
      console.log("Successfully parsed JSON with concepts:", parsedData.concepts?.length || 0);
      return parsedData;
    } catch (parseError) {
      console.error("Error parsing concept map JSON:", parseError);
      console.error("Problem text:", text);
      
      // Try one more aggressive cleanup approach
      try {
        // Find anything that looks like a JSON object
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch && jsonMatch[0]) {
          console.log("Attempting to parse extracted JSON object");
          const extractedJson = jsonMatch[0];
          return JSON.parse(extractedJson);
        }
      } catch (secondError) {
        console.error("Second parse attempt also failed");
      }
      
      throw new Error("Invalid JSON in Gemini API response");
    }
  } catch (error) {
    console.error("Error generating concept map with Gemini:", error);
    // Fallback to simulated data
    return generateKnowledgeGraph(content);
  }
}

// Keep the simulation functions as fallbacks
function simulateAISummary(content: string): string {
  // This is a placeholder function that simulates AI analysis
  const contentLength = content.length
  const wordCount = content.split(/\s+/).filter(Boolean).length

  if (contentLength < 50) {
    return "This note is quite brief. Consider adding more details to develop your thoughts further."
  } else if (contentLength < 200) {
    return "This is a short note that covers the basics. You might want to expand on key points to make it more comprehensive."
  } else {
    const topics = ["organization", "productivity", "creativity", "learning", "problem-solving"]
    const randomTopic = topics[Math.floor(Math.random() * topics.length)]

    return `This is a well-developed note with approximately ${wordCount} words. The content appears to focus on ${randomTopic}. Consider organizing your thoughts into sections for better clarity. The main ideas are clear, but you could strengthen your note by adding specific examples or action items.`
  }
}

function generateKnowledgeGraph(content: string) {
  // Extract potential concepts from the content
  const words = content.split(/\s+/).filter(word => word.length > 4);
  
  // Select a subset of words as concepts (to avoid overcrowding)
  const concepts = [...new Set(words)]
    .slice(0, Math.min(10, words.length))
    .map((word, index) => ({
      id: `concept-${index}`,
      label: word.replace(/[^\w\s]/gi, ''),
      theme: getRandomTheme(),
      importance: Math.floor(Math.random() * 3) + 1 // 1-3 importance level
    }));
  
  // Generate relationships between concepts
  const relationships = [];
  for (let i = 0; i < concepts.length; i++) {
    // Connect each concept to 1-3 other concepts
    const numConnections = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < numConnections; j++) {
      const targetIndex = (i + j + 1) % concepts.length;
      relationships.push({
        source: concepts[i].id,
        target: concepts[targetIndex].id,
        label: getRandomRelationship()
      });
    }
  }
  
  return { concepts, relationships };
}

function getRandomTheme() {
  const themes = ['technology', 'business', 'science', 'personal', 'health', 'philosophy'];
  return themes[Math.floor(Math.random() * themes.length)];
}

function getRandomRelationship() {
  const relationships = ['relates to', 'influences', 'depends on', 'part of', 'type of', 'leads to'];
  return relationships[Math.floor(Math.random() * relationships.length)];
}
