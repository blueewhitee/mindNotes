# MindNotes - AI-Powered Note-Taking App

MindNotes is a responsive web application that helps users capture, organize, and gain insights from their notes using AI assistance. This project was developed as a technical assessment to demonstrate proficiency with a modern web tech stack.

![MindNotes](public/placeholder.jpg)

## Tech Stack

- **Frontend**: Next.js (TypeScript), TailwindCSS, Shadcn UI
- **Backend**: Supabase (Authentication, Database)
- **State Management**: React Query
- **AI Integration**: Groq API (via Next.js API route), Google Gemini AI for semantic search
- **Deployment**: Vercel compatible

## Features

### User Authentication
- Email & Password authentication
- Google OAuth integration
- Session management with Supabase Auth

```tsx
// Example of Google authentication implementation
const handleGoogleSignIn = async () => {
  const supabase = createClient();
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${location.origin}/auth/callback`,
    },
  });
};
```

### Note Management
- Create, edit, and delete notes
- Search functionality
- Archive feature for better organization
- Real-time saving with debouncing

### Bookmarks Management
- Save and organize web bookmarks
- Folder-based organization system
- Tagging system for better categorization
- Mark favorites for quick access
- Rich details with descriptions and metadata

### AI Summarization
- Integrates with Groq API for note analysis
- Automatic summarization as you type
- Visual concept mapping of related ideas
- Rate limiting and caching for optimal performance

### Semantic Search
- Advanced search functionality using Google Gemini AI
- Both text-based and semantic vector search capabilities
- Efficient caching of embeddings for improved performance
- Fallback mechanisms for reliability

### Responsive UI
- Clean, intuitive design with Shadcn UI components
- Dark/light mode support
- Mobile-first responsive layout
- Loading states and feedback mechanisms


## Implementation Details

### Frontend (Next.js, TypeScript, TailwindCSS, Shadcn)

The application is built using Next.js App Router with TypeScript for type safety. The UI is styled using TailwindCSS with custom configuration in `tailwind.config.ts`. Shadcn UI components are used throughout the application for a consistent and polished look.

### Backend (Supabase)

Supabase handles both authentication and database operations. The `lib/supabase/` directory contains client-side and server-side helpers for interacting with Supabase.

### User Authentication

The `components/auth/auth-form.tsx` component handles sign-up and login via email/password and Google OAuth. Route protection is implemented in layouts like `app/dashboard/layout.tsx`.

### Note Management

Notes CRUD operations are managed through React Query hooks in `lib/hooks/use-notes.ts`. The UI for note creation, editing, and viewing is implemented in components like `note-editor.tsx` and `note-card.tsx`.

### Bookmark Management

The bookmarks feature allows users to save and organize web links with a robust folder structure. Implementation includes:
- Custom folder tree navigation interface with drag-and-drop support
- Bookmark cards with favicons and metadata
- Folder CRUD operations in `lib/hooks/use-bookmark-folders.ts`
- Bookmark CRUD operations in `lib/hooks/use-bookmarks.ts`
- Optimistic updates for smooth UI interactions

### AI Summarization

The AI integration is implemented through a secure API route at `app/api/analyze/route.ts`, which interfaces with the Groq API. The frontend interacts with this endpoint via the `useAIAssistant` hook.

### Semantic Search

The semantic search feature uses Google's Gemini AI model (gemini-2.0-flash) to generate embeddings for search queries in `app/api/search/route.ts`. It implements:
- Text-based search for exact and partial matches
- Vector-based semantic search for concept matching
- Efficient caching system to reduce API calls
- Fallback mechanisms for reliability

### State Management

React Query (`@tanstack/react-query`) is used extensively for server state management. The `QueryProvider` wraps the application to provide the React Query client context, and custom hooks like `useNotes` utilize `useQuery` and `useMutation` for data operations.


## Evaluation Criteria Implementation

This project successfully implements all requirements of the assessment:

- **UI/UX Quality**: Clean, intuitive design with responsive layouts and polished UI components
- **Code Quality**: Well-structured TypeScript code with proper organization
- **Integration Skills**: Seamless integration with Supabase, Groq API, and Google Gemini AI
- **State Management**: Proper implementation of React Query for efficient data handling
- **Problem-Solving**: Creative implementation of AI summarization with concept mapping and advanced semantic search
