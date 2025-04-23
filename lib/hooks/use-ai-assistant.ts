"use client"

import { useState, useCallback, useRef } from "react"
import { toast } from "@/components/ui/use-toast"
import { ConceptMapData } from "@/components/notes/concept-map"
import { createClient } from "@/lib/supabase/client"

export function useAIAssistant() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [conceptMapData, setConceptMapData] = useState<ConceptMapData | null>(null)
  const [isAutoSummarizing, setIsAutoSummarizing] = useState(false)
  const autoSummaryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Helper function to make the API call
  const fetchAnalysis = async (content: string): Promise<{summary: string, graphData?: ConceptMapData}> => {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    })

    if (!response.ok) {
      throw new Error("Failed to analyze note")
    }

    return await response.json()
  }

  // For manual analysis (complete analysis with concepts)
  const analyzeNote = async (content: string) => {
    if (!content.trim()) {
      toast({
        title: "Empty note",
        description: "Please add some content to your note before analyzing.",
        variant: "destructive",
      })
      return
    }

    setIsAnalyzing(true)
    setSummary(null)
    setConceptMapData(null)

    try {
      const data = await fetchAnalysis(content)
      setSummary(data.summary)
      
      // Set concept map data if available
      if (data.graphData) {
        setConceptMapData(data.graphData)
      }
    } catch (error) {
      console.error("Error analyzing note:", error)
      toast({
        title: "Analysis failed",
        description: "Failed to analyze your note. Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Automatic summarization with debouncing
  const autoSummarize = useCallback((content: string, noteId: string) => {
    // Clear any existing timeout
    if (autoSummaryTimeoutRef.current) {
      clearTimeout(autoSummaryTimeoutRef.current)
    }

    // Check for minimum content length (at least 50 characters to summarize)
    if (!content || content.trim().length < 50) {
      console.log("Not auto-summarizing: content too short", content?.length || 0)
      return
    }

    console.log("Setting up auto-summarize with debounce, content length:", content.length)

    // Set a new timeout (debounce for 2 seconds)
    autoSummaryTimeoutRef.current = setTimeout(async () => {
      // Only proceed if we have enough content
      setIsAutoSummarizing(true)
      console.log("Auto-summarizing now after debounce")
      
      try {
        const data = await fetchAnalysis(content)
        console.log("Auto-summary received from API:", data.summary ? data.summary.substring(0, 50) + "..." : "null")
        
        // Set the summary state - the note-editor component will handle saving
        setSummary(data.summary)
        
        // IMPORTANT: Removed the direct Supabase call here to avoid race conditions
        // The summary is now only saved in one place - through the note-editor's
        // useEffect hook that watches for summary changes
        
      } catch (error) {
        console.error("Error auto-summarizing note:", error)
        // Don't show a toast for auto-summarization failures
      } finally {
        setIsAutoSummarizing(false)
        autoSummaryTimeoutRef.current = null
      }
    }, 2000) // 2 second debounce
  }, [])

  const resetAnalysis = () => {
    setSummary(null)
    setConceptMapData(null)
  }

  return {
    isAnalyzing,
    isAutoSummarizing,
    summary,
    conceptMapData,
    analyzeNote,
    autoSummarize,
    resetAnalysis,
    resetSummary: () => setSummary(null),
  }
}
