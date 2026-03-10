"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc2) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc2 = __getOwnPropDesc(from, key)) || desc2.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server/index.ts
var import_express = __toESM(require("express"));

// server/routes.ts
var import_node_http = require("node:http");
var import_node_crypto = require("node:crypto");
var import_drizzle_orm3 = require("drizzle-orm");

// server/db.ts
var import_node_postgres = require("drizzle-orm/node-postgres");
var import_pg = require("pg");

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  conversations: () => conversations,
  creditTransactions: () => creditTransactions,
  insertAuthUserSchema: () => insertAuthUserSchema,
  insertConversationSchema: () => insertConversationSchema,
  insertMessageSchema: () => insertMessageSchema,
  messages: () => messages,
  sessions: () => sessions,
  users: () => users
});
var import_drizzle_orm = require("drizzle-orm");
var import_pg_core = require("drizzle-orm/pg-core");
var import_drizzle_zod = require("drizzle-zod");
var users = (0, import_pg_core.pgTable)("users", {
  id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
  email: (0, import_pg_core.text)("email").notNull().unique(),
  name: (0, import_pg_core.text)("name").notNull(),
  passwordHash: (0, import_pg_core.text)("password_hash"),
  authProvider: (0, import_pg_core.text)("auth_provider").notNull().default("email"),
  providerId: (0, import_pg_core.text)("provider_id"),
  credits: (0, import_pg_core.integer)("credits").notNull().default(3),
  subscriptionPlan: (0, import_pg_core.text)("subscription_plan"),
  subscriptionRenewAt: (0, import_pg_core.timestamp)("subscription_renew_at"),
  styleGender: (0, import_pg_core.text)("style_gender"),
  stylePreferences: (0, import_pg_core.jsonb)("style_preferences").$type().notNull().default(import_drizzle_orm.sql`'[]'::jsonb`),
  favoriteLooks: (0, import_pg_core.jsonb)("favorite_looks").$type().notNull().default(import_drizzle_orm.sql`'[]'::jsonb`),
  notificationsEnabled: (0, import_pg_core.boolean)("notifications_enabled").notNull().default(true),
  createdAt: (0, import_pg_core.timestamp)("created_at").notNull().defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").notNull().defaultNow()
});
var sessions = (0, import_pg_core.pgTable)("sessions", {
  id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
  userId: (0, import_pg_core.varchar)("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  refreshTokenHash: (0, import_pg_core.text)("refresh_token_hash").notNull(),
  expiresAt: (0, import_pg_core.timestamp)("expires_at").notNull(),
  revokedAt: (0, import_pg_core.timestamp)("revoked_at"),
  createdAt: (0, import_pg_core.timestamp)("created_at").notNull().defaultNow()
});
var creditTransactions = (0, import_pg_core.pgTable)("credit_transactions", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  userId: (0, import_pg_core.varchar)("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: (0, import_pg_core.text)("type").notNull(),
  // purchase | subscription | usage | refund
  amountCredits: (0, import_pg_core.integer)("amount_credits").notNull(),
  amountUsdCents: (0, import_pg_core.integer)("amount_usd_cents"),
  source: (0, import_pg_core.text)("source"),
  // stripe | manual | app
  description: (0, import_pg_core.text)("description"),
  stripeSessionId: (0, import_pg_core.text)("stripe_session_id"),
  stripePaymentIntentId: (0, import_pg_core.text)("stripe_payment_intent_id"),
  createdAt: (0, import_pg_core.timestamp)("created_at").notNull().defaultNow()
});
var conversations = (0, import_pg_core.pgTable)("conversations", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  title: (0, import_pg_core.text)("title").notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at").default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`).notNull()
});
var messages = (0, import_pg_core.pgTable)("messages", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  conversationId: (0, import_pg_core.integer)("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: (0, import_pg_core.text)("role").notNull(),
  content: (0, import_pg_core.text)("content").notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at").default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`).notNull()
});
var insertAuthUserSchema = (0, import_drizzle_zod.createInsertSchema)(users).pick({
  email: true,
  name: true,
  passwordHash: true,
  authProvider: true,
  providerId: true
});
var insertConversationSchema = (0, import_drizzle_zod.createInsertSchema)(conversations).omit({
  id: true,
  createdAt: true
});
var insertMessageSchema = (0, import_drizzle_zod.createInsertSchema)(messages).omit({
  id: true,
  createdAt: true
});

// server/db.ts
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}
var connectionString = process.env.DATABASE_URL;
var isLocalhost = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
var pool = new import_pg.Pool({
  connectionString,
  ssl: isLocalhost ? false : { rejectUnauthorized: false }
});
var db = (0, import_node_postgres.drizzle)(pool, { schema: schema_exports });

