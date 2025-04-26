"use client"

import { useEffect, useState, useRef, ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useDebounce } from "@/lib/hooks/use-debounce"
import { useNote, useNotes } from "@/lib/hooks/use-notes"
import { useAIAssistant } from "@/lib/hooks/use-ai-assistant"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ArrowLeft, Loader2, Sparkles, CheckCircle, FileText, X, ImagePlus, Eye, Edit, Info } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { ConceptMap } from "@/components/notes/concept-map"
import { createClient } from "@/lib/supabase/client"
import { isDemoUser } from "@/lib/utils"
import { useAuth } from "@/components/providers/auth-provider"

// Helper function to parse markdown image syntax and render images
function renderMarkdownWithImages(content: string, onDeleteImage?: (src: string, fullMatch: string) => void) {
  const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = imageRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: content.slice(lastIndex, match.index)
      });
    }

    segments.push({
      type: 'image',
      alt: match[1],
      src: match[2],
      fullMatch: match[0] // Store the full match for deletion
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({
      type: 'text',
      content: content.slice(lastIndex)
    });
  }

  return segments;
}

interface NoteEditorProps {
  noteId: string
}

export function NoteEditor({ noteId }: NoteEditorProps) {
  const router = useRouter()
  const supabase = createClient()
  const { note, isLoading } = useNote(noteId)
  const { updateNote } = useNotes()
  const { user } = useAuth() // Get the current user
  const isDemo = isDemoUser(user) // Check if demo user
  const { 
    isAnalyzing, 
    isAutoSummarizing,
    summary, 
    conceptMapData, 
    analyzeNote, 
    autoSummarize,
    resetAnalysis 
  } = useAIAssistant()
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inlineFileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [cursorPosition, setCursorPosition] = useState<number | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const initializedRef = useRef(false)
  const originalTitleRef = useRef("")
  const originalContentRef = useRef("")
  const originalImageUrlRef = useRef<string | null>(null)
  const savingRef = useRef(false)
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [showAISummary, setShowAISummary] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [analysisView, setAnalysisView] = useState<'text' | 'visual'>('text')
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit')

  const debouncedTitle = useDebounce(title, 1000)
  const debouncedContent = useDebounce(content, 1000)

  // Add state to track image URLs that were in the content
  const [previousImageUrls, setPreviousImageUrls] = useState<Set<string>>(new Set());

  // Extract image URLs from content
  const extractImageUrls = (text: string): Set<string> => {
    const imageRegex = /!\[.*?\]\((.*?)\)/g;
    const urls = new Set<string>();
    let match;
    
    while ((match = imageRegex.exec(text)) !== null) {
      if (match[1] && match[1].includes('/note-images/')) {
        urls.add(match[1]);
      }
    }
    
    return urls;
  };

  // Function to explicitly handle image cleanup when content changes
  const cleanupRemovedImages = async (oldUrls: Set<string>, newContent: string) => {
    console.log("Running image cleanup comparison during save");
    const newImageUrls = extractImageUrls(newContent);

    console.log("Images from last save:", Array.from(oldUrls));
    console.log("Images in current content:", Array.from(newImageUrls));

    // Find images that exist in old state but not in new content
    const pathsToDelete: string[] = [];
    const urlsToDelete: string[] = [];
    oldUrls.forEach(url => {
      if (!newImageUrls.has(url)) {
        const urlParts = url.split('/note-images/');
        if (urlParts.length > 1) {
          pathsToDelete.push(urlParts[1]); // Collect the path part
          urlsToDelete.push(url); // Store the full URL for database update
        }
      }
    });

    if (pathsToDelete.length === 0) {
      console.log("No images to clean up");
      return newImageUrls; // Return the current URLs
    }

    console.log("Image paths to clean up:", pathsToDelete);
    console.log("Full image URLs to remove from DB:", urlsToDelete);

    // Check if the main image_url needs to be cleared
    let shouldClearMainImage = false;
    if (note?.image_url && urlsToDelete.includes(note.image_url)) {
      console.log("Main note image URL is being deleted, will clear image_url field");
      shouldClearMainImage = true;
    }

    // Delete the removed images from storage in a single batch call
    try {
      // Add detailed debug logging
      console.log("Deleting images from storage");
      
      // Try an individual delete approach instead of batch
      for (const path of pathsToDelete) {
        console.log(`Attempting to delete image: ${path}`);
        const { data, error } = await supabase.storage
          .from('note-images')
          .remove([path]);
          
        console.log(`Deletion result for ${path}:`, { data, error });
        
        if (error) {
          console.error(`Failed to delete image ${path}:`, error);
        } else {
          console.log(`Successfully deleted image ${path} from storage`);
        }
      }

      // IMPORTANT: Update the database record to reflect image deletion
      if (note && note.id) {
        // If the main image was deleted, we need to update the note record
        if (shouldClearMainImage) {
          console.log("Updating note record to clear main image_url");
          const { error: updateError } = await supabase
            .from('notes')
            .update({ image_url: null })
            .eq('id', note.id);
            
          if (updateError) {
            console.error("Failed to update note record:", updateError);
          } else {
            console.log("Successfully cleared image_url in note record");
            // Update local state
            setImageUrl(null);
          }
        }
        
        // Update the content to ensure any deleted images are removed from the content
        // This is redundant but ensures database consistency
        const { error: contentUpdateError } = await supabase
          .from('notes')
          .update({ 
            content: debouncedContent, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', note.id);
          
        if (contentUpdateError) {
          console.error("Failed to update note content:", contentUpdateError);
        } else {
          console.log("Successfully updated note content to remove image references");
        }
      }

      toast({
        title: "Image cleanup",
        description: `Removed ${pathsToDelete.length} unused ${pathsToDelete.length === 1 ? 'image' : 'images'} from storage`,
        variant: "default",
      });
    } catch (error) {
      console.error(`Error during image deletion:`, error);
      toast({
        title: "Image cleanup error",
        description: "An unexpected error occurred while trying to remove unused images.",
        variant: "destructive",
      });
    }
    
    return newImageUrls; // Return the updated set of URLs
  };

  // After initial content load, store the image URLs
  useEffect(() => {
    if (note && !initializedRef.current) { // Run only once on initial load
      const noteTitle = note.title || ""
      const noteContent = note.content || ""
      const noteImageUrl = note.image_url || null

      setTitle(noteTitle)
      setContent(noteContent)
      setImageUrl(noteImageUrl)

      originalTitleRef.current = noteTitle
      originalContentRef.current = noteContent
      originalImageUrlRef.current = noteImageUrl

      // Initialize previousImageUrls based on the initially loaded content
      const initialUrls = extractImageUrls(noteContent);
      console.log("Setting initial previousImageUrls:", Array.from(initialUrls));
      setPreviousImageUrls(initialUrls);

      initializedRef.current = true
    }
  }, [note]) // Dependency only on note
  
  useEffect(() => {
    if (initializedRef.current) {
      const titleChanged = title !== originalTitleRef.current
      const contentChanged = content !== originalContentRef.current
      const imageChanged = imageUrl !== originalImageUrlRef.current
      setHasUnsavedChanges(titleChanged || contentChanged || imageChanged)
    }
  }, [title, content, imageUrl])

  useEffect(() => {
    if (!initializedRef.current || !note || isAutoSummarizing || !summary) return
    
    const saveSummaryOnly = async () => {
      if (savingRef.current) return
      
      savingRef.current = true
      setIsSaving(true)
      
      try {
        // Fix: Make sure summary is not the string "null"
        const summaryValue = summary === "null" ? null : summary;
        
        const updatedNote = await updateNote.mutateAsync({
          id: noteId,
          summary: summaryValue
        })
        
        setSaveSuccess(true)
        
        
        successTimeoutRef.current = setTimeout(() => {
          setSaveSuccess(false)
          successTimeoutRef.current = null
        }, 2000)
      } catch (error) {
        toast({
          title: "Error saving summary",
          description: "Failed to save the generated summary.",
          variant: "destructive",
        })
      } finally {
        savingRef.current = false
        setIsSaving(false)
      }
    }
    
    saveSummaryOnly()
  }, [summary, note, noteId, updateNote, isAutoSummarizing])

  useEffect(() => {
    if (!initializedRef.current || !note) return;

    const needsSave =
      debouncedTitle !== originalTitleRef.current ||
      debouncedContent !== originalContentRef.current ||
      imageUrl !== originalImageUrlRef.current;

    if (!needsSave) return;
    if (savingRef.current) return;

    const saveChanges = async () => {
      // Don't save if title and content are both empty and there's no main image
      if (!debouncedTitle && !debouncedContent && !imageUrl) return; 

      savingRef.current = true;
      setIsSaving(true);

      try {
        console.log("Starting save process...");
        
        // --- Image Cleanup Logic ---
        console.log("Checking for removed inline images before saving...");
        // Compare current previousImageUrls state with the debounced content
        const updatedImageUrls = await cleanupRemovedImages(previousImageUrls, debouncedContent);
        // Update the state *after* cleanup attempt, before saving the note itself
        setPreviousImageUrls(updatedImageUrls); 
        console.log("Updated previousImageUrls state:", Array.from(updatedImageUrls));
        // --- End Image Cleanup Logic ---

        console.log("Saving note data with ID:", noteId);
        const updatedNote = await updateNote.mutateAsync({
          id: noteId,
          title: debouncedTitle,
          content: debouncedContent,
          summary: summary, // Include summary if available
          image_url: imageUrl
        });

        console.log("Note successfully saved. Updating refs...");
        originalTitleRef.current = updatedNote.title || "";
        originalContentRef.current = updatedNote.content || "";
        originalImageUrlRef.current = updatedNote.image_url || null;

        setHasUnsavedChanges(false);
        setSaveSuccess(true);

        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current);
        }

        successTimeoutRef.current = setTimeout(() => {
          setSaveSuccess(false);
          successTimeoutRef.current = null;
        }, 2000);

      } catch (error) {
        console.error("Error during save process:", error);
        toast({
          title: "Failed to save",
          description: error instanceof Error ? error.message : "An unexpected error occurred",
          variant: "destructive",
        });
      } finally {
        console.log("Save operation completed.");
        savingRef.current = false;
        setIsSaving(false);
      }
    };

    // Debounce the save operation
    const saveTimeoutId = setTimeout(saveChanges, 1000); // Use the debounce delay

    return () => {
      clearTimeout(saveTimeoutId);
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
    // Ensure previousImageUrls is included in dependencies if cleanup relies on it
  }, [debouncedTitle, debouncedContent, imageUrl, noteId, updateNote, summary, note, previousImageUrls]); 

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      console.log("No file selected.");
      return;
    }
    if (!note) {
      console.log("Note object is not available.");
      return;
    }
    
    console.log("Starting image upload for note ID:", note.id);
    setIsUploading(true)
    const fileExt = file.name.split('.').pop()
    const filePath = `${note.user_id}/${note.id}-${Date.now()}.${fileExt}`

    try {
      // Step 1: Upload the file to Supabase Storage
      console.log("Uploading file to path:", filePath);
      const { error: uploadError } = await supabase.storage
        .from('note-images')
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      // Step 2: Get the public URL
      console.log("Getting public URL for uploaded file");
      const { data } = supabase.storage
        .from('note-images')
        .getPublicUrl(filePath)

      if (!data?.publicUrl) {
        throw new Error("Could not get public URL for uploaded image.")
      }

      console.log("Image uploaded successfully. Public URL:", data.publicUrl);

      // Step 3: Update the local state
      setImageUrl(data.publicUrl);
      
      // Step 4: CRITICAL - Update the database record with a direct SQL update
      console.log("Updating database record with image_url:", data.publicUrl);
      const { error: updateError } = await supabase
        .from('notes')
        .update({ 
          image_url: data.publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', note.id);

      if (updateError) {
        console.error("Database update error:", updateError);
        throw new Error(`Failed to update database record: ${updateError.message}`);
      }
      
      console.log("Database record updated successfully");
      originalImageUrlRef.current = data.publicUrl;
      
      toast({
        title: "Image uploaded",
        description: "Image has been added to your note.",
        variant: "default",
      });
    } catch (error) {
      console.error("Image upload process failed:", error);
      toast({
        title: "Image upload failed",
        description: error instanceof Error ? error.message : "Could not upload image.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleRemoveImage = async () => {
    if (!imageUrl || !note) {
      console.log("Cannot remove image: no image URL or note object");
      return;
    }

    try {
      console.log("Starting image removal process for URL:", imageUrl);
      
      // Step 1: Clear the database record FIRST to ensure data consistency
      console.log("Updating database to clear image_url for note ID:", note.id);
      const { error: updateError } = await supabase
        .from('notes')
        .update({ 
          image_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', note.id);
        
      if (updateError) {
        console.error("Database update error:", updateError);
        throw new Error(`Failed to update database record: ${updateError.message}`);
      }
      
      console.log("Database record updated successfully");
      
      // Step 2: Now remove the file from storage
      const urlParts = imageUrl.split('/note-images/');
      if (urlParts.length > 1) {
        const imagePath = urlParts[1];
        console.log("Removing file from storage with path:", imagePath);
        
        // Use RPC call for reliable deletion
        const { error: removeError } = await supabase.storage
          .from('note-images')
          .remove([imagePath]);
        
        if (removeError) {
          console.error("Storage removal error:", removeError);
          toast({
            title: "Storage cleanup issue",
            description: "The image was removed from your note, but the file may remain in storage.",
            variant: "warning",
          });
        } else {
          console.log("Successfully removed image from storage");
        }
      }

      // Step 3: Update local state
      setImageUrl(null);
      originalImageUrlRef.current = null;
      
      toast({
        title: "Image removed",
        description: "The image has been removed from your note.",
        variant: "default",
      });
    } catch (error) {
      console.error("Complete error during image removal:", error);
      toast({
        title: "Error removing image",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
        variant: "destructive",
      });
    }
  }

  const handleAnalyze = () => {
    analyzeNote(content);
    autoSummarize(content, noteId);
    setShowAISummary(true);
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent); // Just update the content state

    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  };

  const handleTextareaSelect = () => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  };

  const handleInlineImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !note) return;

    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${note.user_id}/${note.id}-${Date.now()}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('note-images')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('note-images')
        .getPublicUrl(filePath);

      if (!data?.publicUrl) {
        throw new Error("Could not get public URL for uploaded image.");
      }

      if (cursorPosition !== null && textareaRef.current) {
        const imageMarkdown = `\n![${file.name}](${data.publicUrl})\n`;
        const newContent = 
          content.substring(0, cursorPosition) + 
          imageMarkdown + 
          content.substring(cursorPosition);
        
        setContent(newContent);
        
        const newPosition = cursorPosition + imageMarkdown.length;
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(newPosition, newPosition);
            setCursorPosition(newPosition);
          }
        }, 0);
      } else {
        const imageMarkdown = `\n![${file.name}](${data.publicUrl})\n`;
        setContent(content + imageMarkdown);
      }

      toast({
        title: "Image uploaded",
        description: "Image has been inserted into your note.",
        variant: "default",
      });
      
    } catch (error) {
      toast({
        title: "Image upload failed",
        description: error instanceof Error ? error.message : "Could not upload image.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (inlineFileInputRef.current) {
        inlineFileInputRef.current.value = "";
      }
    }
  };

  // Function to handle deleting an inline image
  const handleDeleteInlineImage = async (src: string, fullMatch: string) => {
    try {
      // 1. First remove the image from Supabase Storage
      const urlParts = src.split('/note-images/');
      if (urlParts.length > 1) {
        const imagePath = urlParts[1];
        console.log("Attempting to delete image from storage:", imagePath);
        
        const { error: removeError } = await supabase.storage
          .from('note-images')
          .remove([imagePath]);
        
        if (removeError) {
          console.error("Error removing image from storage:", removeError);
          toast({
            title: "Storage cleanup warning",
            description: "Could not remove the image file from storage, but it was removed from your note.",
            variant: "warning",
          });
        } else {
          console.log("Successfully deleted image from storage");
        }
      }
      
      // 2. Remove the image markdown from the content
      const newContent = content.replace(fullMatch, '');
      setContent(newContent);
      
      toast({
        title: "Image deleted",
        description: "The image has been removed from your note.",
        variant: "default",
      });
    } catch (error) {
      console.error("Error handling image deletion:", error);
      toast({
        title: "Error",
        description: "Failed to delete the image. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {isDemo && (
        <div className="bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200 px-4 py-2">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            <p className="text-sm font-medium">Demo Mode: Note editing is view-only</p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 border-b p-4">
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
            readOnly={isDemo}
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
        <div className="flex items-center gap-2">
          {!isDemo && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || !!imageUrl}
                title={imageUrl ? "Remove image first to upload another" : "Upload Image"}
              >
                {isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ImagePlus className="h-5 w-5" />
                )}
              </Button>
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={isUploading}
              />
            </>
          )}
          {!isDemo && (
            <Button onClick={handleAnalyze} disabled={isAnalyzing || !content.trim()}>
              <Sparkles className="mr-2 h-4 w-4" />
              AI Summarize
            </Button>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div>
          <label htmlFor="note-title" className="sr-only">Title</label>
          <Input
            id="note-title"
            placeholder="Note Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-bold border-none shadow-none focus-visible:ring-0 px-0"
            readOnly={isDemo}
          />
        </div>

        {imageUrl && (
          <div className="relative group w-full max-w-xl mx-auto my-4 aspect-video bg-muted/30 rounded-md overflow-hidden">
            <Image
              src={imageUrl}
              alt="Note image"
              layout="fill"
              objectFit="contain"
              className="block"
              onError={(e) => {
                console.error("Failed to load image:", imageUrl, e)
                toast({ title: "Failed to load image", description: "The image URL might be invalid or inaccessible.", variant: "warning" })
              }}
              unoptimized
            />
            {!isDemo && (
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 z-10"
                onClick={handleRemoveImage}
                title="Remove Image"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'edit' | 'preview')} className="w-full">
          <div className="flex justify-end mb-2">
            <TabsList>
              {!isDemo && (
                <TabsTrigger value="edit" className="flex items-center gap-1">
                  <Edit className="h-4 w-4" />
                  <span>Edit</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="preview" className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>Preview</span>
              </TabsTrigger>
            </TabsList>
          </div>
          
          {!isDemo && (
            <TabsContent value="edit" className="relative mt-0">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10 opacity-70 hover:opacity-100"
                onClick={() => inlineFileInputRef.current?.click()}
                disabled={isUploading}
                title="Insert image at cursor position"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
              </Button>
              
              <Input
                ref={inlineFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleInlineImageUpload}
                className="hidden"
                disabled={isUploading}
              />
              
              <label htmlFor="note-content" className="sr-only">Content</label>
              <Textarea
                id="note-content"
                ref={textareaRef}
                placeholder="Start writing your note..."
                value={content}
                onChange={handleTextareaChange}
                onClick={handleTextareaSelect}
                onKeyUp={handleTextareaSelect}
                onFocus={handleTextareaSelect}
                className="min-h-[300px] border-none shadow-none focus-visible:ring-0 px-0 resize-none pr-10"
                readOnly={isDemo}
              />
            </TabsContent>
          )}
          
          <TabsContent value="preview" className="mt-0">
            <div className="prose prose-sm dark:prose-invert max-w-none min-h-[300px] p-4 border rounded-md bg-background">
              {renderMarkdownWithImages(content, !isDemo ? handleDeleteInlineImage : undefined).map((segment, index) => {
                if (segment.type === 'text') {
                  return segment.content.split('\n').map((paragraph, pIndex) => (
                    <p key={`${index}-${pIndex}`} className="my-2">
                      {paragraph || <br />}
                    </p>
                  ));
                } else {
                  return (
                    <div key={index} className="my-4 relative aspect-auto max-w-full group">
                      <img
                        src={segment.src}
                        alt={segment.alt}
                        className="rounded-md max-w-full max-h-[300px] object-contain"
                      />
                      {!isDemo && (
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 z-10"
                          onClick={() => handleDeleteInlineImage(segment.src, segment.fullMatch)}
                          title="Delete Image"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                }
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Sheet open={showAISummary} onOpenChange={setShowAISummary}>
        <SheetContent className="sm:max-w-md md:max-w-xl">
          <SheetHeader>
            <SheetTitle>AI Analysis</SheetTitle>
            <SheetDescription>See your note summarized and visualized</SheetDescription>
          </SheetHeader>
          
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
  )
}
