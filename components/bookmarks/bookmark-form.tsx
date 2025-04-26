"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Star, FolderClosed, ExternalLink, Save, X } from "lucide-react"
import { useBookmarks, BookmarkInsert } from "@/lib/hooks/use-bookmarks"
import { useBookmarkFolders } from "@/lib/hooks/use-bookmark-folders"
import { toast } from "@/components/ui/use-toast"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

const bookmarkFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  url: z.string().url("Please enter a valid URL"),
  description: z.string().optional(),
  is_favorite: z.boolean().default(false),
  tags: z.string().optional(),
  folder_id: z.string().nullable().optional(),
})

type BookmarkFormValues = z.infer<typeof bookmarkFormSchema>

interface BookmarkFormProps {
  initialData?: {
    id: string
    title: string
    url: string
    description?: string
    is_favorite?: boolean
    tags?: string[]
    folder_id?: string | null
  }
  isEdit?: boolean
  asModal?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSuccess?: () => void
}

export function BookmarkForm({ 
  initialData, 
  isEdit = false, 
  asModal = false,
  open = false,
  onOpenChange,
  onSuccess
}: BookmarkFormProps) {
  const router = useRouter()
  const { createBookmark, updateBookmark } = useBookmarks()
  const { folders } = useBookmarkFolders()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [currentTags, setCurrentTags] = useState<string[]>(initialData?.tags || [])
  const [tagInput, setTagInput] = useState("")

  // This effect helps prevent hydration errors by making sure the component
  // only renders fully on the client
  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (initialData?.tags) {
      setCurrentTags(initialData.tags)
      setTagInput("")
    }
  }, [initialData?.tags])

  const form = useForm<BookmarkFormValues>({
    resolver: zodResolver(bookmarkFormSchema),
    defaultValues: {
      title: initialData?.title || "",
      url: initialData?.url || "",
      description: initialData?.description || "",
      is_favorite: initialData?.is_favorite || false,
      tags: initialData?.tags?.join(", ") || "",
      folder_id: initialData?.folder_id || null,
    },
  })

  const addTag = () => {
    if (tagInput.trim()) {
      const newTag = tagInput.trim()
      if (!currentTags.includes(newTag)) {
        const newTags = [...currentTags, newTag]
        setCurrentTags(newTags)
        form.setValue("tags", newTags.join(", "))
      }
      setTagInput("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    const newTags = currentTags.filter(tag => tag !== tagToRemove)
    setCurrentTags(newTags)
    form.setValue("tags", newTags.join(", "))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput) {
      e.preventDefault()
      addTag()
    }
  }

  const onSubmit = async (values: BookmarkFormValues) => {
    setIsSubmitting(true)

    try {
      // Use the current tags state instead of parsing the input
      const bookmarkData: BookmarkInsert = {
        title: values.title,
        url: values.url,
        description: values.description || undefined,
        is_favorite: values.is_favorite,
        tags: currentTags.length > 0 ? currentTags : undefined,
        folder_id: values.folder_id === "root" ? null : values.folder_id || null,
      }

      if (isEdit && initialData?.id) {
        await updateBookmark.mutateAsync({
          id: initialData.id,
          ...bookmarkData,
        })
        toast({
          title: "Bookmark updated",
          description: "Your bookmark has been updated successfully",
        })
      } else {
        await createBookmark.mutateAsync(bookmarkData)
        toast({
          title: "Bookmark created",
          description: "Your bookmark has been created successfully",
        })
      }
      
      // If in modal mode, close the modal and call onSuccess
      if (asModal) {
        if (onOpenChange) onOpenChange(false)
        if (onSuccess) onSuccess()
        form.reset() // Reset the form for next use
      } else {
        // Navigate back to bookmarks page
        router.push("/dashboard/bookmarks")
      }
    } catch (error) {
      console.error("Error saving bookmark:", error)
      toast({
        title: `Error ${isEdit ? "updating" : "creating"} bookmark`,
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Convert null to "root" for the select component
  const folderIdValue = form.watch("folder_id") === null ? "root" : form.watch("folder_id") || "root"
  const selectedFolderName = folders.find(f => f.id === form.watch("folder_id"))?.name || null

  // Check if URL is valid for preview
  const url = form.watch("url")
  const isUrlValid = url && z.string().url().safeParse(url).success

  // If not mounted yet, return null or a simple loading indicator
  if (!isMounted) {
    return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input 
                      placeholder="Bookmark Title" 
                      {...field} 
                      className="text-xl font-medium border-none px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input 
                      placeholder="https://example.com" 
                      {...field} 
                      className="text-blue-500 border-none px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex flex-wrap gap-2 mt-2">
              {currentTags.map((tag, index) => (
                <Badge key={index} variant="outline" className="flex items-center gap-1">
                  {tag}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => removeTag(tag)}
                  />
                </Badge>
              ))}
              {selectedFolderName && (
                <Badge variant="secondary">
                  <FolderClosed className="mr-1 h-3 w-3" />
                  {selectedFolderName}
                </Badge>
              )}
              {form.watch("is_favorite") && (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                  <Star className="mr-1 h-3 w-3 fill-yellow-500 text-yellow-500" />
                  Favorite
                </Badge>
              )}
            </div>

            <div className="flex gap-2 items-center">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add tags..."
                className="flex-1"
              />
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={addTag}
                disabled={!tagInput.trim()}
              >
                Add
              </Button>
            </div>
          </div>
          
          <Separator className="my-4" />
          
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add a description for your bookmark..." 
                      className="resize-none" 
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="folder_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Folder</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === "root" ? null : value)}
                    value={folderIdValue}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a folder" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="root">Root (No folder)</SelectItem>
                      {folders.map((folder) => (
                        <SelectItem key={folder.id} value={folder.id}>
                          {folder.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_favorite"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <FormLabel className="text-sm cursor-pointer">Mark as favorite</FormLabel>
                  <FormControl>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                      <Star className={`h-4 w-4 ${field.value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between gap-2 mt-6">
          <div className="flex gap-2">
            {isUrlValid && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.open(url, "_blank")}
                className="text-xs gap-1"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Link
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={asModal ? () => onOpenChange?.(false) : () => router.back()} 
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEdit ? "Update" : "Save"} Bookmark
            </Button>
          </div>
        </DialogFooter>
      </form>
    </Form>
  )

  if (asModal) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
          {formContent}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "Edit" : "Add"} Bookmark</CardTitle>
        <CardDescription>
          {isEdit
            ? "Update your bookmark details below"
            : "Save a link to a website you want to remember"
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {formContent}
      </CardContent>
    </Card>
  )
}