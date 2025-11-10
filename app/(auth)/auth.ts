import { compare } from "bcrypt-ts";
import NextAuth, { User, Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { getUser, saveGoogleRefreshToken, createUser } from "@/db/queries";

import { authConfig } from "./auth.config";

interface ExtendedSession extends Session {
  user: User;
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {},
      async authorize({ email, password }: any) {
        let users = await getUser(email);
        if (users.length === 0) return null;
        let passwordsMatch = await compare(password, users[0].password!);
        if (passwordsMatch) return users[0] as any;
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar",
          access_type: "offline",
          prompt: "consent",
        },
      },
      httpOptions: {
        // Increase timeout to handle slow network connections
        timeout: 30000, // 30 seconds
      },
      // Add retry logic for failed requests
      checks: ["pkce", "state"],
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Handle Google OAuth sign-in - ensure user exists in our database
      if (account?.provider === "google" && user.email) {
        try {
          // Check if user exists in database
          const existingUsers = await getUser(user.email);
          
          if (existingUsers.length === 0) {
            // Create user if they don't exist (password can be null for OAuth users)
            await createUser(user.email, "");
            console.log("✅ Created new user for Google OAuth:", user.email);
          }
          
          return true;
        } catch (error) {
          console.error("❌ Error during Google sign-in:", error);
          // Log more details about the error
          if (error instanceof Error) {
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
          }
          return false;
        }
      }
      
      return true;
    },
    async jwt({ token, user, account }) {
      // When user signs in, get their database ID
      if (user?.email) {
        token.email = user.email;
        try {
          const dbUsers = await getUser(user.email);
          if (dbUsers.length > 0 && dbUsers[0].id) {
            token.id = dbUsers[0].id;
          }
        } catch (error) {
          console.error("Failed to get user ID from database:", error);
        }
      }

      // Store Google refresh token when user connects Google account
      if (account?.provider === "google" && account.refresh_token && token.id) {
        try {
          await saveGoogleRefreshToken({
            userId: token.id as string,
            refreshToken: account.refresh_token,
          });
          token.googleRefreshToken = account.refresh_token;
          console.log("✅ Google refresh token saved for user:", token.id);
        } catch (error) {
          console.error("❌ Failed to save Google refresh token:", error);
        }
      }

      return token;
    },
    async session({
      session,
      token,
    }: {
      session: ExtendedSession;
      token: any;
    }) {
      if (session.user) {
        // Set user ID from token (verified in saveChat if needed)
        // Note: If user doesn't exist in DB, saveChat will handle it gracefully
        if (token.id) {
          session.user.id = token.id as string;
        }
        
        // Ensure email is available in session
        if (token.email && !session.user.email) {
          session.user.email = token.email as string;
        }
      }

      return session;
    },
  },
});
