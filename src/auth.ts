import NextAuth from "next-auth";
import { createGoogleProvider } from "@/lib/google-auth-provider";

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const googleProvider = createGoogleProvider();

  return {
    providers: googleProvider ? [googleProvider] : [],
    session: {
      strategy: "jwt"
    },
    secret: process.env.AUTH_SECRET,
    trustHost: true
  };
});
