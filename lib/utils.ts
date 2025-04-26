import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date))
}

export function truncateText(text: string, maxLength: number) {
  if (!text) return ""
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text
}

/**
 * Checks if the user is a demo user
 * @param user The user object
 * @returns true if the user is a demo user (email is demo@mindnotes.app)
 */
export function isDemoUser(user: any): boolean {
  if (!user) return false
  return user.email === "demo@mindnotes.app"
}
