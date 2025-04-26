"use client"

import { NoteEditor } from "@/components/notes/note-editor"
import { useParams, useRouter } from "next/navigation" // Import useParams and useRouter

export default function NotePage() { // Remove params from props
  const params = useParams() // Use useParams hook
  const router = useRouter() // Get router instance
  const noteId = params.id as string // Get id from params

  const handleOutsideClick = () => {
    router.push("/dashboard") // Navigate back to the main dashboard or notes view
  }

  // Add a check for noteId in case params are not ready yet
  if (!noteId) {
    // Optionally return a loading state or null
    return null; 
  }

  return (
    <>
      {/* Full-screen overlay that handles clicks outside the editor */}
      <div 
        className="fixed inset-0 bg-black/30 z-10" 
        onClick={handleOutsideClick}
      />
      
      {/* Editor container with higher z-index */}
      <div 
        className="container mx-auto max-w-4xl py-6 relative z-20" // Adjusted max-width for editor
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing
      >
        <NoteEditor noteId={noteId} />
      </div>
    </>
  )
}
