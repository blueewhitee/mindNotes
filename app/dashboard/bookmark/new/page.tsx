"use client"

import { useRouter } from "next/navigation"
import { BookmarkForm } from "@/components/bookmarks/bookmark-form"

export default function NewBookmarkPage() {
  const router = useRouter()
  
  const handleOutsideClick = () => {
    router.push("/dashboard/bookmarks")
  }

  return (
    <>
      {/* Full-screen overlay that handles clicks outside the form */}
      <div 
        className="fixed inset-0 bg-black/30 z-10" 
        onClick={handleOutsideClick}
      />
      
      {/* Form container with higher z-index to appear above the overlay */}
      <div 
        className="container mx-auto max-w-2xl py-6 relative z-20"
        onClick={(e) => e.stopPropagation()} // Prevent clicks on the form from bubbling to the overlay
      >
        <BookmarkForm />
      </div>
    </>
  )
}