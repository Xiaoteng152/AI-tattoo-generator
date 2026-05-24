import { customFetch } from "@auth/core";
import Google from "next-auth/providers/google";
import { createAuthFetch } from "@/lib/auth-fetch";
import {
  getGoogleClientId,
  getGoogleClientSecret
} from "@/lib/auth-config";

export const GOOGLE_OAUTH_ENDPOINTS = {
  authorization: "https://accounts.google.com/o/oauth2/v2/auth",
  token: "https://oauth2.googleapis.com/token",
  userinfo: "https://openidconnect.googleapis.com/v1/userinfo"
} as const;

export function createGoogleProvider() {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();

  if (!clientId || !clientSecret) {
    return null;
  }

  return Google({
    clientId,
    clientSecret,
    authorization: {
      url: GOOGLE_OAUTH_ENDPOINTS.authorization
    },
    token: {
      url: GOOGLE_OAUTH_ENDPOINTS.token
    },
    userinfo: {
      url: GOOGLE_OAUTH_ENDPOINTS.userinfo
    },
    [customFetch]: createAuthFetch()
  });
}
