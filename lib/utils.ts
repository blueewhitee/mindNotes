import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined) {
  // Handle null, undefined, or invalid date values
  if (!date) return "No date";
  
  // Try to create a valid date object
  const dateObj = new Date(date);
  
  // Check if date is valid
  if (isNaN(dateObj.getTime())) {
    return "Invalid date";
  }
  
  // Return formatted date if valid
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dateObj)
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
