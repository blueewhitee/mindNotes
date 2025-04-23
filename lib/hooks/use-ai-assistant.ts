"use client"

import { useState } from "react"
import { toast } from "@/components/ui/use-toast"
import { ConceptMapData } from "@/components/notes/concept-map"

export function useAIAssistant() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [conceptMapData, setConceptMapData] = useState<ConceptMapData | null>(null)

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

      const data = await response.json()
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

  const resetAnalysis = () => {
    setSummary(null)
    setConceptMapData(null)
  }

  return {
    isAnalyzing,
    summary,
    conceptMapData,
    analyzeNote,
    resetAnalysis,
    resetSummary: () => setSummary(null),
  }
}
