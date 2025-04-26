"use client"

import { useState } from "react"
import { DashboardHeader } from "@/components/layout/dashboard-header"
import { BookmarkGrid } from "@/components/bookmarks/bookmark-grid"
import { FolderTree } from "@/components/bookmarks/folder-tree"
import { Separator } from "@/components/ui/separator"

export default function BookmarksPage() {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  
  return (
    <main className="container flex-1 py-6">
      <DashboardHeader />
      
      <div className="mt-6 grid grid-cols-1 md:grid-cols-[250px_1fr] gap-6">
        <div className="border rounded-lg p-4">
          <FolderTree 
            selectedFolderId={selectedFolderId} 
            onSelectFolder={setSelectedFolderId} 
          />
        </div>
        
        <div>
          <BookmarkGrid folderId={selectedFolderId} />
        </div>
      </div>
    </main>
  )
}