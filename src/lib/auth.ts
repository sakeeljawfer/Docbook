import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import type { Role, User } from "./types";
import { readDb } from "./db";

const cookieName = "docbook_session";

function getSessionSecret() {
  const secret = process.env.JWT_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required for authentication.");
  return new TextEncoder().encode(secret);
}

export async function signSession(user: User) {
  return new SignJWT({ role: user.role, phone: user.phone })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSessionSecret());
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(cookieName);
}

export async function getCurrentUser(requiredRole?: Role | Role[]) {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    const db = await readDb();
    const user = db.users.find((item) => item.id === payload.sub);
    if (!user || user.status !== "active") return null;
    const roles = Array.isArray(requiredRole) ? requiredRole : requiredRole ? [requiredRole] : null;
    if (roles && !roles.includes(user.role)) return null;
    return user;
  } catch {
    return null;
  }
}
