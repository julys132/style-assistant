import { createHash, createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db";
import { sessions } from "../../shared/schema";

const JWT_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || "dev-secret-change-me";
const ACCESS_TOKEN_EXPIRES_SECONDS = 15 * 60;
const REFRESH_TOKEN_EXPIRES_DAYS = 30;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface JwtPayload extends AuthUser {
  iat: number;
  exp: number;
}

function base64UrlEncode(input: Buffer | string): string {
  const raw = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return raw
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64");
}

function signHs256(unsignedToken: string): string {
  return base64UrlEncode(createHmac("sha256", JWT_SECRET).update(unsignedToken).digest());
}

export function generateAccessToken(user: AuthUser): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ACCESS_TOKEN_EXPIRES_SECONDS;

  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify({ ...user, iat, exp }));
  const unsignedToken = `${header}.${payload}`;
  const signature = signHs256(unsignedToken);
  return `${unsignedToken}.${signature}`;
}

export function verifyAccessToken(token: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("INVALID_TOKEN");
  }

  const [header, payload, signature] = parts;
  const expectedSignature = signHs256(`${header}.${payload}`);
  const actualSignatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);
  if (
    actualSignatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(actualSignatureBuffer, expectedSignatureBuffer)
  ) {
    throw new Error("INVALID_TOKEN");
  }

  const parsed = JSON.parse(base64UrlDecode(payload).toString("utf8")) as JwtPayload;
  if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("TOKEN_EXPIRED");
  }

  return parsed;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  const token = authHeader.slice("Bearer ".length);
  try {
    const decoded = verifyAccessToken(token);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
    };
    next();
  } catch (error: any) {
    if (error.message === "TOKEN_EXPIRED") {
      res.status(401).json({ error: "Token expired", code: "TOKEN_EXPIRED" });
      return;
    }
    res.status(401).json({ error: "Invalid token" });
  }
}

export function generateRefreshToken(): string {
  return randomBytes(64).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, refreshToken: string): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);

  await db.insert(sessions).values({
    id: randomUUID(),
    userId,
    refreshTokenHash: hashToken(refreshToken),
    expiresAt,
  });
}

export async function validateRefreshToken(refreshToken: string): Promise<string | null> {
  const [session] = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(
      and(
        eq(sessions.refreshTokenHash, hashToken(refreshToken)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    );

  return session?.userId ?? null;
}

export async function revokeSession(refreshToken: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.refreshTokenHash, hashToken(refreshToken)));
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const candidateHashBuffer = Buffer.from(scryptSync(password, salt, 64).toString("hex"), "hex");
  const storedHashBuffer = Buffer.from(hash, "hex");
  if (candidateHashBuffer.length !== storedHashBuffer.length) return false;
  return timingSafeEqual(candidateHashBuffer, storedHashBuffer);
}
