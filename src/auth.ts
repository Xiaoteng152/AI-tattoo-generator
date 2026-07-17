import NextAuth from "next-auth";
import { createGoogleProvider } from "@/lib/google-auth-provider";

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const googleProvider = createGoogleProvider();

  return {
    providers: googleProvider ? [googleProvider] : [],
    session: {
      strategy: "jwt"
    },
    pages: {
      signIn: "/login",
      error: "/login"
    },
    secret: process.env.AUTH_SECRET,
    trustHost: true
  };
});
