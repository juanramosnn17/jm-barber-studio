/* =====================================================================
   GESTIÓN DE SESIÓN DE USUARIO (lib/auth/session.ts)
   ---------------------------------------------------------------------
   Maneja la cookie de sesión local (`jm_user_session`) para que la
   autenticación funcione de inmediato tanto con Supabase como con el
   almacén en memoria.
   ===================================================================== */

import "server-only";
import { cookies } from "next/headers";
import { findUserById } from "@/lib/data/store";
import type { Profile } from "@/lib/types";

const SESSION_COOKIE_NAME = "jm_user_session";

export async function setSessionUser(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 días
  });
}

export async function clearSessionUser() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const c = cookieStore.get(SESSION_COOKIE_NAME);
  return c?.value || null;
}

export async function getSessionUserProfile(): Promise<Profile | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = findUserById(userId);
  if (!user) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...profile } = user;
  return profile;
}
