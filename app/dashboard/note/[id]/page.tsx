"use client"

import { NoteEditor } from "@/components/notes/note-editor"
import { use } from "react"

export default function NotePage({ params }: { params: { id: string } }) {
  const unwrappedParams = use(params)
  return <NoteEditor noteId={unwrappedParams.id} />
}
