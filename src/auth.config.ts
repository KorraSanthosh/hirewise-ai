import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isApiRoute = nextUrl.pathname.startsWith("/api");
      const isAuthRoute = nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/register");
      
      // Let API routes handle their own protection or check session
      if (isApiRoute) {
        return true;
      }

      // Check route protection list
      const protectedPaths = [
        "/dashboard",
        "/jobs",
        "/candidates",
        "/rankings",
        "/upload-resume",
        "/analytics",
        "/settings",
      ];
      
      const isProtected = protectedPaths.some((path) => 
        nextUrl.pathname === path || nextUrl.pathname.startsWith(path + "/")
      );

      if (isProtected) {
        if (!isLoggedIn) {
          return false; // Redirect to login
        }

        const userRole = (auth?.user as any)?.role || "recruiter";
        
        // Candidate limits:
        if (userRole === "candidate") {
          const allowedForCandidate = [
            "/candidates/profile",
            "/candidates/applications",
            "/candidates/status",
            "/jobs", // Available Jobs list
            "/upload-resume", // Allowed for candidate resume upload
          ];
          
          if (nextUrl.pathname === "/candidates/profile") {
            return Response.redirect(new URL(`/candidates/${auth?.user?.id || 'profile'}`, nextUrl));
          }

          // Let candidates also view their specific candidates details if it matches their ID
          const isOwnCandidateRoute = nextUrl.pathname.startsWith("/candidates/");
          const isAllowedCandidatePath = allowedForCandidate.some((path) => 
            nextUrl.pathname === path || nextUrl.pathname.startsWith(path + "/")
          );

          // Candidate cannot access admin panels or recruiter dashboards
          if (!isAllowedCandidatePath && !isOwnCandidateRoute) {
            return Response.redirect(new URL("/unauthorized", nextUrl));
          }
        }

        // Recruiter limits:
        if (userRole === "recruiter") {
          const restrictedForRecruiter = [
            "/admin",
          ];
          const isRestricted = restrictedForRecruiter.some((path) => 
            nextUrl.pathname === path || nextUrl.pathname.startsWith(path + "/")
          );
          if (isRestricted) {
            return Response.redirect(new URL("/unauthorized", nextUrl));
          }
        }

        return true; // Authorized
      } else if (isLoggedIn && isAuthRoute) {
        // Redirect logged-in users away from auth pages
        const userRole = (auth?.user as any)?.role || "recruiter";
        if (userRole === "candidate") {
          return Response.redirect(new URL("/jobs", nextUrl));
        }
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
  providers: [], // Configured in src/auth.ts
} satisfies NextAuthConfig;
