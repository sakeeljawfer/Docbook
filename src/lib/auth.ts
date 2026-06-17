import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import type { Role, User } from "./types";
import { readDb } from "./db";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "local-dev-secret-change-me");
const cookieName = "mediqueue_session";

export async function signSession(user: User) {
  return new SignJWT({ role: user.role, phone: user.phone })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
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
    const { payload } = await jwtVerify(token, secret);
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
