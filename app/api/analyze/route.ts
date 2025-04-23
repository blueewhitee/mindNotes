import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import Groq from "groq-sdk"
import { Redis } from "@upstash/redis"

// Initialize Groq client with your API key
const groq = new Groq({ 
  apiKey: process.env.GROQ_API_KEY 
})

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
      // Generate both text summary and graph data using Groq
      const summary = await generateSummaryWithGroq(content)
      const graphData = await generateConceptMapWithGroq(content)
      
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
      console.error("Error calling Groq API:", aiError)
      
      // Fallback to simulated responses if Groq fails
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

async function generateSummaryWithGroq(content: string): Promise<string> {
  const response = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are an expert note analyzer and assistant. Your tasks are to: 1) Process any user input regardless of length, 2) Extract key information from the note, 3) Respond helpfully to any questions contained in the note, and 4) If appropriate, provide a summary or analysis. For short lists or brief requests, focus on being helpful rather than requesting more information."
      },
      {
        role: "user",
        content: `Please analyze and summarize the following note content:\n\n${content}`
      }
    ],
    model: "llama3-8b-8192",
    temperature: 0.5,
    max_tokens: 500,
  })

  return response.choices[0].message.content || "Unable to generate summary."
}

async function generateConceptMapWithGroq(content: string) {
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
  
  Only respond with valid JSON. No explanations or additional text.
  `;

  const response = await groq.chat.completions.create({
    messages: [
      { role: "user", content: prompt }
    ],
    model: "llama3-8b-8192",
    temperature: 0.2,
    max_tokens: 1500,
    response_format: { type: "json_object" }
  });
  
  try {
    const responseText = response.choices[0].message.content || "";
    return JSON.parse(responseText);
  } catch (error) {
    console.error("Error parsing concept map JSON:", error);
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
