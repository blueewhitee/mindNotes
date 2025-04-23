"use client"

import { useNotes } from "@/lib/hooks/use-notes"
import { DashboardHeader } from "@/components/layout/dashboard-header"
import { NoteGrid } from "@/components/notes/note-grid"
import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardPage() {
  const { notes, isLoading } = useNotes()

  return (
    <main className="container flex-1 py-6">
      <DashboardHeader />
      <div className="mt-8">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[200px] rounded-xl" />
            ))}
          </div>
        ) : (
          <NoteGrid notes={notes} />
        )}
      </div>
    </main>
  )
}
