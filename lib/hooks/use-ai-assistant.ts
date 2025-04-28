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
  const [wasTruncated, setWasTruncated] = useState(false)
  const autoSummaryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Helper function to make the API call
  const fetchAnalysis = async (content: string): Promise<{
    summary: string, 
    graphData?: ConceptMapData,
    wasTruncated?: boolean,
    originalLength?: number,
    analyzedLength?: number
  }> => {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    })

    if (response.status === 413) {
      // Handle "Content Too Large" error gracefully
      throw new Error("Content too large for analysis. Try analyzing a smaller section of your note.")
    }

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
    setWasTruncated(false)

    try {
      const data = await fetchAnalysis(content)
      setSummary(data.summary)
      
      // Set concept map data if available
      if (data.graphData) {
        setConceptMapData(data.graphData)
      }

      // Handle truncated content
      if (data.wasTruncated) {
        setWasTruncated(true)
        toast({
          title: "Note partially analyzed",
          description: `Your note was too long (${data.originalLength} characters). Only the first ${data.analyzedLength} characters were analyzed.`,
          variant: "warning",
          duration: 5000,
        })
      }
    } catch (error) {
      console.error("Error analyzing note:", error)
      toast({
        title: "Analysis failed",
        description: error instanceof Error ? error.message : "Failed to analyze your note. Please try again later.",
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

    // Don't attempt auto-summarize for very large content
    if (content.length > 50000) {
      console.log("Content too large for auto-summarization:", content.length)
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
        
        // Handle truncated content silently (no toast for auto-summarize)
        if (data.wasTruncated) {
          setWasTruncated(true)
          console.log(`Note truncated for analysis. Original: ${data.originalLength}, Analyzed: ${data.analyzedLength}`)
        }
        
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
    setWasTruncated(false)
  }

  return {
    isAnalyzing,
    isAutoSummarizing,
    summary,
    conceptMapData,
    wasTruncated,
    analyzeNote,
    autoSummarize,
    resetAnalysis,
    resetSummary: () => setSummary(null),
  }
}
