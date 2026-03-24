import type { EmailOtpType, Session } from "@supabase/supabase-js";

import { supabase } from "@/src/lib/supabase";

const appScheme = "futeboldequarta";

function buildNativeRedirectUrl(path: string) {
  const normalizedPath = path.replace(/^\/+/, "");
  return `${appScheme}://${normalizedPath}`;
}

function parseUrlParams(url: string) {
  const [baseWithQuery, hash = ""] = url.split("#", 2);
  const query = baseWithQuery.includes("?") ? baseWithQuery.split("?")[1] ?? "" : "";
  return new URLSearchParams([query, hash].filter(Boolean).join("&"));
}

function buildAuthRedirectUrl(path: string) {
  return buildNativeRedirectUrl(path);
}

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return (
    value === "signup" ||
    value === "invite" ||
    value === "magiclink" ||
    value === "recovery" ||
    value === "email_change" ||
    value === "email"
  );
}

export async function getCurrentSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  return session;
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data.session;
}

export async function signUpWithPassword(input: {
  fullName: string;
  email: string;
  password: string;
}) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: buildAuthRedirectUrl("/login"),
      data: {
        full_name: input.fullName,
        name: input.fullName,
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data.session;
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: buildAuthRedirectUrl("/reset-password"),
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function consumeAuthRedirect(url: string) {
  if (!url) {
    return null;
  }

  const params = parseUrlParams(url);
  const errorDescription = params.get("error_description");

  if (errorDescription) {
    throw new Error(errorDescription);
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const type = params.get("type");
  const tokenHash = params.get("token_hash");

  if (tokenHash && isEmailOtpType(type)) {
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      session: data.session,
      type,
    };
  }

  if (!accessToken || !refreshToken) {
    return null;
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    session: data.session,
    type,
  };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return data.subscription;
}
