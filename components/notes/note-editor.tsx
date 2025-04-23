"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useDebounce } from "@/lib/hooks/use-debounce"
import { useNote, useNotes } from "@/lib/hooks/use-notes"
import { useAIAssistant } from "@/lib/hooks/use-ai-assistant"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ArrowLeft, Loader2, Sparkles, CheckCircle, FileText } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { ConceptMap } from "@/components/notes/concept-map"

interface NoteEditorProps {
  noteId: string
}

export function NoteEditor({ noteId }: NoteEditorProps) {
  const router = useRouter()
  const { note, isLoading } = useNote(noteId)
  const { updateNote } = useNotes()
  const { 
    isAnalyzing, 
    isAutoSummarizing,
    summary, 
    conceptMapData, 
    analyzeNote, 
    autoSummarize,
    resetAnalysis 
  } = useAIAssistant()
  
  // Analysis view mode (text or visual)
  const [analysisView, setAnalysisView] = useState<'text' | 'visual'>('text')
  
  // Use refs to track internal state that shouldn't trigger re-renders
  const initializedRef = useRef(false)
  const originalTitleRef = useRef("")
  const originalContentRef = useRef("")
  const savingRef = useRef(false)
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // State for UI updates
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [showAISummary, setShowAISummary] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const debouncedTitle = useDebounce(title, 1000)
  const debouncedContent = useDebounce(content, 1000)
  
  // Initialize note content once when note data is available
  useEffect(() => {
    if (note && !initializedRef.current) {
      const noteTitle = note.title || "";
      const noteContent = note.content || "";
      
      setTitle(noteTitle);
      setContent(noteContent);
      
      // Store original values in refs
      originalTitleRef.current = noteTitle;
      originalContentRef.current = noteContent;
      
      initializedRef.current = true;
    }
  }, [note]);
  
  // Track unsaved changes separately from the save logic
  useEffect(() => {
    if (initializedRef.current) {
      const titleChanged = title !== originalTitleRef.current;
      const contentChanged = content !== originalContentRef.current;
      setHasUnsavedChanges(titleChanged || contentChanged);
    }
  }, [title, content]);

  // Automatically start summarizing when content changes
  useEffect(() => {
    // Only run auto-summarize if we have significant content
    if (content && content.trim().length > 50) {
      console.log("Auto-summarizing content:", content.substring(0, 30) + "...");
      autoSummarize(content, noteId); // Pass the noteId parameter to fix the UUID error
    }
  }, [content, autoSummarize, noteId]);

  // Watch for summary changes and immediately save them
  useEffect(() => {
    // Don't trigger on initial load or when summarizing
    if (!initializedRef.current || !note || isAutoSummarizing || !summary) return;
    
    console.log("Summary changed, triggering immediate save:", summary ? summary.substring(0, 30) + "..." : "null");
    
    const saveSummaryOnly = async () => {
      // If already saving, don't try to save again
      if (savingRef.current) {
        console.log("Already saving, will skip duplicate summary save");
        return;
      }
      
      // Use refs to track saving state
      savingRef.current = true;
      setIsSaving(true);
      
      try {
        console.log("Saving summary immediately to database");
        const updatedNote = await updateNote.mutateAsync({
          id: noteId,
          summary: summary
        });
        
        console.log("Summary saved result:", updatedNote.id, "Has summary:", !!updatedNote.summary);
        
        // Show success indicator
        setSaveSuccess(true);
        
        // Clear any existing timeout
        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current);
        }
        
        // Set timeout to hide success message
        successTimeoutRef.current = setTimeout(() => {
          setSaveSuccess(false);
          successTimeoutRef.current = null;
        }, 2000);
      } catch (error) {
        console.error("Error saving summary:", error);
        toast({
          title: "Error saving summary",
          description: "Failed to save the generated summary.",
          variant: "destructive",
        });
      } finally {
        savingRef.current = false;
        setIsSaving(false);
      }
    };
    
    saveSummaryOnly();
  }, [summary, note, noteId, updateNote, isAutoSummarizing]);

  // Handle debounced content saving
  useEffect(() => {
    // Skip if component isn't initialized yet
    if (!initializedRef.current || !note) return;
    
    // Skip if debounced values match original (nothing to save)
    if (debouncedTitle === originalTitleRef.current && 
        debouncedContent === originalContentRef.current) {
      return;
    }
    
    // Skip if already saving
    if (savingRef.current) return;
    
    const saveChanges = async () => {
      // Validate content length if needed
      if (debouncedContent && debouncedContent.length > 50000) {
        toast({
          title: "Content too large",
          description: "Your note is too large. Please reduce the content size.",
          variant: "destructive",
        });
        return;
      }

      // Use refs to track saving state
      savingRef.current = true;
      setIsSaving(true);
      
      try {
        // Log the summary being saved for debugging
        console.log("Saving note with summary:", summary ? summary.substring(0, 30) + "..." : "null");
        
        // Include the current summary in the note update if available
        const updatedNote = await updateNote.mutateAsync({
          id: noteId,
          title: debouncedTitle,
          content: debouncedContent,
          summary: summary // Include the AI-generated summary
        });
        
        console.log("Note updated result:", updatedNote.id, "Has summary:", !!updatedNote.summary);
        
        // Update original values using refs
        originalTitleRef.current = updatedNote.title || "";
        originalContentRef.current = updatedNote.content || "";
        
        // Show success indicator without triggering dependency updates
        setHasUnsavedChanges(false);
        setSaveSuccess(true);
        
        // Clear any existing timeout
        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current);
        }
        
        // Set timeout to hide success message
        successTimeoutRef.current = setTimeout(() => {
          setSaveSuccess(false);
          successTimeoutRef.current = null;
        }, 2000);
      } catch (error) {
        toast({
          title: "Failed to save",
          description: error instanceof Error ? error.message : "An unexpected error occurred",
          variant: "destructive",
        });
        console.error("Error saving note:", error);
      } finally {
        savingRef.current = false;
        setIsSaving(false);
      }
    };

    saveChanges();
    
    // Clean up on unmount
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, [debouncedTitle, debouncedContent, noteId, updateNote, summary]);

  const handleAnalyze = () => {
    analyzeNote(content);
    setShowAISummary(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b p-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back to notes</span>
        </Button>
        <div className="flex flex-1 items-center gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title"
            className="h-auto border-none text-lg font-medium shadow-none focus-visible:ring-0"
          />
          {isSaving && (
            <div className="flex items-center text-xs text-muted-foreground">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Saving...
            </div>
          )}
          {isAutoSummarizing && !isSaving && (
            <div className="flex items-center text-xs text-blue-500">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Summarizing...
            </div>
          )}
          {saveSuccess && !isSaving && !isAutoSummarizing && (
            <div className="flex items-center text-xs text-green-500">
              <CheckCircle className="mr-1 h-3 w-3" />
              Saved
            </div>
          )}
          {summary && !isAutoSummarizing && !isSaving && !saveSuccess && (
            <div className="flex items-center text-xs text-blue-500">
              <FileText className="mr-1 h-3 w-3" />
              Summary Ready
            </div>
          )}
        </div>
        <Button onClick={handleAnalyze} disabled={isAnalyzing || !content.trim()}>
          <Sparkles className="mr-2 h-4 w-4" />
          AI Summarize
        </Button>
      </div>
      
      {/* Rest of the component remains the same */}
      <div className="flex-1 overflow-auto p-4">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start writing your note..."
          className="min-h-[calc(100vh-12rem)] resize-none border-none shadow-none focus-visible:ring-0"
        />
        {hasUnsavedChanges && (
          <div className="mt-2 text-xs text-amber-500">
            Unsaved changes will be saved automatically...
          </div>
        )}
      </div>

      <Sheet open={showAISummary} onOpenChange={setShowAISummary}>
        <SheetContent className="sm:max-w-md md:max-w-xl">
          <SheetHeader>
            <SheetTitle>AI Analysis</SheetTitle>
            <SheetDescription>See your note summarized and visualized</SheetDescription>
          </SheetHeader>
          
          {/* View selector tabs */}
          <div className="mt-4 flex space-x-2">
            <Button 
              variant={analysisView === 'text' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAnalysisView('text')}
            >
              Text Summary
            </Button>
            <Button 
              variant={analysisView === 'visual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAnalysisView('visual')}
            >
              Concept Map
            </Button>
          </div>
          
          <div className="mt-6">
            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-2 text-sm text-muted-foreground">Analyzing your note...</p>
              </div>
            ) : analysisView === 'text' ? (
              summary ? (
                <div className="prose dark:prose-invert">
                  <h3>Summary</h3>
                  <p>{summary}</p>
                </div>
              ) : (
                <p className="text-muted-foreground">Click the "AI Analyze" button to get insights about your note.</p>
              )
            ) : (
              <div>
                <h3 className="mb-4 text-lg font-medium">Knowledge Graph</h3>
                {conceptMapData ? (
                  <div className="rounded-md bg-background">
                    <ConceptMap data={conceptMapData} />
                  </div>
                ) : (
                  <p className="text-muted-foreground">No concept data available. Try analyzing your note first.</p>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  This visual map shows the key concepts in your note and how they relate to each other.
                  Colors represent different themes, and larger nodes indicate more important concepts.
                </p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
