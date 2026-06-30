import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login", 
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      
      // Define the specific sub-routes that absolutely require a logged-in account
      const isProtectedProfileRoute = 
        nextUrl.pathname.startsWith("/trips") || 
        nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/settings");

      // If they are trying to access a protected dashboard/trip history page:
      if (isProtectedProfileRoute) {
        if (isLoggedIn) return true;
        return false; // Redirects them straight to /login
      }
      
      // For /, /plan, and anything else: let them pass through!
      // Your backend/server component logic will handle checking if a guest has hit their itinerary limit.
      return true;
    },
  },
  providers: [], 
} satisfies NextAuthConfig;