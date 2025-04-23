"use client"

import { useState } from "react"
import { toast } from "@/components/ui/use-toast"

export function useAIAssistant() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)

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

  return {
    isAnalyzing,
    summary,
    analyzeNote,
    resetSummary: () => setSummary(null),
  }
}