// server/lib/auth.ts
var import_crypto = require("crypto");
var import_drizzle_orm2 = require("drizzle-orm");
var JWT_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || "dev-secret-change-me";
var ACCESS_TOKEN_EXPIRES_SECONDS = 15 * 60;
var REFRESH_TOKEN_EXPIRES_DAYS = 30;
function base64UrlEncode(input) {
  const raw = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return raw.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - normalized.length % 4);
  return Buffer.from(normalized + padding, "base64");
}
function signHs256(unsignedToken) {
  return base64UrlEncode((0, import_crypto.createHmac)("sha256", JWT_SECRET).update(unsignedToken).digest());
}
function generateAccessToken(user) {
  const iat = Math.floor(Date.now() / 1e3);
  const exp = iat + ACCESS_TOKEN_EXPIRES_SECONDS;
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify({ ...user, iat, exp }));
  const unsignedToken = `${header}.${payload}`;
  const signature = signHs256(unsignedToken);
  return `${unsignedToken}.${signature}`;
}
function verifyAccessToken(token) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("INVALID_TOKEN");
  }
  const [header, payload, signature] = parts;
  const expectedSignature = signHs256(`${header}.${payload}`);
  const actualSignatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);
  if (actualSignatureBuffer.length !== expectedSignatureBuffer.length || !(0, import_crypto.timingSafeEqual)(actualSignatureBuffer, expectedSignatureBuffer)) {
    throw new Error("INVALID_TOKEN");
  }
  const parsed = JSON.parse(base64UrlDecode(payload).toString("utf8"));
  if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1e3)) {
    throw new Error("TOKEN_EXPIRED");
  }
  return parsed;
}
function authMiddleware(req, res, next) {
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
      name: decoded.name
    };
    next();
  } catch (error) {
    if (error.message === "TOKEN_EXPIRED") {
      res.status(401).json({ error: "Token expired", code: "TOKEN_EXPIRED" });
      return;
    }
    res.status(401).json({ error: "Invalid token" });
  }
}
function generateRefreshToken() {
  return (0, import_crypto.randomBytes)(64).toString("hex");
}
function hashToken(token) {
  return (0, import_crypto.createHash)("sha256").update(token).digest("hex");
}
async function createSession(userId, refreshToken) {
  const expiresAt = /* @__PURE__ */ new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);
  await db.insert(sessions).values({
    id: (0, import_crypto.randomUUID)(),
    userId,
    refreshTokenHash: hashToken(refreshToken),
    expiresAt
  });
}
async function validateRefreshToken(refreshToken) {
  const [session] = await db.select({ userId: sessions.userId }).from(sessions).where(
    (0, import_drizzle_orm2.and)(
      (0, import_drizzle_orm2.eq)(sessions.refreshTokenHash, hashToken(refreshToken)),
      (0, import_drizzle_orm2.isNull)(sessions.revokedAt),
      (0, import_drizzle_orm2.gt)(sessions.expiresAt, /* @__PURE__ */ new Date())
    )
  );
  return session?.userId ?? null;
}
async function revokeSession(refreshToken) {
  await db.update(sessions).set({ revokedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm2.eq)(sessions.refreshTokenHash, hashToken(refreshToken)));
}
async function revokeAllSessions(userId) {
  await db.update(sessions).set({ revokedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm2.and)((0, import_drizzle_orm2.eq)(sessions.userId, userId), (0, import_drizzle_orm2.isNull)(sessions.revokedAt)));
}
function hashPassword(password) {
  const salt = (0, import_crypto.randomBytes)(16).toString("hex");
  const hash = (0, import_crypto.scryptSync)(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const candidateHashBuffer = Buffer.from((0, import_crypto.scryptSync)(password, salt, 64).toString("hex"), "hex");
  const storedHashBuffer = Buffer.from(hash, "hex");
  if (candidateHashBuffer.length !== storedHashBuffer.length) return false;
  return (0, import_crypto.timingSafeEqual)(candidateHashBuffer, storedHashBuffer);
}

// server/lib/stripe.ts
var STRIPE_API_BASE = "https://api.stripe.com/v1";
function getStripeSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return key;
}
async function stripeRequest({
  method,
  path: path2,
  body
}) {
  const secretKey = getStripeSecretKey();
  const response = await fetch(`${STRIPE_API_BASE}${path2}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}
    },
    body: body ? body.toString() : void 0
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || "Stripe request failed";
    throw new Error(message);
  }
  return data;
}
async function createStripeCheckoutSession(params) {
  const form = new URLSearchParams();
  form.set("mode", params.mode);
  form.set("success_url", params.successUrl);
  form.set("cancel_url", params.cancelUrl);
  form.set("customer_email", params.customerEmail);
  form.set("client_reference_id", params.clientReferenceId);
  form.set("payment_method_types[0]", "card");
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", "usd");
  form.set(
    "line_items[0][price_data][product_data][name]",
    params.productName
  );
  form.set(
    "line_items[0][price_data][product_data][description]",
    "Credits for The Stylist"
  );
  form.set(
    "line_items[0][price_data][unit_amount]",
    String(params.unitAmountCents)
  );
  if (params.mode === "subscription") {
    form.set("line_items[0][price_data][recurring][interval]", "month");
  }
  for (const [key, value] of Object.entries(params.metadata)) {
    form.set(`metadata[${key}]`, value);
    if (params.mode === "payment") {
      form.set(`payment_intent_data[metadata][${key}]`, value);
    } else {
      form.set(`subscription_data[metadata][${key}]`, value);
    }
  }
  const result = await stripeRequest({
    method: "POST",
    path: "/checkout/sessions",
    body: form
  });
  return result;
}
async function retrieveStripeCheckoutSession(sessionId) {
  const encoded = encodeURIComponent(sessionId);
  return stripeRequest({
    method: "GET",
    path: `/checkout/sessions/${encoded}`
  });
}

// server/routes.ts
function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI_NOT_CONFIGURED: Set GEMINI_API_KEY (or GOOGLE_API_KEY) to use Gemini styling features."
    );
  }
  return apiKey;
}
function firstHeaderValue(value) {
  return Array.isArray(value) ? value[0] : value;
}
function toErrorMessage(error, fallback) {
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
    if (Array.isArray(message)) {
      const firstString = message.find((entry) => typeof entry === "string");
      if (firstString && firstString.trim().length > 0) {
        return firstString;
      }
    }
  }
  return fallback;
}
function getEnvValues(keys) {
  const values = [];
  for (const key of keys) {
    const raw = process.env[key];
    if (!raw) continue;
    raw.split(",").map((value) => value.trim()).filter(Boolean).forEach((value) => values.push(value));
  }
  return values;
}
function base64UrlDecode2(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = normalized.length % 4 === 0 ? 0 : 4 - normalized.length % 4;
  return Buffer.from(normalized + "=".repeat(padLength), "base64");
}
function parseJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = JSON.parse(base64UrlDecode2(headerPart).toString("utf8"));
  const payload = JSON.parse(base64UrlDecode2(payloadPart).toString("utf8"));
  return {
    signedPart: `${headerPart}.${payloadPart}`,
    signature: base64UrlDecode2(signaturePart),
    header,
    payload
  };
}
var appleKeysCache = null;
var APPLE_KEYS_TTL_MS = 60 * 60 * 1e3;
async function getAppleSigningKeys() {
  if (appleKeysCache && Date.now() - appleKeysCache.fetchedAt < APPLE_KEYS_TTL_MS) {
    return appleKeysCache.keys;
  }
  const response = await fetch("https://appleid.apple.com/auth/keys");
  if (!response.ok) {
    throw new Error("Could not load Apple signing keys");
  }
  const data = await response.json();
  const keys = Array.isArray(data.keys) ? data.keys : [];
  if (keys.length === 0) {
    throw new Error("Apple signing keys are unavailable");
  }
  appleKeysCache = { keys, fetchedAt: Date.now() };
  return keys;
}
function getAppleAudienceSet() {
  return new Set(
    getEnvValues([
      "APPLE_BUNDLE_ID",
      "APPLE_SERVICE_ID",
      "APPLE_CLIENT_ID",
      "EXPO_PUBLIC_APPLE_CLIENT_ID"
    ])
  );
}
function getGoogleAudienceSet() {
  return new Set(
    getEnvValues([
      "GOOGLE_CLIENT_ID",
      "GOOGLE_WEB_CLIENT_ID",
      "GOOGLE_IOS_CLIENT_ID",
      "GOOGLE_ANDROID_CLIENT_ID",
      "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
      "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
      "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID"
    ])
  );
}
async function verifyGoogleIdToken(idToken) {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );
  if (!response.ok) {
    throw new Error("Invalid Google identity token");
  }
  const data = await response.json();
  const sub = typeof data.sub === "string" ? data.sub : "";
  const email = typeof data.email === "string" ? data.email : "";
  const iss = typeof data.iss === "string" ? data.iss : "";
  const aud = typeof data.aud === "string" ? data.aud : "";
  const exp = Number(data.exp || 0);
  const emailVerified = data.email_verified === true || data.email_verified === "true";
  const name = typeof data.name === "string" ? data.name : void 0;
  if (!sub || !email) {
    throw new Error("Google token is missing subject or email");
  }
  if (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") {
    throw new Error("Google token issuer is invalid");
  }
  if (!Number.isFinite(exp) || exp * 1e3 < Date.now()) {
    throw new Error("Google token is expired");
  }
  if (!emailVerified) {
    throw new Error("Google email is not verified");
  }
  const allowedAudiences = getGoogleAudienceSet();
  if (allowedAudiences.size > 0 && !allowedAudiences.has(aud)) {
    throw new Error("Google token audience mismatch");
  }
  return { sub, email, name };
}
async function verifyAppleIdentityToken(identityToken) {
  const { signedPart, signature, header, payload } = parseJwt(identityToken);
  const kid = typeof header.kid === "string" ? header.kid : "";
  const alg = typeof header.alg === "string" ? header.alg : "";
  if (!kid || alg !== "RS256") {
    throw new Error("Apple token header is invalid");
  }
  const keys = await getAppleSigningKeys();
  const key = keys.find((entry) => entry.kid === kid && entry.kty === "RSA");
  if (!key) {
    throw new Error("Apple signing key not found");
  }
  const publicKey = (0, import_node_crypto.createPublicKey)({
    key: {
      kty: key.kty,
      kid: key.kid,
      use: key.use,
      alg: key.alg,
      n: key.n,
      e: key.e
    },
    format: "jwk"
  });
  const verifier = (0, import_node_crypto.createVerify)("RSA-SHA256");
  verifier.update(signedPart);
  verifier.end();
  const signatureIsValid = verifier.verify(publicKey, signature);
  if (!signatureIsValid) {
    throw new Error("Apple token signature is invalid");
  }
  const iss = typeof payload.iss === "string" ? payload.iss : "";
  const aud = typeof payload.aud === "string" ? payload.aud : "";
  const sub = typeof payload.sub === "string" ? payload.sub : "";
  const exp = Number(payload.exp || 0);
  const email = typeof payload.email === "string" ? payload.email : void 0;
  if (iss !== "https://appleid.apple.com") {
    throw new Error("Apple token issuer is invalid");
  }
  if (!sub) {
    throw new Error("Apple token is missing subject");
  }
  if (!Number.isFinite(exp) || exp * 1e3 < Date.now()) {
    throw new Error("Apple token is expired");
  }
  const allowedAudiences = getAppleAudienceSet();
  if (allowedAudiences.size > 0 && !allowedAudiences.has(aud)) {
    throw new Error("Apple token audience mismatch");
  }
  return { sub, email };
}
var CREDIT_PACKAGES = [
  { id: "pack_5", name: "Starter", credits: 5, priceCents: 299 },
  { id: "pack_15", name: "Style Pack", credits: 15, priceCents: 699, popular: true },
  { id: "pack_30", name: "Fashion Pack", credits: 30, priceCents: 1199 },
  { id: "pack_100", name: "Pro Pack", credits: 100, priceCents: 3499 }
];
var SUBSCRIPTION_PLANS = [
  { id: "sub_basic", name: "Basic", creditsPerMonth: 10, priceCents: 499 },
  { id: "sub_premium", name: "Premium", creditsPerMonth: 30, priceCents: 999, popular: true },
  { id: "sub_unlimited", name: "Unlimited", creditsPerMonth: 999, priceCents: 1999 }
];
var STYLE_COSTS = {
  text: 2,
  image: 5
};
var DEFAULT_INITIAL_CREDITS = Number.parseInt(process.env.DEFAULT_INITIAL_CREDITS || "3", 10);
var DEFAULT_DEV_CREDIT_GRANT = Number.parseInt(process.env.DEV_CREDIT_GRANT_AMOUNT || "50", 10);
var MAX_DEV_CREDIT_GRANT = 500;
var GEMINI_API_BASE_URL = process.env.GEMINI_API_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
var DEFAULT_STYLE_TEXT_MODEL = process.env.STYLE_TEXT_MODEL || "gemini-3-flash-preview";
var DEFAULT_STYLE_IMAGE_MODEL = process.env.STYLE_IMAGE_MODEL || "gemini-3.1-flash-image-preview";
var STYLE_IMAGE_SIZE = (process.env.STYLE_IMAGE_SIZE || "512x512").trim() || "512x512";
var EXPOSE_STYLE_DEBUG_PROMPT = normalizeStringValue(process.env.EXPOSE_STYLE_DEBUG_PROMPT).toLowerCase() === "true";
var MAX_IMAGE_COUNT_BY_MODE = {
  single_item: 10,
  multi_item: 3
};
var MAX_IMAGE_BASE64_LENGTH = 25e5;
var STRIPE_WEBHOOK_TOLERANCE_SEC = 300;
var WARDROBE_SUGGEST_TIMEOUT_MS = 25e3;
var DEFAULT_WARDROBE_SUGGEST_WORKER_URL = "https://muse.iuliastarcean.workers.dev/suggest-wardrobe";
var WARDROBE_SUGGEST_MODELS = ["auto", "uform", "llava"];
var WARDROBE_CATEGORIES = ["Top", "Bottom", "Dress", "Outerwear", "Shoes", "Accessory", "Bag"];
var WARDROBE_COLORS = [
  "Black",
  "White",
  "Navy",
  "Gray",
  "Beige",
  "Brown",
  "Red",
  "Blue",
  "Green",
  "Pink",
  "Gold",
  "Silver",
  "Yellow",
  "Orange",
  "Purple",
  "Multi"
];
var WARDROBE_PATTERNS = ["Solid", "Striped", "Floral", "Checked", "Graphic", "Other"];
var SHADE_TO_BASE_COLOR = {
  charcoal: "Gray",
  heather: "Gray",
  "dark heather": "Gray",
  "light heather": "Gray",
  "ash gray": "Gray",
  "ash grey": "Gray",
  oatmeal: "Beige",
  taupe: "Beige",
  stone: "Beige",
  sand: "Beige",
  khaki: "Beige",
  cream: "White",
  ivory: "White",
  offwhite: "White",
  "off white": "White",
  navy: "Navy",
  cobalt: "Blue",
  burgundy: "Red",
  maroon: "Red",
  sage: "Green",
  olive: "Green",
  lilac: "Purple",
  lavender: "Purple",
  mustard: "Yellow"
};
var DEFAULT_IAP_PRODUCT_CREDITS = {
  "com.iulia.muse.credits.5": 5,
  "com.iulia.muse.credits.15": 15,
  "com.iulia.muse.credits.30": 30,
  "com.iulia.muse.credits.100": 100,
  "com.thestylist.app.credits.5": 5,
  "com.thestylist.app.credits.15": 15,
  "com.thestylist.app.credits.30": 30,
  "com.thestylist.app.credits.100": 100
};
function parseProductCreditsMap(raw) {
  if (!raw || !raw.trim()) return {};
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const entries = Object.entries(parsed);
    return entries.reduce((acc, [productId, creditsRaw]) => {
      const credits = Number(creditsRaw);
      if (productId.trim() && Number.isFinite(credits) && credits > 0) {
        acc[productId.trim()] = Math.floor(credits);
      }
      return acc;
    }, {});
  } catch {
    return trimmed.split(",").map((entry) => entry.trim()).filter(Boolean).reduce((acc, entry) => {
      const [productIdRaw, creditsRaw] = entry.split(":").map((part) => part.trim());
      const credits = Number(creditsRaw);
      if (productIdRaw && Number.isFinite(credits) && credits > 0) {
        acc[productIdRaw] = Math.floor(credits);
      }
      return acc;
    }, {});
  }
}
var SHARED_IAP_PRODUCT_CREDITS = parseProductCreditsMap(process.env.IAP_PRODUCT_CREDITS);
var APPLE_IAP_PRODUCT_CREDITS = {
  ...DEFAULT_IAP_PRODUCT_CREDITS,
  ...SHARED_IAP_PRODUCT_CREDITS,
  ...parseProductCreditsMap(process.env.APPLE_IAP_PRODUCT_CREDITS)
};
var GOOGLE_IAP_PRODUCT_CREDITS = {
  ...DEFAULT_IAP_PRODUCT_CREDITS,
  ...SHARED_IAP_PRODUCT_CREDITS,
  ...parseProductCreditsMap(process.env.GOOGLE_IAP_PRODUCT_CREDITS)
};
function getInitialCredits() {
  if (Number.isInteger(DEFAULT_INITIAL_CREDITS) && DEFAULT_INITIAL_CREDITS > 0) {
    return DEFAULT_INITIAL_CREDITS;
  }
  return 3;
}
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function sanitizeUser(user) {
  const normalizedStyleGender = normalizeStyleGender(user.styleGender);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    provider: user.authProvider || "email",
    credits: user.credits,
    subscription: user.subscriptionPlan,
    styleGender: normalizedStyleGender || null,
    stylePreferences: Array.isArray(user.stylePreferences) ? user.stylePreferences : [],
    favoriteLooks: Array.isArray(user.favoriteLooks) ? user.favoriteLooks : [],
    notificationsEnabled: user.notificationsEnabled
  };
}
function normalizeOutputMode(input) {
  return input === "text" ? "text" : "image";
}
function normalizeStyleGender(input) {
  const value = normalizeStringValue(input).toLowerCase();
  if (value === "female" || value === "male" || value === "non_binary") {
    return value;
  }
  return "";
}
function normalizeImageInputMode(input) {
  return input === "multi_item" ? "multi_item" : "single_item";
}
function normalizeStylingSourceMode(input) {
  return input === "saved_wardrobe" || input === "saved_wardrobe_plus" ? input : "photo_only";
}
function normalizeStringValue(input) {
  if (typeof input === "string") return input.trim();
  if (Array.isArray(input)) {
    const first = input.find((entry) => typeof entry === "string");
    return first ? first.trim() : "";
  }
  return "";
}
function normalizeStringList(input) {
  if (!Array.isArray(input)) return [];
  return input.filter((value) => typeof value === "string").map((value) => value.trim()).filter(Boolean);
}
function normalizeWardrobeSuggestModel(input) {
  const model = normalizeStringValue(input).toLowerCase();
  if (WARDROBE_SUGGEST_MODELS.includes(model)) {
    return model;
  }
  return "auto";
}
function getWardrobeSuggestWorkerUrl() {
  const configuredUrl = normalizeStringValue(process.env.WARDROBE_SUGGEST_WORKER_URL);
  const source = configuredUrl || DEFAULT_WARDROBE_SUGGEST_WORKER_URL;
  const trimmed = source.replace(/\/+$/, "");
  if (trimmed.endsWith("/suggest-wardrobe")) return trimmed;
  return `${trimmed}/suggest-wardrobe`;
}
function normalizeWardrobeEnumValue(input, allowedValues, aliases = {}) {
  const normalized = normalizeStringValue(input).toLowerCase();
  if (!normalized) return "";
  if (aliases[normalized]) return aliases[normalized];
  const directMatch = allowedValues.find((value) => value.toLowerCase() === normalized);
  if (directMatch) return directMatch;
  const tokenized = normalized.replace(/[_-]+/g, " ").split(/[\s,/|]+/).map((token) => token.trim()).filter(Boolean);
  for (const token of tokenized) {
    if (aliases[token]) return aliases[token];
    const tokenMatch = allowedValues.find((value) => value.toLowerCase() === token);
    if (tokenMatch) return tokenMatch;
  }
  const partialMatch = allowedValues.find((value) => normalized.includes(value.toLowerCase()));
  if (partialMatch) return partialMatch;
  const partialAlias = Object.entries(aliases).find(([alias]) => normalized.includes(alias));
  if (partialAlias) return partialAlias[1];
  return "";
}
function normalizeWardrobeCategory(input) {
  return normalizeWardrobeEnumValue(input, WARDROBE_CATEGORIES, {
    tee: "Top",
    tshirt: "Top",
    "t-shirt": "Top",
    shirt: "Top",
    blouse: "Top",
    tank: "Top",
    sweater: "Top",
    hoodie: "Top",
    trouser: "Bottom",
    trousers: "Bottom",
    pants: "Bottom",
    jeans: "Bottom",
    skirt: "Bottom",
    shorts: "Bottom",
    leggings: "Bottom",
    gown: "Dress",
    jacket: "Outerwear",
    coat: "Outerwear",
    blazer: "Outerwear",
    sneaker: "Shoes",
    sneakers: "Shoes",
    sandal: "Shoes",
    sandals: "Shoes",
    boot: "Shoes",
    boots: "Shoes",
    handbag: "Bag",
    purse: "Bag",
    tote: "Bag",
    backpack: "Bag",
    belt: "Accessory",
    hat: "Accessory",
    scarf: "Accessory",
    jewelry: "Accessory",
    jewellery: "Accessory"
  });
}
function normalizeWardrobeColor(input) {
  return normalizeWardrobeEnumValue(input, WARDROBE_COLORS, {
    grey: "Gray",
    gray: "Gray",
    charcoal: "Gray",
    heather: "Gray",
    "dark heather": "Gray",
    ivory: "White",
    cream: "White",
    tan: "Beige",
    camel: "Beige",
    burgundy: "Red",
    maroon: "Red",
    olive: "Green",
    multicolor: "Multi",
    multicolour: "Multi",
    colorful: "Multi",
    colourful: "Multi"
  });
}
function normalizeWardrobePattern(input) {
  return normalizeWardrobeEnumValue(input, WARDROBE_PATTERNS, {
    plain: "Solid",
    stripe: "Striped",
    stripes: "Striped",
    checkered: "Checked",
    plaid: "Checked",
    print: "Graphic",
    printed: "Graphic",
    logo: "Graphic"
  });
}
function normalizeWardrobeShade(input) {
  const normalized = normalizeStringValue(input).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.includes("|")) return "";
  return normalized.split(" ").map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()).slice(0, 3).join(" ");
}
function inferWardrobeColorFromShade(shade) {
  const normalized = shade.trim().toLowerCase();
  if (!normalized) return "";
  if (SHADE_TO_BASE_COLOR[normalized]) return SHADE_TO_BASE_COLOR[normalized];
  const partial = Object.entries(SHADE_TO_BASE_COLOR).find(([key]) => normalized.includes(key));
  return partial ? partial[1] : "";
}
function normalizeWardrobeConfidence(input) {
  const confidence = Number(input);
  if (!Number.isFinite(confidence)) return 0;
  return Math.min(Math.max(confidence, 0), 1);
}
function buildWardrobeFallbackName(category, color) {
  const categoryLabel = category === "Top" ? "top" : category === "Bottom" ? "bottom" : category === "Outerwear" ? "outerwear" : category ? category.toLowerCase() : "item";
  return [color ? color.toLowerCase() : "", categoryLabel].filter(Boolean).join(" ").trim();
}
function isGenericWardrobeName(name) {
  const normalized = name.trim().toLowerCase();
  return normalized.length === 0 || normalized === "item" || normalized === "clothing item" || normalized === "fashion item" || normalized === "garment" || normalized === "product";
}
function isDevCreditGrantEnabled() {
  const override = normalizeStringValue(process.env.ENABLE_DEV_CREDIT_GRANTS).toLowerCase();
  if (override === "1" || override === "true" || override === "yes") {
    return true;
  }
  return process.env.NODE_ENV !== "production";
}
function resolveDevCreditGrantAmount(input) {
  const requestedAmount = Number(input);
  if (Number.isInteger(requestedAmount) && requestedAmount > 0) {
    return Math.min(requestedAmount, MAX_DEV_CREDIT_GRANT);
  }
  if (Number.isInteger(DEFAULT_DEV_CREDIT_GRANT) && DEFAULT_DEV_CREDIT_GRANT > 0) {
    return Math.min(DEFAULT_DEV_CREDIT_GRANT, MAX_DEV_CREDIT_GRANT);
  }
  return 50;
}
function normalizeRequestedItems(input) {
  if (!Array.isArray(input)) return [];
  return input.filter((entry) => Boolean(entry) && typeof entry === "object").map((entry) => {
    const name = normalizeStringValue(entry.name);
    const category = normalizeStringValue(entry.category);
    const color = normalizeStringValue(entry.color);
    const description = normalizeStringValue(entry.description);
    if (!name && !category && !color && !description) return null;
    return {
      name: name || "Unspecified item",
      category: category || "unspecified category",
      color: color || "unspecified color",
      description: description || void 0
    };
  }).filter((entry) => Boolean(entry));
}
function normalizeUploadedImages(input, imageInputMode) {
  if (!Array.isArray(input)) return [];
  const maxAllowed = MAX_IMAGE_COUNT_BY_MODE[imageInputMode];
  const sanitized = input.map((entry) => {
    if (typeof entry === "string") {
      const base642 = entry.trim();
      if (!base642) return null;
      return { base64: base642, mimeType: "image/jpeg" };
    }
    if (!entry || typeof entry !== "object") return null;
    const maybeEntry = entry;
    const base64 = typeof maybeEntry.base64 === "string" ? maybeEntry.base64.trim() : "";
    if (!base64) return null;
    const mimeType = typeof maybeEntry.mimeType === "string" && maybeEntry.mimeType.startsWith("image/") ? maybeEntry.mimeType : "image/jpeg";
    return { base64, mimeType };
  }).filter((value) => Boolean(value));
  if (sanitized.length > maxAllowed) {
    throw new Error(`You can upload up to ${maxAllowed} image(s) for this image mode.`);
  }
  const withinSizeLimit = sanitized.filter((image) => image.base64.length <= MAX_IMAGE_BASE64_LENGTH);
  const skippedCount = sanitized.length - withinSizeLimit.length;
  if (skippedCount > 0 && process.env.NODE_ENV !== "production") {
    console.warn(`Skipped ${skippedCount} oversized uploaded image(s)`);
  }
  return withinSizeLimit;
}
function sanitizeStylingResponse(raw) {
  const fallback = {
    lookName: "Curated Signature Look",
    description: "A polished outfit with strong proportions, coordinated tones, and a clean finish.",
    tips: [
      "Use contrast in texture to add depth.",
      "Keep accessories intentional and minimal.",
      "Balance structure with one softer piece."
    ],
    imagePrompt: "High-fashion editorial photo of a model in a cohesive outfit, soft focus, clean studio background, full body, realistic fabrics.",
    usedPieces: []
  };
  if (!raw || typeof raw !== "object") return fallback;
  const parsed = raw;
  const lookName = normalizeStringValue(parsed.lookName) || fallback.lookName;
  const description = normalizeStringValue(parsed.description) || fallback.description;
  const imagePrompt = normalizeStringValue(parsed.imagePrompt) || fallback.imagePrompt;
  const tips = normalizeStringList(parsed.tips).slice(0, 4);
  const usedPieces = normalizeStringList(parsed.usedPieces);
  return {
    lookName,
    description,
    imagePrompt,
    tips: tips.length > 0 ? tips : fallback.tips,
    usedPieces
  };
}
function tryParseJsonObject(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const maybeJson = trimmed.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(maybeJson);
      } catch {
        return {};
      }
    }
    return {};
  }
}
function buildStylePrompt(options) {
  const itemLines = options.items.map((item, index) => {
    const descriptionPart = normalizeStringValue(item.description);
    return `${index + 1}. ${item.name} (${item.category}, ${item.color}${descriptionPart ? `, ${descriptionPart}` : ""})`;
  });
  const promptParts = [];
  if (options.hasReferenceImages) {
    promptParts.push(
      "Using the attached image(s), select garments visible in them to create a brand-new outfit from scratch, following the instructions below:"
    );
  }
  promptParts.push(
    "You are Law Roach, a world-class celebrity stylist.",
    "Create one high-impact outfit using at least two clothing pieces whenever possible.",
    "Respond in English only.",
    "Do not include disclaimers, AI references, roleplay intros, or markdown.",
    "Return ONLY valid JSON with this exact schema:",
    `{
  "lookName": "short outfit title",
  "description": "2-4 concise sentences that describe the final styling",
  "tips": ["3 to 4 concise actionable tips"],
  "usedPieces": ["list each selected/required piece used in the look"],
  "imagePrompt": "clean, production-ready prompt for generating one ${STYLE_IMAGE_SIZE} image with soft focus and clean background"
}`,
    "Styling requirements:",
    `- Occasion: ${options.occasion || "Any occasion"}`,
    `- Client gender expression: ${options.gender ? options.gender.replace(/_/g, " ") : "Not specified"}`,
    `- Event details: ${options.event || "No extra event details"}`,
    `- Season: ${options.season || "No specific season"}`,
    `- Aesthetic: ${options.aesthetic || "No specific aesthetic"}`,
    `- Preferred color palette: ${options.colorPalette || "No fixed palette"}`,
    `- Required pieces: ${options.requiredPieces.length > 0 ? options.requiredPieces.join(", ") : "None explicitly required"}`
  );
  promptParts.push("Source mode rules (MANDATORY):");
  if (options.sourceMode === "photo_only") {
    promptParts.push(
      "- Build the outfit primarily from garments visible in the uploaded reference image(s).",
      "- Do not use hidden wardrobe memory or invent a saved closet.",
      options.allowExtraPieces ? '- You may add at most 2 subtle finishing pieces only when necessary. Mark each added item with "(added)" in usedPieces.' : "- Do not add extra garments that are not visible in the uploaded image(s).",
      "- Keep garment identity faithful to the reference image(s): same silhouette, cut, fabric feel, pattern, and base colors.",
      options.imageInputMode === "multi_item" ? "- Multi-item photo mode: combine visible garments across the uploaded images into one coherent outfit." : "- Single-item photo mode: prioritize garments from the uploaded image(s) exactly as shown."
    );
  }
  if (options.sourceMode === "saved_wardrobe") {
    promptParts.push(
      "- Use ONLY the structured wardrobe pieces provided in the request.",
      "- Do not add, invent, or suggest any extra garments as part of the final outfit.",
      "- If the selected wardrobe pieces are not enough for a perfect look, still build the best outfit possible using only those pieces.",
      '- In "usedPieces", include only pieces from the provided wardrobe list.'
    );
  }
  if (options.sourceMode === "saved_wardrobe_plus") {
    promptParts.push(
      "- Use the structured wardrobe pieces provided in the request as the main outfit foundation.",
      "- You may add at most 2 finishing pieces only if the outfit needs them to feel complete.",
      '- Any added piece must be clearly marked with "(added)" in usedPieces.',
      "- Prioritize the user's own wardrobe before adding anything new."
    );
  }
  if (itemLines.length > 0) {
    promptParts.push("Available wardrobe pieces:");
    promptParts.push(itemLines.join("\n"));
  } else {
    promptParts.push("No structured wardrobe list was provided. Infer pieces from text/image inputs.");
  }
  if (options.originalDescription) {
    promptParts.push(`Original outfit description: ${options.originalDescription}`);
  }
  if (options.originalTips && options.originalTips.length > 0) {
    promptParts.push(`Original tips: ${options.originalTips.join(" | ")}`);
  }
  if (options.forceModifyRequest) {
    promptParts.push(`Requested modifications: ${options.forceModifyRequest}`);
  }
  if (options.customPrompt) {
    promptParts.push(`Additional user request: ${options.customPrompt}`);
  }
  if (options.outputMode === "image") {
    promptParts.push(
      `The imagePrompt must be optimized for a single ${STYLE_IMAGE_SIZE} realistic editorial fashion shot with soft focus and a clean background.`
    );
  } else {
    promptParts.push("Prioritize concise and practical styling text output.");
  }
  return promptParts.join("\n");
}
function toGeminiInlineImageParts(uploadedImages) {
  return uploadedImages.map((image) => ({
    inlineData: {
      mimeType: image.mimeType || "image/jpeg",
      data: image.base64
    }
  }));
}
function buildImageGenerationPrompt(options) {
  const basePrefix = `High-fashion editorial portrait, full-body model, soft focus, clean background, 1:1 composition, ${STYLE_IMAGE_SIZE}`;
  const detailLabel = options.isModification ? "Modified outfit details" : "Outfit details";
  const selectedPiecesLine = options.usedPieces.length > 0 ? `Selected pieces: ${options.usedPieces.join(", ")}.` : "Selected pieces: derive them from the reference image(s).";
  if (!options.hasReferenceImages) {
    return `${basePrefix}, ${selectedPiecesLine} ${detailLabel.toLowerCase()}: ${options.imagePrompt}`;
  }
  const leadInstruction = "Using the attached image(s), select garments visible in them to create a brand-new outfit from scratch, following the instructions below:";
  const modeLine = options.imageInputMode === "multi_item" ? "When multiple reference images are provided, use garments from those images without changing their identity." : "Use garments from the single reference image as the primary outfit pieces.";
  return [
    leadInstruction,
    basePrefix,
    "Reference-image constraints (MANDATORY): use uploaded image(s) as the source for primary garments.",
    "Do not remodel or replace core garments; keep silhouette, cut, fabric feel, patterns, and base colors faithful.",
    modeLine,
    selectedPiecesLine,
    "You may add only minimal finishing pieces if absent (belt, shoes, subtle accessories).",
    `${detailLabel}: ${options.imagePrompt}`
  ].join("\n");
}
function getObjectRecord(value) {
  return value && typeof value === "object" ? value : null;
}
function extractGeminiText(responseJson) {
  const root = getObjectRecord(responseJson);
  if (!root) return "";
  const candidates = Array.isArray(root.candidates) ? root.candidates : [];
  for (const candidate of candidates) {
    const candidateRecord = getObjectRecord(candidate);
    const content = getObjectRecord(candidateRecord?.content);
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    for (const part of parts) {
      const partRecord = getObjectRecord(part);
      const text2 = partRecord?.text;
      if (typeof text2 === "string" && text2.trim().length > 0) {
        return text2;
      }
    }
  }
  return "";
}
function extractGeminiImageBase64(responseJson) {
  const root = getObjectRecord(responseJson);
  if (!root) return void 0;
  const candidates = Array.isArray(root.candidates) ? root.candidates : [];
  for (const candidate of candidates) {
    const candidateRecord = getObjectRecord(candidate);
    const content = getObjectRecord(candidateRecord?.content);
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    for (const part of parts) {
      const partRecord = getObjectRecord(part);
      const inlineData = getObjectRecord(partRecord?.inlineData);
      const mimeType = inlineData?.mimeType;
      const data = inlineData?.data;
      if (typeof mimeType === "string" && mimeType.startsWith("image/") && typeof data === "string" && data.length > 0) {
        return data;
      }
    }
  }
  return void 0;
}
async function generateGeminiContent(options) {
  const apiKey = getGeminiApiKey();
  const rawModelName = normalizeStringValue(options.model);
  const modelName = rawModelName.startsWith("models/") ? rawModelName.slice("models/".length) : rawModelName;
  if (!modelName) {
    throw new Error("Gemini model name is missing.");
  }
  const url = `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(modelName)}:generateContent`;
  const generationConfig = {};
  if (options.responseMimeType) {
    generationConfig.responseMimeType = options.responseMimeType;
  }
  if (Number.isFinite(options.maxOutputTokens)) {
    generationConfig.maxOutputTokens = options.maxOutputTokens;
  }
  if (typeof options.temperature === "number") {
    generationConfig.temperature = options.temperature;
  }
  if (Array.isArray(options.responseModalities) && options.responseModalities.length > 0) {
    generationConfig.responseModalities = options.responseModalities;
  }
  const payload = {
    contents: [
      {
        role: "user",
        parts: options.parts
      }
    ]
  };
  if (Object.keys(generationConfig).length > 0) {
    payload.generationConfig = generationConfig;
  }
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(payload)
  });
  const rawText = await response.text();
  let parsed = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    const parsedRecord = getObjectRecord(parsed);
    const errorRecord = getObjectRecord(parsedRecord?.error);
    const remoteMessage = typeof errorRecord?.message === "string" ? errorRecord.message : typeof parsedRecord?.message === "string" ? parsedRecord.message : "";
    const message = remoteMessage || rawText || `Gemini API returned status ${response.status}`;
    throw new Error(`Gemini API error (${response.status}): ${message}`);
  }
  if (parsed === null) {
    throw new Error("Gemini API returned an unexpected non-JSON response.");
  }
  return parsed;
}
async function createStylingPlan({
  prompt,
  uploadedImages
}) {
  const parts = [
    { text: prompt },
    ...toGeminiInlineImageParts(uploadedImages)
  ];
  let rawContent = "{}";
  try {
    const response = await generateGeminiContent({
      model: DEFAULT_STYLE_TEXT_MODEL,
      parts,
      responseMimeType: "application/json",
      maxOutputTokens: 1200,
      temperature: 0.4
    });
    rawContent = extractGeminiText(response) || "{}";
  } catch (jsonModeError) {
    const errorMessage = toErrorMessage(jsonModeError, "").toLowerCase();
    const shouldFallback = errorMessage.includes("responsemimetype") || errorMessage.includes("json schema") || errorMessage.includes("response mime");
    if (!shouldFallback) {
      throw jsonModeError;
    }
    const fallbackResponse = await generateGeminiContent({
      model: DEFAULT_STYLE_TEXT_MODEL,
      parts,
      maxOutputTokens: 1200,
      temperature: 0.4
    });
    rawContent = extractGeminiText(fallbackResponse) || "{}";
    if (process.env.NODE_ENV !== "production") {
      console.warn("Gemini JSON mode unsupported, fallback used:", jsonModeError);
    }
  }
  return sanitizeStylingResponse(tryParseJsonObject(rawContent));
}
async function consumeCredits(userId, amount, feature) {
  if (!Number.isInteger(amount) || amount < 1) {
    throw new Error("Invalid credit amount");
  }
  const [user] = await db.select({ credits: users.credits }).from(users).where((0, import_drizzle_orm3.eq)(users.id, userId));
  if (!user || user.credits < amount) {
    return false;
  }
  const nextCredits = user.credits - amount;
  await db.update(users).set({ credits: nextCredits, updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm3.eq)(users.id, userId));
  await db.insert(creditTransactions).values({
    userId,
    type: "usage",
    amountCredits: -amount,
    source: "app",
    description: feature
  });
  return true;
}
async function refundCredits(userId, amount, reason) {
  if (!Number.isInteger(amount) || amount < 1) return;
  const [user] = await db.select({ credits: users.credits }).from(users).where((0, import_drizzle_orm3.eq)(users.id, userId));
  if (!user) return;
  await db.update(users).set({ credits: user.credits + amount, updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm3.eq)(users.id, userId));
  await db.insert(creditTransactions).values({
    userId,
    type: "refund",
    amountCredits: amount,
    source: "app",
    description: reason
  });
}
function getDefaultBaseUrl(req) {
  const publicWebUrl = process.env.PUBLIC_WEB_URL;
  if (publicWebUrl) return publicWebUrl.replace(/\/+$/, "");
  const proto = firstHeaderValue(req.headers["x-forwarded-proto"]) || req.protocol || "https";
  const host = firstHeaderValue(req.headers["x-forwarded-host"]) || req.get("host") || "localhost:5000";
  return `${proto}://${host}`.replace(/\/+$/, "");
}
function getRawBodyText(req) {
  const rawBody = req.rawBody;
  if (Buffer.isBuffer(rawBody)) return rawBody.toString("utf8");
  if (typeof rawBody === "string") return rawBody;
  if (rawBody instanceof Uint8Array) return Buffer.from(rawBody).toString("utf8");
  return JSON.stringify(req.body ?? {});
}
function parseStripeSignatureHeader(headerValue) {
  const entries = headerValue.split(",").map((entry) => entry.trim()).filter(Boolean);
  let timestamp2 = "";
  const signatures = [];
  for (const entry of entries) {
    const [key, value] = entry.split("=");
    if (!key || !value) continue;
    if (key === "t") timestamp2 = value;
    if (key === "v1") signatures.push(value);
  }
  if (!timestamp2 || signatures.length === 0) return null;
  return { timestamp: timestamp2, signatures };
}
function verifyStripeWebhookSignature(payload, headerValue, secret) {
  const parsed = parseStripeSignatureHeader(headerValue);
  if (!parsed) return false;
  const nowSec = Math.floor(Date.now() / 1e3);
  const timestampSec = Number(parsed.timestamp);
  if (!Number.isFinite(timestampSec)) return false;
  if (Math.abs(nowSec - timestampSec) > STRIPE_WEBHOOK_TOLERANCE_SEC) return false;
  const signedPayload = `${parsed.timestamp}.${payload}`;
  const expected = (0, import_node_crypto.createHmac)("sha256", secret).update(signedPayload, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return parsed.signatures.some((candidate) => {
    if (!/^[0-9a-fA-F]+$/.test(candidate) || candidate.length !== expected.length) return false;
    const candidateBuffer = Buffer.from(candidate, "hex");
    if (candidateBuffer.length !== expectedBuffer.length) return false;
    return (0, import_node_crypto.timingSafeEqual)(candidateBuffer, expectedBuffer);
  });
}
function extractStripeInvoiceMetadata(invoice) {
  const metadataSources = [
    invoice.subscription_details?.metadata,
    invoice.parent?.subscription_details?.metadata,
    invoice.lines?.data?.[0]?.metadata,
    invoice.metadata
  ];
  const merged = {};
  for (const source of metadataSources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === "string" && value.trim().length > 0) {
        merged[key] = value.trim();
      }
    }
  }
  return merged;
}
async function processPaidStripeSession(session) {
  if (session.payment_status !== "paid") return;
  const metadata = session.metadata ?? {};
  const userId = normalizeStringValue(metadata.userId);
  if (!userId) return;
  const itemType = normalizeStringValue(metadata.itemType);
  const itemId = normalizeStringValue(metadata.itemId);
  const paymentIntentId = normalizeStringValue(session.payment_intent || "") || null;
  const [existingBySession] = await db.select({ id: creditTransactions.id }).from(creditTransactions).where((0, import_drizzle_orm3.eq)(creditTransactions.stripeSessionId, session.id));
  if (existingBySession) return;
  if (paymentIntentId) {
    const [existingByIntent] = await db.select({ id: creditTransactions.id, stripeSessionId: creditTransactions.stripeSessionId }).from(creditTransactions).where((0, import_drizzle_orm3.eq)(creditTransactions.stripePaymentIntentId, paymentIntentId));
    if (existingByIntent) {
      if (!existingByIntent.stripeSessionId) {
        await db.update(creditTransactions).set({ stripeSessionId: session.id }).where((0, import_drizzle_orm3.eq)(creditTransactions.id, existingByIntent.id));
      }
      return;
    }
  }
  const [user] = await db.select().from(users).where((0, import_drizzle_orm3.eq)(users.id, userId));
  if (!user) return;
  if (itemType === "subscription") {
    const plan = SUBSCRIPTION_PLANS.find((entry) => entry.id === itemId);
    if (!plan) return;
    const renewal = /* @__PURE__ */ new Date();
    renewal.setMonth(renewal.getMonth() + 1);
    await db.update(users).set({
      credits: user.credits + plan.creditsPerMonth,
      subscriptionPlan: plan.id,
      subscriptionRenewAt: renewal,
      updatedAt: /* @__PURE__ */ new Date()
    }).where((0, import_drizzle_orm3.eq)(users.id, user.id));
    await db.insert(creditTransactions).values({
      userId: user.id,
      type: "subscription",
      amountCredits: plan.creditsPerMonth,
      amountUsdCents: plan.priceCents,
      source: "stripe",
      description: `${plan.name} subscription`,
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentId
    });
    return;
  }
  const pkg = CREDIT_PACKAGES.find((entry) => entry.id === itemId);
  const creditsFromMetadata = Number.parseInt(metadata.credits || "0", 10);
  const creditsToAdd = pkg?.credits ?? creditsFromMetadata;
  if (!Number.isInteger(creditsToAdd) || creditsToAdd < 1) return;
  await db.update(users).set({
    credits: user.credits + creditsToAdd,
    updatedAt: /* @__PURE__ */ new Date()
  }).where((0, import_drizzle_orm3.eq)(users.id, user.id));
  await db.insert(creditTransactions).values({
    userId: user.id,
    type: "purchase",
    amountCredits: creditsToAdd,
    amountUsdCents: pkg?.priceCents ?? null,
    source: "stripe",
    description: "Credit package purchase",
    stripeSessionId: session.id,
    stripePaymentIntentId: paymentIntentId
  });
}
async function processPaidStripeInvoice(invoice) {
  const billingReason = normalizeStringValue(invoice.billing_reason).toLowerCase();
  if (billingReason !== "subscription_cycle") return;
  const paymentIntentId = normalizeStringValue(invoice.payment_intent || "");
  if (!paymentIntentId) return;
  const [existing] = await db.select({ id: creditTransactions.id }).from(creditTransactions).where((0, import_drizzle_orm3.eq)(creditTransactions.stripePaymentIntentId, paymentIntentId));
  if (existing) return;
  const metadata = extractStripeInvoiceMetadata(invoice);
  const userId = normalizeStringValue(metadata.userId);
  if (!userId) return;
  const planId = normalizeStringValue(metadata.itemId || metadata.planId);
  const plan = SUBSCRIPTION_PLANS.find((entry) => entry.id === planId);
  const creditsFromMetadata = Number.parseInt(metadata.credits || "", 10);
  const creditsToAdd = plan?.creditsPerMonth ?? creditsFromMetadata;
  if (!Number.isInteger(creditsToAdd) || creditsToAdd < 1) return;
  const [user] = await db.select().from(users).where((0, import_drizzle_orm3.eq)(users.id, userId));
  if (!user) return;
  const renewal = /* @__PURE__ */ new Date();
  renewal.setMonth(renewal.getMonth() + 1);
  await db.update(users).set({
    credits: user.credits + creditsToAdd,
    subscriptionPlan: plan?.id ?? user.subscriptionPlan,
    subscriptionRenewAt: renewal,
    updatedAt: /* @__PURE__ */ new Date()
  }).where((0, import_drizzle_orm3.eq)(users.id, user.id));
  await db.insert(creditTransactions).values({
    userId: user.id,
    type: "subscription",
    amountCredits: creditsToAdd,
    amountUsdCents: typeof invoice.amount_paid === "number" && invoice.amount_paid > 0 ? invoice.amount_paid : plan?.priceCents ?? null,
    source: "stripe",
    description: plan ? `${plan.name} subscription renewal` : "Subscription renewal",
    stripeSessionId: invoice.id,
    stripePaymentIntentId: paymentIntentId
  });
}
async function processStripeCreditReversal(paymentIntentId, reversalType) {
  const markerId = `${reversalType}_${paymentIntentId}`;
  const [alreadyProcessed] = await db.select({ id: creditTransactions.id }).from(creditTransactions).where((0, import_drizzle_orm3.eq)(creditTransactions.stripePaymentIntentId, markerId));
  if (alreadyProcessed) return;
  const originalTransactions = await db.select().from(creditTransactions).where((0, import_drizzle_orm3.eq)(creditTransactions.stripePaymentIntentId, paymentIntentId));
  const original = originalTransactions.find(
    (entry) => (entry.type === "purchase" || entry.type === "subscription") && entry.amountCredits > 0
  );
  if (!original) return;
  const [user] = await db.select({
    id: users.id,
    credits: users.credits,
    subscriptionPlan: users.subscriptionPlan
  }).from(users).where((0, import_drizzle_orm3.eq)(users.id, original.userId));
  if (!user) return;
  const creditsToDeduct = Math.max(original.amountCredits, 0);
  const nextCredits = Math.max(user.credits - creditsToDeduct, 0);
  const shouldClearSubscription = original.type === "subscription";
  const userUpdate = {
    credits: nextCredits,
    updatedAt: /* @__PURE__ */ new Date()
  };
  if (shouldClearSubscription) {
    userUpdate.subscriptionPlan = null;
    userUpdate.subscriptionRenewAt = null;
  }
  await db.update(users).set(userUpdate).where((0, import_drizzle_orm3.eq)(users.id, user.id));
  await db.insert(creditTransactions).values({
    userId: user.id,
    type: "refund",
    amountCredits: -creditsToDeduct,
    amountUsdCents: typeof original.amountUsdCents === "number" && original.amountUsdCents > 0 ? -Math.abs(original.amountUsdCents) : null,
    source: "stripe",
    description: reversalType === "refund" ? "Stripe refund" : "Stripe dispute chargeback",
    stripePaymentIntentId: markerId
  });
}
async function createGoogleJwt(serviceAccount) {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1e3);
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };
  const headerPart = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadPart = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${headerPart}.${payloadPart}`;
  const signer = (0, import_node_crypto.createSign)("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key, "base64url");
  return `${signingInput}.${signature}`;
}
async function getGoogleAccessToken(jwt) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  if (!response.ok) {
    throw new Error("Failed to get Google access token");
  }
  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error("Google access token is missing from response");
  }
  return payload.access_token;
}
async function registerRoutes(app2) {
  app2.get("/api/health", (_req, res) => {
    const headerRequestId = firstHeaderValue(_req.headers["x-client-request-id"]);
    return res.json({
      status: "ok",
      service: "style-assistant-api",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      requestId: headerRequestId || null,
      nodeEnv: process.env.NODE_ENV || "unknown"
    });
  });
  app2.post("/api/auth/register", async (req, res) => {
    try {
      const { name, email, password } = req.body ?? {};
      if (!name?.trim() || !email?.trim() || !password?.trim()) {
        return res.status(400).json({ error: "Name, email and password are required" });
      }
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: "Invalid email address" });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must have at least 8 characters" });
      }
      const normalizedEmail = normalizeEmail(email);
      const [existing] = await db.select().from(users).where((0, import_drizzle_orm3.eq)(users.email, normalizedEmail));
      if (existing) {
        return res.status(400).json({ error: "Email already registered" });
      }
      const [newUser] = await db.insert(users).values({
        id: (0, import_node_crypto.randomUUID)(),
        email: normalizedEmail,
        name: name.trim(),
        passwordHash: hashPassword(password),
        authProvider: "email",
        credits: getInitialCredits()
      }).returning();
      const accessToken = generateAccessToken({
        id: newUser.id,
        email: newUser.email,
        name: newUser.name
      });
      const refreshToken = generateRefreshToken();
      await createSession(newUser.id, refreshToken);
      res.status(201).json({
        user: sanitizeUser(newUser),
        accessToken,
        refreshToken
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ error: toErrorMessage(error, "Registration failed") });
    }
  });
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body ?? {};
      if (!email?.trim() || !password?.trim()) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      const [user] = await db.select().from(users).where((0, import_drizzle_orm3.eq)(users.email, normalizeEmail(email)));
      if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      const accessToken = generateAccessToken({
        id: user.id,
        email: user.email,
        name: user.name
      });
      const refreshToken = generateRefreshToken();
      await createSession(user.id, refreshToken);
      res.json({
        user: sanitizeUser(user),
        accessToken,
        refreshToken
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: toErrorMessage(error, "Login failed") });
    }
  });
  app2.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { email, newPassword } = req.body ?? {};
      if (!email?.trim() || !newPassword?.trim()) {
        return res.status(400).json({ error: "Email and new password are required" });
      }
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: "Invalid email address" });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: "Password must have at least 8 characters" });
      }
      const normalizedEmail = normalizeEmail(email);
      const [user] = await db.select().from(users).where((0, import_drizzle_orm3.eq)(users.email, normalizedEmail));
      if (!user) {
        return res.status(404).json({ error: "No account found for this email" });
      }
      if (user.authProvider !== "email" || !user.passwordHash) {
        return res.status(400).json({
          error: "This account uses social sign-in. Use Apple or Google sign-in instead."
        });
      }
      const [updated] = await db.update(users).set({
        passwordHash: hashPassword(newPassword),
        updatedAt: /* @__PURE__ */ new Date()
      }).where((0, import_drizzle_orm3.eq)(users.id, user.id)).returning({ id: users.id });
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      await revokeAllSessions(user.id);
      res.json({ success: true, message: "Password reset successful" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: toErrorMessage(error, "Password reset failed") });
    }
  });
  app2.post("/api/auth/social", async (req, res) => {
    try {
      const { provider, idToken, identityToken, email, name } = req.body ?? {};
      if (!provider || !["apple", "google"].includes(provider)) {
        return res.status(400).json({ error: "Invalid provider" });
      }
      let providerId = "";
      let normalizedEmail = null;
      let resolvedName = typeof name === "string" && name.trim().length > 0 ? name.trim() : null;
      if (provider === "google") {
        if (typeof idToken !== "string" || idToken.length === 0) {
          return res.status(400).json({ error: "Google idToken is required" });
        }
        const googleIdentity = await verifyGoogleIdToken(idToken);
        providerId = googleIdentity.sub;
        normalizedEmail = normalizeEmail(googleIdentity.email);
        if (!resolvedName) {
          resolvedName = googleIdentity.name || normalizedEmail.split("@")[0];
        }
      } else {
        if (typeof identityToken !== "string" || identityToken.length === 0) {
          return res.status(400).json({ error: "Apple identityToken is required" });
        }
        const appleIdentity = await verifyAppleIdentityToken(identityToken);
        providerId = appleIdentity.sub;
        const normalizedRequestEmail = typeof email === "string" && email.trim().length > 0 ? normalizeEmail(email) : null;
        normalizedEmail = appleIdentity.email ? normalizeEmail(appleIdentity.email) : normalizedRequestEmail;
        if (!resolvedName) {
          resolvedName = "Apple User";
        }
      }
      const [existingByProvider] = await db.select().from(users).where((0, import_drizzle_orm3.and)((0, import_drizzle_orm3.eq)(users.authProvider, provider), (0, import_drizzle_orm3.eq)(users.providerId, providerId)));
      let user = existingByProvider;
      if (!user) {
        if (!normalizedEmail) {
          return res.status(400).json({
            error: "No email received from provider. Please sign in again and share your email."
          });
        }
        if (!isValidEmail(normalizedEmail)) {
          return res.status(400).json({ error: "Invalid email address" });
        }
        const [existingByEmail] = await db.select().from(users).where((0, import_drizzle_orm3.eq)(users.email, normalizedEmail));
        if (existingByEmail && existingByEmail.authProvider === "email") {
          return res.status(400).json({
            error: "This email is already used by an email/password account"
          });
        }
        if (existingByEmail) {
          const [updated] = await db.update(users).set({
            authProvider: provider,
            providerId,
            name: resolvedName || existingByEmail.name,
            updatedAt: /* @__PURE__ */ new Date()
          }).where((0, import_drizzle_orm3.eq)(users.id, existingByEmail.id)).returning();
          user = updated;
        } else {
          const [created] = await db.insert(users).values({
            id: (0, import_node_crypto.randomUUID)(),
            email: normalizedEmail,
            name: resolvedName || normalizedEmail.split("@")[0],
            authProvider: provider,
            providerId,
            credits: getInitialCredits()
          }).returning();
          user = created;
        }
      }
      const accessToken = generateAccessToken({
        id: user.id,
        email: user.email,
        name: user.name
      });
      const refreshToken = generateRefreshToken();
      await createSession(user.id, refreshToken);
      res.status(201).json({
        user: sanitizeUser(user),
        accessToken,
        refreshToken
      });
    } catch (error) {
      console.error("Social login error:", error);
      res.status(500).json({ error: toErrorMessage(error, "Social login failed") });
    }
  });
  app2.post("/api/auth/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body ?? {};
      if (!refreshToken) {
        return res.status(400).json({ error: "Refresh token is required" });
      }
      const userId = await validateRefreshToken(refreshToken);
      if (!userId) {
        return res.status(401).json({ error: "Invalid or expired refresh token" });
      }
      const [user] = await db.select().from(users).where((0, import_drizzle_orm3.eq)(users.id, userId));
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      await revokeSession(refreshToken);
      const nextRefreshToken = generateRefreshToken();
      await createSession(user.id, nextRefreshToken);
      res.json({
        accessToken: generateAccessToken({
          id: user.id,
          email: user.email,
          name: user.name
        }),
        refreshToken: nextRefreshToken
      });
    } catch (error) {
      console.error("Refresh error:", error);
      res.status(500).json({ error: toErrorMessage(error, "Failed to refresh session") });
    }
  });
  app2.post("/api/auth/logout", authMiddleware, async (req, res) => {
    try {
      const { refreshToken } = req.body ?? {};
      if (refreshToken) {
        await revokeSession(refreshToken);
      } else if (req.user?.id) {
        await revokeAllSessions(req.user.id);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Logout failed" });
    }
  });
  app2.delete("/api/auth/account", authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const [deletedUser] = await db.delete(users).where((0, import_drizzle_orm3.eq)(users.id, userId)).returning({ id: users.id });
      if (!deletedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true, message: "Account deleted successfully" });
    } catch (error) {
      console.error("Delete account error:", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });
  app2.get("/api/profile", authMiddleware, async (req, res) => {
    try {
      const [user] = await db.select().from(users).where((0, import_drizzle_orm3.eq)(users.id, req.user.id));
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(sanitizeUser(user));
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({ error: "Failed to load profile" });
    }
  });
  app2.put("/api/profile", authMiddleware, async (req, res) => {
    try {
      const { name, stylePreferences, favoriteLooks, notificationsEnabled, styleGender } = req.body ?? {};
      const updateData = { updatedAt: /* @__PURE__ */ new Date() };
      if (typeof name === "string" && name.trim()) {
        updateData.name = name.trim();
      }
      if (Array.isArray(stylePreferences)) {
        updateData.stylePreferences = stylePreferences.filter((x) => typeof x === "string");
      }
      if (Array.isArray(favoriteLooks)) {
        updateData.favoriteLooks = favoriteLooks.filter((x) => typeof x === "string");
      }
      if (typeof notificationsEnabled === "boolean") {
        updateData.notificationsEnabled = notificationsEnabled;
      }
      if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "styleGender")) {
        const normalizedStyleGender = normalizeStyleGender(styleGender);
        updateData.styleGender = normalizedStyleGender || null;
      }
      const [updatedUser] = await db.update(users).set(updateData).where((0, import_drizzle_orm3.eq)(users.id, req.user.id)).returning();
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(sanitizeUser(updatedUser));
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });
  app2.post("/api/wardrobe/suggest", authMiddleware, async (req, res) => {
    try {
      const imageBase64 = normalizeStringValue(req.body?.imageBase64);
      if (!imageBase64) {
        return res.status(400).json({ error: "imageBase64 is required" });
      }
      const requestedModel = normalizeWardrobeSuggestModel(req.body?.model);
      const rawMimeType = normalizeStringValue(req.body?.mimeType).toLowerCase();
      const mimeType = rawMimeType.startsWith("image/") ? rawMimeType : "image/jpeg";
      const workerUrl = getWardrobeSuggestWorkerUrl();
      const timeoutController = new AbortController();
      const timeoutHandle = setTimeout(() => timeoutController.abort(), WARDROBE_SUGGEST_TIMEOUT_MS);
      let workerResponse;
      try {
        workerResponse = await fetch(workerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            imageBase64,
            mimeType,
            model: requestedModel
          }),
          signal: timeoutController.signal
        });
      } finally {
        clearTimeout(timeoutHandle);
      }
      const workerText = await workerResponse.text();
      let workerPayload = {};
      try {
        workerPayload = workerText ? JSON.parse(workerText) : {};
      } catch {
        workerPayload = {};
      }
      if (!workerResponse.ok) {
        const workerErrorMessage = normalizeStringValue(workerPayload?.error) || normalizeStringValue(workerPayload?.details) || workerText || "Wardrobe suggestion worker returned an error.";
        return res.status(502).json({ error: workerErrorMessage });
      }
      const rawHintText = normalizeStringValue(workerPayload.raw) || normalizeStringValue(workerPayload.details);
      const candidateName = normalizeStringValue(workerPayload.name).slice(0, 80);
      const normalizedName = isGenericWardrobeName(candidateName) ? "" : candidateName;
      const normalizedCategory = normalizeWardrobeCategory(
        workerPayload.category || rawHintText || normalizedName
      );
      const normalizedShade = normalizeWardrobeShade(workerPayload.shade);
      const inferredColorFromShade = inferWardrobeColorFromShade(normalizedShade);
      const normalizedColor = normalizeWardrobeColor(
        workerPayload.color || inferredColorFromShade || rawHintText || normalizedName
      );
      const normalizedPattern = normalizeWardrobePattern(workerPayload.pattern || rawHintText || normalizedName);
      const normalizedConfidence = normalizeWardrobeConfidence(workerPayload.confidence);
      const modelUsed = normalizeWardrobeSuggestModel(workerPayload.modelUsed);
      const workerRaisedError = normalizeStringValue(workerPayload.error || workerPayload.details);
      if (!normalizedName && !normalizedCategory && !normalizedColor && workerRaisedError) {
        return res.status(502).json({ error: workerRaisedError });
      }
      return res.json({
        name: normalizedName || buildWardrobeFallbackName(normalizedCategory, normalizedColor),
        category: normalizedCategory,
        color: normalizedColor,
        shade: normalizedShade,
        pattern: normalizedPattern,
        confidence: normalizedConfidence,
        modelUsed: modelUsed === "auto" ? "" : modelUsed
      });
    } catch (error) {
      console.error("Wardrobe suggest error:", error);
      const message = toErrorMessage(error, "Failed to suggest wardrobe details");
      const normalizedMessage = message.toLowerCase();
      const isWorkerConnectivityError = normalizedMessage.includes("fetch failed") || normalizedMessage.includes("network") || normalizedMessage.includes("timed out") || normalizedMessage.includes("aborted");
      if (isWorkerConnectivityError) {
        return res.status(502).json({
          error: "Wardrobe suggestion service is unavailable. Check WARDROBE_SUGGEST_WORKER_URL."
        });
      }
      return res.status(500).json({ error: message });
    }
  });
  app2.post("/api/stripe/webhook", async (req, res) => {
    try {
      const payloadText = getRawBodyText(req);
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      const signatureHeader = firstHeaderValue(req.headers["stripe-signature"]);
      if (!secret && process.env.NODE_ENV === "production") {
        console.error("STRIPE_WEBHOOK_SECRET is required in production");
        return res.status(500).json({ error: "Stripe webhook is not configured" });
      }
      if (secret) {
        if (!signatureHeader || !verifyStripeWebhookSignature(payloadText, signatureHeader, secret)) {
          return res.status(400).json({ error: "Invalid Stripe webhook signature" });
        }
      }
      const event = req.body && typeof req.body === "object" ? req.body : JSON.parse(payloadText || "{}");
      const eventType = normalizeStringValue(event.type);
      const payload = event.data?.object;
      if (!eventType || !payload || typeof payload !== "object") {
        return res.status(400).json({ error: "Invalid Stripe webhook payload" });
      }
      if (eventType === "checkout.session.completed") {
        await processPaidStripeSession(payload);
      } else if (eventType === "invoice.paid") {
        await processPaidStripeInvoice(payload);
      } else if (eventType === "charge.refunded") {
        const paymentIntentId = normalizeStringValue(payload.payment_intent);
        if (paymentIntentId) {
          await processStripeCreditReversal(paymentIntentId, "refund");
        }
      } else if (eventType === "charge.dispute.created") {
        const paymentIntentId = normalizeStringValue(payload.payment_intent);
        if (paymentIntentId) {
          await processStripeCreditReversal(paymentIntentId, "dispute");
        }
      }
      return res.json({ received: true });
    } catch (error) {
      console.error("Stripe webhook error:", error);
      return res.status(500).json({ error: "Failed to process Stripe webhook" });
    }
  });
  app2.get("/api/credits", authMiddleware, async (req, res) => {
    try {
      const [user] = await db.select({ credits: users.credits, subscription: users.subscriptionPlan }).from(users).where((0, import_drizzle_orm3.eq)(users.id, req.user.id));
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Get credits error:", error);
      res.status(500).json({ error: "Failed to load credits" });
    }
  });
  app2.post("/api/credits/use", authMiddleware, async (req, res) => {
    try {
      const { feature: rawFeature } = req.body ?? {};
      const feature = normalizeStringValue(rawFeature) || "style_generation";
      const consumed = await consumeCredits(req.user.id, 1, feature);
      if (!consumed) {
        return res.status(402).json({ error: "Not enough credits" });
      }
      const [user] = await db.select({ credits: users.credits }).from(users).where((0, import_drizzle_orm3.eq)(users.id, req.user.id));
      res.json({ success: true, credits: user?.credits ?? 0 });
    } catch (error) {
      console.error("Use credit error:", error);
      res.status(500).json({ error: "Failed to use credit" });
    }
  });
  app2.post("/api/credits/dev-grant", authMiddleware, async (req, res) => {
    try {
      if (!isDevCreditGrantEnabled()) {
        return res.status(403).json({ error: "Developer credit grants are disabled." });
      }
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const grantAmount = resolveDevCreditGrantAmount(req.body?.amount);
      const [user] = await db.select({ credits: users.credits }).from(users).where((0, import_drizzle_orm3.eq)(users.id, userId));
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const nextCredits = user.credits + grantAmount;
      await db.update(users).set({ credits: nextCredits, updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm3.eq)(users.id, userId));
      await db.insert(creditTransactions).values({
        userId,
        type: "purchase",
        amountCredits: grantAmount,
        amountUsdCents: 0,
        source: "manual",
        description: "Developer test credit grant"
      });
      return res.json({
        success: true,
        grantedCredits: grantAmount,
        credits: nextCredits
      });
    } catch (error) {
      console.error("Dev grant credits error:", error);
      return res.status(500).json({ error: toErrorMessage(error, "Failed to grant test credits") });
    }
  });
  app2.get("/api/credits/packages", (_req, res) => {
    res.json(
      CREDIT_PACKAGES.map((pkg) => ({
        ...pkg,
        price: pkg.priceCents / 100
      }))
    );
  });
  app2.get("/api/credits/transactions", authMiddleware, async (req, res) => {
    try {
      const rows = await db.select().from(creditTransactions).where((0, import_drizzle_orm3.eq)(creditTransactions.userId, req.user.id)).orderBy((0, import_drizzle_orm3.desc)(creditTransactions.createdAt)).limit(50);
      res.json(rows);
    } catch (error) {
      console.error("Get transactions error:", error);
      res.status(500).json({ error: "Failed to load transactions" });
    }
  });
  app2.post("/api/credits/subscription", authMiddleware, async (req, res) => {
    return res.status(410).json({
      error: "Direct subscription activation is disabled. Use /api/credits/checkout to start a paid subscription."
    });
  });
  app2.post("/api/credits/checkout", authMiddleware, async (req, res) => {
    try {
      const {
        itemType: rawItemType,
        itemId: rawItemId,
        successUrl: rawSuccessUrl,
        cancelUrl: rawCancelUrl
      } = req.body ?? {};
      const itemType = normalizeStringValue(rawItemType);
      const itemId = normalizeStringValue(rawItemId);
      const successUrl = normalizeStringValue(rawSuccessUrl);
      const cancelUrl = normalizeStringValue(rawCancelUrl);
      if (!itemType || !itemId) {
        return res.status(400).json({ error: "itemType and itemId are required" });
      }
      const [user] = await db.select().from(users).where((0, import_drizzle_orm3.eq)(users.id, req.user.id));
      if (!user) return res.status(404).json({ error: "User not found" });
      const defaultBaseUrl = getDefaultBaseUrl(req);
      const mode = itemType === "subscription" ? "subscription" : "payment";
      const safeSuccessUrl = successUrl.length > 0 ? successUrl : `${defaultBaseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
      const safeCancelUrl = cancelUrl.length > 0 ? cancelUrl : `${defaultBaseUrl}/credits`;
      if (mode === "payment") {
        const pkg = CREDIT_PACKAGES.find((p) => p.id === itemId);
        if (!pkg) return res.status(400).json({ error: "Invalid package" });
        const session2 = await createStripeCheckoutSession({
          mode,
          customerEmail: user.email,
          customerName: user.name,
          productName: `${pkg.credits} Credits`,
          unitAmountCents: pkg.priceCents,
          successUrl: safeSuccessUrl,
          cancelUrl: safeCancelUrl,
          clientReferenceId: user.id,
          metadata: {
            userId: user.id,
            itemType: "package",
            itemId: pkg.id,
            credits: String(pkg.credits)
          }
        });
        return res.json({ url: session2.url, sessionId: session2.id });
      }
      const plan = SUBSCRIPTION_PLANS.find((p) => p.id === itemId);
      if (!plan) return res.status(400).json({ error: "Invalid subscription plan" });
      const session = await createStripeCheckoutSession({
        mode: "subscription",
        customerEmail: user.email,
        customerName: user.name,
        productName: `${plan.name} Subscription`,
        unitAmountCents: plan.priceCents,
        successUrl: safeSuccessUrl,
        cancelUrl: safeCancelUrl,
        clientReferenceId: user.id,
        metadata: {
          userId: user.id,
          itemType: "subscription",
          itemId: plan.id,
          credits: String(plan.creditsPerMonth)
        }
      });
      return res.json({ url: session.url, sessionId: session.id });
    } catch (error) {
      console.error("Checkout error:", error);
      res.status(500).json({ error: toErrorMessage(error, "Failed to create checkout session") });
    }
  });
  app2.get("/api/credits/verify-session/:sessionId", authMiddleware, async (req, res) => {
    try {
      const sessionId = normalizeStringValue(req.params.sessionId);
      if (!sessionId) {
        return res.status(400).json({ error: "Missing session id" });
      }
      const session = await retrieveStripeCheckoutSession(sessionId);
      if (session.payment_status !== "paid") {
        return res.json({ success: false, status: session.payment_status || session.status });
      }
      const userId = session.metadata?.userId;
      if (!userId || userId !== req.user.id) {
        return res.status(403).json({ error: "Session does not belong to this user" });
      }
      await processPaidStripeSession(session);
      const [updatedUser] = await db.select({ credits: users.credits, subscription: users.subscriptionPlan }).from(users).where((0, import_drizzle_orm3.eq)(users.id, req.user.id));
      res.json({
        success: true,
        credits: updatedUser?.credits || 0,
        subscription: updatedUser?.subscription || null
      });
    } catch (error) {
      console.error("Verify session error:", error);
      res.status(500).json({ error: toErrorMessage(error, "Failed to verify payment session") });
    }
  });
  app2.post("/api/credits/apple-verify", authMiddleware, async (req, res) => {
    try {
      const userId = req.user.id;
      const receiptData = normalizeStringValue(req.body?.receiptData);
      const productId = normalizeStringValue(req.body?.productId);
      if (!receiptData || !productId) {
        return res.status(400).json({ success: false, error: "Missing receipt data or product ID" });
      }
      const expectedCredits = APPLE_IAP_PRODUCT_CREDITS[productId];
      if (!expectedCredits) {
        return res.status(400).json({ success: false, error: "Unknown Apple product ID" });
      }
      const verifyReceipt = async (url) => {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            "receipt-data": receiptData,
            password: process.env.APPLE_SHARED_SECRET || "",
            "exclude-old-transactions": true
          })
        });
        return response.json();
      };
      let appleResult = await verifyReceipt(
        process.env.NODE_ENV === "production" ? "https://buy.itunes.apple.com/verifyReceipt" : "https://sandbox.itunes.apple.com/verifyReceipt"
      );
      if (appleResult?.status === 21007) {
        appleResult = await verifyReceipt("https://sandbox.itunes.apple.com/verifyReceipt");
      } else if (appleResult?.status === 21008) {
        appleResult = await verifyReceipt("https://buy.itunes.apple.com/verifyReceipt");
      }
      if (appleResult?.status !== 0) {
        return res.status(400).json({ success: false, error: "Apple receipt verification failed" });
      }
      const expectedBundleId = normalizeStringValue(
        process.env.APPLE_BUNDLE_ID || process.env.EXPO_PUBLIC_APPLE_BUNDLE_ID
      );
      const receiptBundleId = normalizeStringValue(appleResult?.receipt?.bundle_id);
      if (expectedBundleId && receiptBundleId !== expectedBundleId) {
        return res.status(400).json({ success: false, error: "Apple receipt bundle ID mismatch" });
      }
      const inAppItems = Array.isArray(appleResult?.latest_receipt_info) ? appleResult.latest_receipt_info : Array.isArray(appleResult?.receipt?.in_app) ? appleResult.receipt.in_app : [];
      const matchingTransactions = inAppItems.filter((item) => item?.product_id === productId).sort((a, b) => {
        const aMs = Number.parseInt(String(a?.purchase_date_ms || "0"), 10);
        const bMs = Number.parseInt(String(b?.purchase_date_ms || "0"), 10);
        return bMs - aMs;
      });
      if (matchingTransactions.length === 0) {
        return res.status(400).json({ success: false, error: "Product ID mismatch in Apple receipt" });
      }
      let transactionId = "";
      for (const transaction of matchingTransactions) {
        const candidateId = normalizeStringValue(transaction?.transaction_id);
        if (!candidateId) continue;
        const [existing] = await db.select({ id: creditTransactions.id }).from(creditTransactions).where((0, import_drizzle_orm3.eq)(creditTransactions.stripePaymentIntentId, candidateId));
        if (!existing) {
          transactionId = candidateId;
          break;
        }
      }
      if (!transactionId) {
        const [existingUser] = await db.select({ credits: users.credits }).from(users).where((0, import_drizzle_orm3.eq)(users.id, userId));
        return res.json({
          success: true,
          credits: existingUser?.credits ?? 0,
          message: "Apple transaction already processed"
        });
      }
      const [user] = await db.select({ credits: users.credits }).from(users).where((0, import_drizzle_orm3.eq)(users.id, userId));
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }
      await db.update(users).set({
        credits: user.credits + expectedCredits,
        updatedAt: /* @__PURE__ */ new Date()
      }).where((0, import_drizzle_orm3.eq)(users.id, userId));
      await db.insert(creditTransactions).values({
        userId,
        type: "purchase",
        amountCredits: expectedCredits,
        amountUsdCents: null,
        source: "app",
        description: "Apple in-app credit purchase",
        stripePaymentIntentId: transactionId
      });
      const [updatedUser] = await db.select({ credits: users.credits }).from(users).where((0, import_drizzle_orm3.eq)(users.id, userId));
      return res.json({ success: true, credits: updatedUser?.credits ?? user.credits + expectedCredits });
    } catch (error) {
      console.error("Apple verify error:", error);
      return res.status(500).json({ success: false, error: "Failed to verify Apple purchase" });
    }
  });
  app2.post("/api/credits/google-verify", authMiddleware, async (req, res) => {
    try {
      const userId = req.user.id;
      const purchaseToken = normalizeStringValue(req.body?.purchaseToken);
      const productId = normalizeStringValue(req.body?.productId);
      if (!purchaseToken || !productId) {
        return res.status(400).json({ success: false, error: "Missing purchase token or product ID" });
      }
      const expectedCredits = GOOGLE_IAP_PRODUCT_CREDITS[productId];
      if (!expectedCredits) {
        return res.status(400).json({ success: false, error: "Unknown Google product ID" });
      }
      const [existingTransaction] = await db.select({ id: creditTransactions.id }).from(creditTransactions).where((0, import_drizzle_orm3.eq)(creditTransactions.stripePaymentIntentId, purchaseToken));
      if (existingTransaction) {
        const [existingUser] = await db.select({ credits: users.credits }).from(users).where((0, import_drizzle_orm3.eq)(users.id, userId));
        return res.json({
          success: true,
          credits: existingUser?.credits ?? 0,
          message: "Google transaction already processed"
        });
      }
      const isDev = process.env.NODE_ENV !== "production";
      const allowBypass = isDev && normalizeStringValue(process.env.ALLOW_GOOGLE_IAP_BYPASS).toLowerCase() === "true";
      const serviceAccountJson = normalizeStringValue(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT);
      const useDevBypass = isDev && (allowBypass || !serviceAccountJson);
      if (useDevBypass) {
        const [user2] = await db.select({ credits: users.credits }).from(users).where((0, import_drizzle_orm3.eq)(users.id, userId));
        if (!user2) {
          return res.status(404).json({ success: false, error: "User not found" });
        }
        await db.update(users).set({
          credits: user2.credits + expectedCredits,
          updatedAt: /* @__PURE__ */ new Date()
        }).where((0, import_drizzle_orm3.eq)(users.id, userId));
        await db.insert(creditTransactions).values({
          userId,
          type: "purchase",
          amountCredits: expectedCredits,
          amountUsdCents: null,
          source: "app",
          description: allowBypass ? "Google Play purchase (dev bypass)" : "Google Play purchase (dev fallback: missing service account)",
          stripePaymentIntentId: purchaseToken
        });
        const [updatedUser2] = await db.select({ credits: users.credits }).from(users).where((0, import_drizzle_orm3.eq)(users.id, userId));
        return res.json({
          success: true,
          credits: updatedUser2?.credits ?? user2.credits + expectedCredits,
          bypass: true
        });
      }
      if (!serviceAccountJson) {
        return res.status(500).json({ success: false, error: "Google verification is not configured" });
      }
      const parsedServiceAccount = JSON.parse(serviceAccountJson);
      const serviceAccount = {
        client_email: normalizeStringValue(parsedServiceAccount.client_email),
        private_key: normalizeStringValue(parsedServiceAccount.private_key).replace(/\\n/g, "\n")
      };
      if (!serviceAccount.client_email || !serviceAccount.private_key) {
        return res.status(500).json({ success: false, error: "Google verification credentials are invalid" });
      }
      const packageName = normalizeStringValue(process.env.GOOGLE_PLAY_PACKAGE_NAME) || "com.iulia.muse";
      const jwt = await createGoogleJwt(serviceAccount);
      const accessToken = await getGoogleAccessToken(jwt);
      const verifyUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
        packageName
      )}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
      const verifyResponse = await fetch(verifyUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      if (!verifyResponse.ok) {
        const errorText = await verifyResponse.text();
        console.error("Google verification failed:", errorText);
        return res.status(400).json({ success: false, error: "Google purchase verification failed" });
      }
      const purchaseData = await verifyResponse.json();
      if (purchaseData.purchaseState !== 0) {
        return res.status(400).json({ success: false, error: "Google purchase is not completed" });
      }
      if (purchaseData.acknowledgementState !== 1) {
        const acknowledgeUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
          packageName
        )}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(
          purchaseToken
        )}:acknowledge`;
        await fetch(acknowledgeUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          }
        });
      }
      const [user] = await db.select({ credits: users.credits }).from(users).where((0, import_drizzle_orm3.eq)(users.id, userId));
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }
      await db.update(users).set({
        credits: user.credits + expectedCredits,
        updatedAt: /* @__PURE__ */ new Date()
      }).where((0, import_drizzle_orm3.eq)(users.id, userId));
      await db.insert(creditTransactions).values({
        userId,
        type: "purchase",
        amountCredits: expectedCredits,
        amountUsdCents: null,
        source: "app",
        description: "Google Play credit purchase",
        stripePaymentIntentId: purchaseToken
      });
      const [updatedUser] = await db.select({ credits: users.credits }).from(users).where((0, import_drizzle_orm3.eq)(users.id, userId));
      return res.json({ success: true, credits: updatedUser?.credits ?? user.credits + expectedCredits });
    } catch (error) {
      console.error("Google verify error:", error);
      return res.status(500).json({ success: false, error: "Failed to verify Google purchase" });
    }
  });
  app2.post("/api/style", authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const body = req.body || {};
    const outputMode = normalizeOutputMode(body.outputMode);
    const imageInputMode = normalizeImageInputMode(body.imageInputMode);
    const sourceMode = normalizeStylingSourceMode(body.sourceMode);
    const allowExtraPieces = body.allowExtraPieces === true || sourceMode === "saved_wardrobe_plus";
    const creditCost = STYLE_COSTS[outputMode];
    const normalizedItems = normalizeRequestedItems(body.items);
    const occasion = normalizeStringValue(body.occasion) || "Any occasion";
    const gender = normalizeStyleGender(body.gender);
    const event = normalizeStringValue(body.event);
    const season = normalizeStringValue(body.season);
    const aesthetic = normalizeStringValue(body.aesthetic);
    const colorPalette = normalizeStringValue(body.colorPalette);
    const customPrompt = normalizeStringValue(body.customPrompt);
    const requiredPieces = normalizeStringList(body.requiredPieces);
    let uploadedImages = [];
    try {
      uploadedImages = normalizeUploadedImages(body.photos, imageInputMode);
    } catch (error) {
      return res.status(400).json({ error: toErrorMessage(error, "Invalid image payload") });
    }
    if (sourceMode === "photo_only" && uploadedImages.length === 0) {
      return res.status(400).json({
        error: "Photo styling mode requires at least one uploaded photo."
      });
    }
    if ((sourceMode === "saved_wardrobe" || sourceMode === "saved_wardrobe_plus") && normalizedItems.length === 0) {
      return res.status(400).json({
        error: "Wardrobe styling mode requires at least one selected wardrobe item."
      });
    }
    if (normalizedItems.length === 0 && uploadedImages.length === 0 && !event && !customPrompt && requiredPieces.length === 0) {
      return res.status(400).json({
        error: "Add at least one item, one image, event details, a required piece, or a custom request."
      });
    }
    let creditsConsumed = false;
    try {
      const consumed = await consumeCredits(userId, creditCost, `style_generation_${outputMode}`);
      if (!consumed) {
        return res.status(402).json({
          error: `Not enough credits. This request costs ${creditCost} credits.`,
          requiredCredits: creditCost
        });
      }
      creditsConsumed = true;
      const stylingPlan = await createStylingPlan({
        uploadedImages,
        prompt: buildStylePrompt({
          items: normalizedItems,
          occasion,
          gender,
          event,
          season,
          aesthetic,
          colorPalette,
          customPrompt,
          requiredPieces,
          outputMode,
          hasReferenceImages: uploadedImages.length > 0,
          imageInputMode,
          sourceMode,
          allowExtraPieces
        })
      });
      let imageBase64;
      let debugImagePrompt;
      if (outputMode === "image") {
        const imagePrompt = buildImageGenerationPrompt({
          imagePrompt: stylingPlan.imagePrompt,
          usedPieces: stylingPlan.usedPieces,
          hasReferenceImages: uploadedImages.length > 0,
          imageInputMode,
          isModification: false
        });
        debugImagePrompt = imagePrompt;
        const imageParts = [{ text: imagePrompt }, ...toGeminiInlineImageParts(uploadedImages)];
        const imageResponse = await generateGeminiContent({
          model: DEFAULT_STYLE_IMAGE_MODEL,
          parts: imageParts,
          responseModalities: ["IMAGE", "TEXT"],
          maxOutputTokens: 800
        });
        imageBase64 = extractGeminiImageBase64(imageResponse);
        if (!imageBase64) {
          throw new Error("Image generation failed. No image data returned.");
        }
      }
      res.json({
        lookName: stylingPlan.lookName,
        description: stylingPlan.description,
        tips: stylingPlan.tips,
        usedPieces: stylingPlan.usedPieces,
        imageBase64,
        outputMode,
        creditsCharged: creditCost,
        ...EXPOSE_STYLE_DEBUG_PROMPT ? { debugImagePrompt } : {}
      });
    } catch (error) {
      console.error("Styling error:", error);
      if (creditsConsumed) {
        await refundCredits(userId, creditCost, `style_generation_${outputMode}_failed`);
      }
      const errorMessage = toErrorMessage(error, "Failed to generate styling");
      if (errorMessage.startsWith("AI_NOT_CONFIGURED:")) {
        return res.status(503).json({ error: errorMessage.replace("AI_NOT_CONFIGURED: ", "") });
      }
      res.status(500).json({ error: errorMessage });
    }
  });
  app2.post("/api/style/modify", authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const body = req.body || {};
    const outputMode = normalizeOutputMode(body.outputMode);
    const imageInputMode = normalizeImageInputMode(body.imageInputMode);
    const sourceMode = normalizeStylingSourceMode(body.sourceMode);
    const allowExtraPieces = body.allowExtraPieces === true || sourceMode === "saved_wardrobe_plus";
    const creditCost = STYLE_COSTS[outputMode];
    const originalDescription = normalizeStringValue(body.originalDescription);
    const originalTips = normalizeStringList(body.originalTips);
    const modifyRequest = normalizeStringValue(body.modifyRequest);
    const occasion = normalizeStringValue(body.occasion) || "Any occasion";
    const gender = normalizeStyleGender(body.gender);
    const event = normalizeStringValue(body.event);
    const season = normalizeStringValue(body.season);
    const aesthetic = normalizeStringValue(body.aesthetic);
    const colorPalette = normalizeStringValue(body.colorPalette);
    const customPrompt = normalizeStringValue(body.customPrompt);
    const requiredPieces = normalizeStringList(body.requiredPieces);
    if (!modifyRequest) {
      return res.status(400).json({ error: "A modification request is required." });
    }
    const normalizedItems = normalizeRequestedItems(body.items);
    let uploadedImages = [];
    try {
      uploadedImages = normalizeUploadedImages(body.photos, imageInputMode);
    } catch (error) {
      return res.status(400).json({ error: toErrorMessage(error, "Invalid image payload") });
    }
    if (sourceMode === "photo_only" && uploadedImages.length === 0) {
      return res.status(400).json({
        error: "Photo styling mode requires at least one uploaded photo."
      });
    }
    if ((sourceMode === "saved_wardrobe" || sourceMode === "saved_wardrobe_plus") && normalizedItems.length === 0) {
      return res.status(400).json({
        error: "Wardrobe styling mode requires at least one selected wardrobe item."
      });
    }
    let creditsConsumed = false;
    try {
      const consumed = await consumeCredits(userId, creditCost, `style_modify_${outputMode}`);
      if (!consumed) {
        return res.status(402).json({
          error: `Not enough credits. This request costs ${creditCost} credits.`,
          requiredCredits: creditCost
        });
      }
      creditsConsumed = true;
      const stylingPlan = await createStylingPlan({
        uploadedImages,
        prompt: buildStylePrompt({
          items: normalizedItems,
          occasion,
          gender,
          event,
          season,
          aesthetic,
          colorPalette,
          customPrompt,
          requiredPieces,
          forceModifyRequest: modifyRequest,
          originalDescription,
          originalTips,
          outputMode,
          hasReferenceImages: uploadedImages.length > 0,
          imageInputMode,
          sourceMode,
          allowExtraPieces
        })
      });
      let imageBase64;
      let debugImagePrompt;
      if (outputMode === "image") {
        const imagePrompt = buildImageGenerationPrompt({
          imagePrompt: stylingPlan.imagePrompt,
          usedPieces: stylingPlan.usedPieces,
          hasReferenceImages: uploadedImages.length > 0,
          imageInputMode,
          isModification: true
        });
        debugImagePrompt = imagePrompt;
        const imageParts = [{ text: imagePrompt }, ...toGeminiInlineImageParts(uploadedImages)];
        const imageResponse = await generateGeminiContent({
          model: DEFAULT_STYLE_IMAGE_MODEL,
          parts: imageParts,
          responseModalities: ["IMAGE", "TEXT"],
          maxOutputTokens: 800
        });
        imageBase64 = extractGeminiImageBase64(imageResponse);
        if (!imageBase64) {
          throw new Error("Image generation failed. No image data returned.");
        }
      }
      res.json({
        lookName: stylingPlan.lookName,
        description: stylingPlan.description,
        tips: stylingPlan.tips,
        usedPieces: stylingPlan.usedPieces,
        imageBase64,
        outputMode,
        creditsCharged: creditCost,
        ...EXPOSE_STYLE_DEBUG_PROMPT ? { debugImagePrompt } : {}
      });
    } catch (error) {
      console.error("Modify error:", error);
      if (creditsConsumed) {
        await refundCredits(userId, creditCost, `style_modify_${outputMode}_failed`);
      }
      const errorMessage = toErrorMessage(error, "Failed to modify styling");
      if (errorMessage.startsWith("AI_NOT_CONFIGURED:")) {
        return res.status(503).json({ error: errorMessage.replace("AI_NOT_CONFIGURED: ", "") });
      }
      res.status(500).json({ error: errorMessage });
    }
  });
  const httpServer = (0, import_node_http.createServer)(app2);
  return httpServer;
}

// server/index.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var app = (0, import_express.default)();
var log = console.log;
app.get("/healthz", (_req, res) => {
  res.status(200).send("ok");
});
function normalizeOriginValue(value) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}
function readConfiguredCorsOrigins() {
  const origins = /* @__PURE__ */ new Set();
  const configuredValues = [
    process.env.CORS_ORIGINS,
    process.env.CORS_ORIGIN,
    process.env.EXPO_PUBLIC_APP_ORIGIN,
    process.env.EXPO_PUBLIC_WEB_ORIGIN
  ];
  for (const raw of configuredValues) {
    if (!raw) continue;
    raw.split(",").map((entry) => entry.trim()).filter(Boolean).forEach((entry) => {
      const normalized = normalizeOriginValue(entry);
      if (normalized) origins.add(normalized);
    });
  }
  return origins;
}
function setupCors(app2) {
  const configuredOrigins = readConfiguredCorsOrigins();
  const isProduction = process.env.NODE_ENV === "production";
  app2.use((req, res, next) => {
    const origin = req.header("origin");
    const normalizedOrigin = origin ? normalizeOriginValue(origin) : null;
    const isLocalhost2 = normalizedOrigin?.startsWith("http://localhost:") || normalizedOrigin?.startsWith("http://127.0.0.1:") || normalizedOrigin?.startsWith("http://0.0.0.0:") || normalizedOrigin?.startsWith("https://localhost:") || normalizedOrigin?.startsWith("https://127.0.0.1:");
    const isConfiguredOrigin = normalizedOrigin ? configuredOrigins.has(normalizedOrigin) : false;
    const allowOrigin = Boolean(
      normalizedOrigin && (isConfiguredOrigin || isLocalhost2 || !isProduction && configuredOrigins.size === 0)
    );
    if (origin && allowOrigin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    import_express.default.json({
      limit: "15mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(import_express.default.urlencoded({ extended: false, limit: "15mb" }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path2 = req.path;
    const headerRequestId = req.header("x-client-request-id");
    const requestId = typeof headerRequestId === "string" && headerRequestId.trim().length > 0 ? headerRequestId.trim() : `srv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const clientPlatform = req.header("x-client-platform") || "unknown";
    let capturedJsonResponse = void 0;
    res.setHeader("x-request-id", requestId);
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path2.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms [rid:${requestId}] [platform:${clientPlatform}]`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 220) {
        logLine = logLine.slice(0, 219) + "...";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const webBuildPath = path.resolve(process.cwd(), "static-build", "web");
  const webIndexPath = path.join(webBuildPath, "index.html");
  const hasWebBuild = fs.existsSync(webIndexPath);
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  if (hasWebBuild) {
    log("Web build detected. Serving web app at / and landing page at /preview");
  } else {
    log("Web build missing. Serving landing page at /");
  }
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    const platform = req.header("expo-platform");
    const isExpoPlatform = platform === "ios" || platform === "android";
    if (req.path === "/manifest") {
      if (isExpoPlatform) {
        return serveExpoManifest(platform, res);
      }
      return res.status(400).json({ error: "Missing or invalid expo-platform header" });
    }
    if (req.path === "/" && isExpoPlatform) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/preview") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    if (req.path === "/" && hasWebBuild) {
      return res.sendFile(webIndexPath);
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", import_express.default.static(path.resolve(process.cwd(), "assets")));
  if (hasWebBuild) {
    app2.use(import_express.default.static(webBuildPath));
  }
  app2.use(import_express.default.static(path.resolve(process.cwd(), "static-build")));
  if (hasWebBuild) {
    app2.use("/", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path === "/manifest") {
        return next();
      }
      return res.sendFile(webIndexPath);
    });
    log("SPA fallback configured with app.use('/')");
  }
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`express server serving on port ${port}`);
    }
  );
})();
