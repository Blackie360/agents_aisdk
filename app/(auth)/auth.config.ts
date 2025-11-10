import { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
    newUser: "/",
  },
  providers: [
    // added later in auth.ts since it requires bcrypt which is only compatible with Node.js
    // while this file is also used in non-Node.js environments
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      // If redirecting after OAuth, preserve the original URL but clean query params
      if (url.startsWith("/")) {
        // Remove OAuth callback query params
        const cleanUrl = url.split("?")[0];
        return `${baseUrl}${cleanUrl}`;
      }
      if (new URL(url).origin === baseUrl) {
        const cleanUrl = url.split("?")[0];
        return cleanUrl;
      }
      return baseUrl;
    },
    async authorized({ auth, request: { nextUrl } }) {
      let isLoggedIn = !!auth?.user;
      let isOnChat = nextUrl.pathname.startsWith("/");
      let isOnRegister = nextUrl.pathname.startsWith("/register");
      let isOnLogin = nextUrl.pathname.startsWith("/login");
      let isOnError = nextUrl.pathname.startsWith("/api/auth/error");

      // Always allow access to error pages
      if (isOnError) {
        return true;
      }

      if (isLoggedIn && (isOnLogin || isOnRegister)) {
        return Response.redirect(new URL("/", nextUrl));
      }

      if (isOnRegister || isOnLogin) {
        return true; // Always allow access to register and login pages
      }

      if (isOnChat) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      }

      if (isLoggedIn) {
        return Response.redirect(new URL("/", nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
