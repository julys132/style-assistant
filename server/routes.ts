import type { Express, Request } from "express";
import { createServer, type Server } from "node:http";
import {
  createHmac,
  createPublicKey,
  createSign,
  createVerify,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { creditTransactions, users } from "../shared/schema";
import {
  authMiddleware,
  createSession,
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
  revokeAllSessions,
  revokeSession,
  validateRefreshToken,
  verifyPassword,
} from "./lib/auth";
import {
  createStripeCheckoutSession,
  retrieveStripeCheckoutSession,
} from "./lib/stripe";

function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI_NOT_CONFIGURED: Set GEMINI_API_KEY (or GOOGLE_API_KEY) to use Gemini styling features.",
    );
  }
  return apiKey;
}

type CreditPackage = {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  popular?: boolean;
};

type SubscriptionPlan = {
  id: string;
  name: string;
  creditsPerMonth: number;
  priceCents: number;
  popular?: boolean;
};

type StripeCheckoutSessionPayload = {
  id: string;
  mode?: string;
  status?: string;
  payment_status?: string;
  payment_intent?: string | null;
  metadata?: Record<string, string>;
};

type StripeInvoicePayload = {
  id: string;
  billing_reason?: string;
  payment_intent?: string | null;
  amount_paid?: number;
  metadata?: Record<string, string>;
  lines?: { data?: Array<{ metadata?: Record<string, string> }> };
  subscription_details?: { metadata?: Record<string, string> };
  parent?: { subscription_details?: { metadata?: Record<string, string> } };
};

type WardrobeSuggestWorkerPayload = {
  category?: unknown;
  color?: unknown;
  shade?: unknown;
  name?: unknown;
  pattern?: unknown;
  confidence?: unknown;
  modelUsed?: unknown;
  modelsTried?: unknown;
  error?: unknown;
  details?: unknown;
  raw?: unknown;
};

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
    if (Array.isArray(message)) {
      const firstString = message.find((entry): entry is string => typeof entry === "string");
      if (firstString && firstString.trim().length > 0) {
        return firstString;
      }
    }
  }

  return fallback;
}

function getEnvValues(keys: string[]): string[] {
  const values: string[] = [];
  for (const key of keys) {
    const raw = process.env[key];
    if (!raw) continue;

    raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => values.push(value));
  }
  return values;
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  return Buffer.from(normalized + "=".repeat(padLength), "base64");
}

function parseJwt(token: string): {
  signedPart: string;
  signature: Buffer;
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
} {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  const header = JSON.parse(base64UrlDecode(headerPart).toString("utf8")) as Record<string, unknown>;
  const payload = JSON.parse(base64UrlDecode(payloadPart).toString("utf8")) as Record<string, unknown>;

  return {
    signedPart: `${headerPart}.${payloadPart}`,
    signature: base64UrlDecode(signaturePart),
    header,
    payload,
  };
}

type AppleJwk = {
  kty: string;
  kid: string;
  use?: string;
  alg?: string;
  n: string;
  e: string;
};

let appleKeysCache: { keys: AppleJwk[]; fetchedAt: number } | null = null;
const APPLE_KEYS_TTL_MS = 60 * 60 * 1000;

async function getAppleSigningKeys(): Promise<AppleJwk[]> {
  if (appleKeysCache && Date.now() - appleKeysCache.fetchedAt < APPLE_KEYS_TTL_MS) {
    return appleKeysCache.keys;
  }

  const response = await fetch("https://appleid.apple.com/auth/keys");
  if (!response.ok) {
    throw new Error("Could not load Apple signing keys");
  }

  const data = (await response.json()) as { keys?: AppleJwk[] };
  const keys = Array.isArray(data.keys) ? data.keys : [];
  if (keys.length === 0) {
    throw new Error("Apple signing keys are unavailable");
  }

  appleKeysCache = { keys, fetchedAt: Date.now() };
  return keys;
}

function getAppleAudienceSet(): Set<string> {
  return new Set(
    getEnvValues([
      "APPLE_BUNDLE_ID",
      "APPLE_SERVICE_ID",
      "APPLE_CLIENT_ID",
      "EXPO_PUBLIC_APPLE_CLIENT_ID",
    ]),
  );
}

function getGoogleAudienceSet(): Set<string> {
  return new Set(
    getEnvValues([
      "GOOGLE_CLIENT_ID",
      "GOOGLE_WEB_CLIENT_ID",
      "GOOGLE_IOS_CLIENT_ID",
      "GOOGLE_ANDROID_CLIENT_ID",
      "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
      "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
      "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID",
    ]),
  );
}

async function verifyGoogleIdToken(idToken: string): Promise<{
  sub: string;
  email: string;
  name?: string;
}> {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  if (!response.ok) {
    throw new Error("Invalid Google identity token");
  }

  const data = (await response.json()) as Record<string, unknown>;

  const sub = typeof data.sub === "string" ? data.sub : "";
  const email = typeof data.email === "string" ? data.email : "";
  const iss = typeof data.iss === "string" ? data.iss : "";
  const aud = typeof data.aud === "string" ? data.aud : "";
  const exp = Number(data.exp || 0);
  const emailVerified = data.email_verified === true || data.email_verified === "true";
  const name = typeof data.name === "string" ? data.name : undefined;

  if (!sub || !email) {
    throw new Error("Google token is missing subject or email");
  }
  if (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") {
    throw new Error("Google token issuer is invalid");
  }
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) {
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

async function verifyAppleIdentityToken(identityToken: string): Promise<{
  sub: string;
  email?: string;
}> {
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

  const publicKey = createPublicKey({
    key: {
      kty: key.kty,
      kid: key.kid,
      use: key.use,
      alg: key.alg,
      n: key.n,
      e: key.e,
    } as any,
    format: "jwk",
  });

  const verifier = createVerify("RSA-SHA256");
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
  const email = typeof payload.email === "string" ? payload.email : undefined;

  if (iss !== "https://appleid.apple.com") {
    throw new Error("Apple token issuer is invalid");
  }
  if (!sub) {
    throw new Error("Apple token is missing subject");
  }
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) {
    throw new Error("Apple token is expired");
  }

  const allowedAudiences = getAppleAudienceSet();
  if (allowedAudiences.size > 0 && !allowedAudiences.has(aud)) {
    throw new Error("Apple token audience mismatch");
  }

  return { sub, email };
}

const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "pack_5", name: "Starter", credits: 5, priceCents: 299 },
  { id: "pack_15", name: "Style Pack", credits: 15, priceCents: 699, popular: true },
  { id: "pack_30", name: "Fashion Pack", credits: 30, priceCents: 1199 },
  { id: "pack_100", name: "Pro Pack", credits: 100, priceCents: 3499 },
];

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { id: "sub_basic", name: "Basic", creditsPerMonth: 10, priceCents: 499 },
  { id: "sub_premium", name: "Premium", creditsPerMonth: 30, priceCents: 999, popular: true },
  { id: "sub_unlimited", name: "Unlimited", creditsPerMonth: 999, priceCents: 1999 },
];

type StyleOutputMode = "text" | "image";
type ImageInputMode = "single_item" | "multi_item";
type StylingSourceMode = "photo_only" | "saved_wardrobe" | "saved_wardrobe_plus";
type WardrobeSuggestModel = "auto" | "uform" | "llava";
type StyleGender = "female" | "male" | "non_binary" | "";
type UploadedReferenceImage = {
  base64: string;
  mimeType?: string;
};
type RawStyleItem = {
  name?: unknown;
  category?: unknown;
  color?: unknown;
  description?: unknown;
};
type NormalizedStyleItem = {
  name: string;
  category: string;
  color: string;
  description?: string;
};

const STYLE_COSTS: Record<StyleOutputMode, number> = {
  text: 2,
  image: 5,
};
const DEFAULT_INITIAL_CREDITS = Number.parseInt(process.env.DEFAULT_INITIAL_CREDITS || "3", 10);
const DEFAULT_DEV_CREDIT_GRANT = Number.parseInt(process.env.DEV_CREDIT_GRANT_AMOUNT || "50", 10);
const MAX_DEV_CREDIT_GRANT = 500;

const GEMINI_API_BASE_URL =
  process.env.GEMINI_API_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
// Override these defaults with STYLE_TEXT_MODEL / STYLE_IMAGE_MODEL env vars.
const DEFAULT_STYLE_TEXT_MODEL = process.env.STYLE_TEXT_MODEL || "gemini-3-flash-preview";
// Current image generation runtime is Gemini. If we switch this path to ChatGPT image generation,
// the preferred target model is `chatgpt-image-latest-high-fidelity (20251216)`, not older `gpt-image-1` variants.
const DEFAULT_STYLE_IMAGE_MODEL = process.env.STYLE_IMAGE_MODEL || "gemini-3.1-flash-image-preview";
const STYLE_IMAGE_SIZE = (process.env.STYLE_IMAGE_SIZE || "512x512").trim() || "512x512";
const EXPOSE_STYLE_DEBUG_PROMPT =
  normalizeStringValue(process.env.EXPOSE_STYLE_DEBUG_PROMPT).toLowerCase() === "true";
const MAX_IMAGE_COUNT_BY_MODE: Record<ImageInputMode, number> = {
  single_item: 10,
  multi_item: 3,
};
const MAX_IMAGE_BASE64_LENGTH = 2_500_000;
const STRIPE_WEBHOOK_TOLERANCE_SEC = 300;
const WARDROBE_SUGGEST_TIMEOUT_MS = 25_000;
const DEFAULT_WARDROBE_SUGGEST_WORKER_URL =
  "https://wardrobe-suggest-worker.iuliastarcean.workers.dev/suggest-wardrobe";
const WARDROBE_SUGGEST_MODELS = ["auto", "uform", "llava"] as const;
const WARDROBE_CATEGORIES = ["Top", "Bottom", "Dress", "Outerwear", "Shoes", "Accessory", "Bag"] as const;
const WARDROBE_COLORS = [
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
  "Multi",
] as const;
const WARDROBE_PATTERNS = ["Solid", "Striped", "Floral", "Checked", "Graphic", "Other"] as const;
const SHADE_TO_BASE_COLOR: Record<string, string> = {
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
  mustard: "Yellow",
};

const DEFAULT_IAP_PRODUCT_CREDITS: Record<string, number> = {
  "com.iulia.muse.credits.5": 5,
  "com.iulia.muse.credits.15": 15,
  "com.iulia.muse.credits.30": 30,
  "com.iulia.muse.credits.100": 100,
  "com.thestylist.app.credits.5": 5,
  "com.thestylist.app.credits.15": 15,
  "com.thestylist.app.credits.30": 30,
  "com.thestylist.app.credits.100": 100,
};

function parseProductCreditsMap(raw: string | undefined): Record<string, number> {
  if (!raw || !raw.trim()) return {};

  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const entries = Object.entries(parsed as Record<string, unknown>);
    return entries.reduce<Record<string, number>>((acc, [productId, creditsRaw]) => {
      const credits = Number(creditsRaw);
      if (productId.trim() && Number.isFinite(credits) && credits > 0) {
        acc[productId.trim()] = Math.floor(credits);
      }
      return acc;
    }, {});
  } catch {
    return trimmed
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .reduce<Record<string, number>>((acc, entry) => {
        const [productIdRaw, creditsRaw] = entry.split(":").map((part) => part.trim());
        const credits = Number(creditsRaw);
        if (productIdRaw && Number.isFinite(credits) && credits > 0) {
          acc[productIdRaw] = Math.floor(credits);
        }
        return acc;
      }, {});
  }
}

const SHARED_IAP_PRODUCT_CREDITS = parseProductCreditsMap(process.env.IAP_PRODUCT_CREDITS);
const APPLE_IAP_PRODUCT_CREDITS: Record<string, number> = {
  ...DEFAULT_IAP_PRODUCT_CREDITS,
  ...SHARED_IAP_PRODUCT_CREDITS,
  ...parseProductCreditsMap(process.env.APPLE_IAP_PRODUCT_CREDITS),
};
const GOOGLE_IAP_PRODUCT_CREDITS: Record<string, number> = {
  ...DEFAULT_IAP_PRODUCT_CREDITS,
  ...SHARED_IAP_PRODUCT_CREDITS,
  ...parseProductCreditsMap(process.env.GOOGLE_IAP_PRODUCT_CREDITS),
};

type GeminiTextPart = { text: string };
type GeminiInlineDataPart = { inlineData: { mimeType: string; data: string } };
type GeminiPart = GeminiTextPart | GeminiInlineDataPart;

function getInitialCredits(): number {
  if (Number.isInteger(DEFAULT_INITIAL_CREDITS) && DEFAULT_INITIAL_CREDITS > 0) {
    return DEFAULT_INITIAL_CREDITS;
  }
  return 3;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizeUser(user: typeof users.$inferSelect) {
  const normalizedStyleGender = normalizeStyleGender(user.styleGender);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    provider: (user.authProvider || "email") as "email" | "apple" | "google",
    credits: user.credits,
    subscription: user.subscriptionPlan,
    styleGender: normalizedStyleGender || null,
    stylePreferences: Array.isArray(user.stylePreferences) ? user.stylePreferences : [],
    favoriteLooks: Array.isArray(user.favoriteLooks) ? user.favoriteLooks : [],
    notificationsEnabled: user.notificationsEnabled,
  };
}

function normalizeOutputMode(input: unknown): StyleOutputMode {
  return input === "text" ? "text" : "image";
}

function normalizeStyleGender(input: unknown): StyleGender {
  const value = normalizeStringValue(input).toLowerCase();
  if (value === "female" || value === "male" || value === "non_binary") {
    return value;
  }
  return "";
}

function normalizeImageInputMode(input: unknown): ImageInputMode {
  return input === "multi_item" ? "multi_item" : "single_item";
}

function normalizeStylingSourceMode(input: unknown): StylingSourceMode {
  return input === "saved_wardrobe" || input === "saved_wardrobe_plus"
    ? input
    : "photo_only";
}

function normalizeStringValue(input: unknown): string {
  if (typeof input === "string") return input.trim();
  if (Array.isArray(input)) {
    const first = input.find((entry): entry is string => typeof entry === "string");
    return first ? first.trim() : "";
  }
  return "";
}

function normalizeStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeWardrobeSuggestModel(input: unknown): WardrobeSuggestModel {
  const model = normalizeStringValue(input).toLowerCase();
  if ((WARDROBE_SUGGEST_MODELS as readonly string[]).includes(model)) {
    return model as WardrobeSuggestModel;
  }
  return "auto";
}

function getWardrobeSuggestWorkerUrl(): string {
  const configuredUrl = normalizeStringValue(process.env.WARDROBE_SUGGEST_WORKER_URL);
  const source = configuredUrl || DEFAULT_WARDROBE_SUGGEST_WORKER_URL;
  const trimmed = source.replace(/\/+$/, "");
  if (trimmed.endsWith("/suggest-wardrobe")) return trimmed;
  return `${trimmed}/suggest-wardrobe`;
}

function normalizeWardrobeEnumValue(
  input: unknown,
  allowedValues: readonly string[],
  aliases: Record<string, string> = {},
): string {
  const normalized = normalizeStringValue(input).toLowerCase();
  if (!normalized) return "";

  if (aliases[normalized]) return aliases[normalized];

  const directMatch = allowedValues.find((value) => value.toLowerCase() === normalized);
  if (directMatch) return directMatch;

  const tokenized = normalized
    .replace(/[_-]+/g, " ")
    .split(/[\s,/|]+/)
    .map((token) => token.trim())
    .filter(Boolean);

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

function normalizeWardrobeCategory(input: unknown): string {
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
    jewellery: "Accessory",
  });
}

function normalizeWardrobeColor(input: unknown): string {
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
    colourful: "Multi",
  });
}

function normalizeWardrobePattern(input: unknown): string {
  return normalizeWardrobeEnumValue(input, WARDROBE_PATTERNS, {
    plain: "Solid",
    stripe: "Striped",
    stripes: "Striped",
    checkered: "Checked",
    plaid: "Checked",
    print: "Graphic",
    printed: "Graphic",
    logo: "Graphic",
  });
}

function normalizeWardrobeShade(input: unknown): string {
  const normalized = normalizeStringValue(input)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";
  if (normalized.includes("|")) return "";

  return normalized
    .split(" ")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .slice(0, 3)
    .join(" ");
}

function inferWardrobeColorFromShade(shade: string): string {
  const normalized = shade.trim().toLowerCase();
  if (!normalized) return "";

  if (SHADE_TO_BASE_COLOR[normalized]) return SHADE_TO_BASE_COLOR[normalized];

  const partial = Object.entries(SHADE_TO_BASE_COLOR).find(([key]) => normalized.includes(key));
  return partial ? partial[1] : "";
}

function normalizeWardrobeConfidence(input: unknown): number {
  const confidence = Number(input);
  if (!Number.isFinite(confidence)) return 0;
  return Math.min(Math.max(confidence, 0), 1);
}

function buildWardrobeFallbackName(category: string, color: string): string {
  const categoryLabel =
    category === "Top"
      ? "top"
      : category === "Bottom"
        ? "bottom"
        : category === "Outerwear"
          ? "outerwear"
          : category
            ? category.toLowerCase()
            : "item";
  return [color ? color.toLowerCase() : "", categoryLabel].filter(Boolean).join(" ").trim();
}

function isGenericWardrobeName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    normalized === "item" ||
    normalized === "clothing item" ||
    normalized === "fashion item" ||
    normalized === "garment" ||
    normalized === "product"
  );
}

function isDevCreditGrantEnabled(): boolean {
  const override = normalizeStringValue(process.env.ENABLE_DEV_CREDIT_GRANTS).toLowerCase();
  if (override === "1" || override === "true" || override === "yes") {
    return true;
  }
  return process.env.NODE_ENV !== "production";
}

function resolveDevCreditGrantAmount(input: unknown): number {
  const requestedAmount = Number(input);
  if (Number.isInteger(requestedAmount) && requestedAmount > 0) {
    return Math.min(requestedAmount, MAX_DEV_CREDIT_GRANT);
  }

  if (Number.isInteger(DEFAULT_DEV_CREDIT_GRANT) && DEFAULT_DEV_CREDIT_GRANT > 0) {
    return Math.min(DEFAULT_DEV_CREDIT_GRANT, MAX_DEV_CREDIT_GRANT);
  }

  return 50;
}

function normalizeRequestedItems(input: unknown): NormalizedStyleItem[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((entry): entry is RawStyleItem => Boolean(entry) && typeof entry === "object")
    .map((entry): NormalizedStyleItem | null => {
      const name = normalizeStringValue(entry.name);
      const category = normalizeStringValue(entry.category);
      const color = normalizeStringValue(entry.color);
      const description = normalizeStringValue(entry.description);

      if (!name && !category && !color && !description) return null;

      return {
        name: name || "Unspecified item",
        category: category || "unspecified category",
        color: color || "unspecified color",
        description: description || undefined,
      };
    })
    .filter((entry): entry is NormalizedStyleItem => Boolean(entry));
}

function normalizeUploadedImages(
  input: unknown,
  imageInputMode: ImageInputMode,
): UploadedReferenceImage[] {
  if (!Array.isArray(input)) return [];

  const maxAllowed = MAX_IMAGE_COUNT_BY_MODE[imageInputMode];
  const sanitized = input
    .map((entry): UploadedReferenceImage | null => {
      if (typeof entry === "string") {
        const base64 = entry.trim();
        if (!base64) return null;
        return { base64, mimeType: "image/jpeg" };
      }
      if (!entry || typeof entry !== "object") return null;

      const maybeEntry = entry as { base64?: unknown; mimeType?: unknown };
      const base64 = typeof maybeEntry.base64 === "string" ? maybeEntry.base64.trim() : "";
      if (!base64) return null;

      const mimeType =
        typeof maybeEntry.mimeType === "string" && maybeEntry.mimeType.startsWith("image/")
          ? maybeEntry.mimeType
          : "image/jpeg";
      return { base64, mimeType };
    })
    .filter((value): value is UploadedReferenceImage => Boolean(value));

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

function sanitizeStylingResponse(raw: unknown): {
  lookName: string;
  description: string;
  tips: string[];
  imagePrompt: string;
  usedPieces: string[];
} {
  const fallback = {
    lookName: "Curated Signature Look",
    description: "A polished outfit with strong proportions, coordinated tones, and a clean finish.",
    tips: [
      "Use contrast in texture to add depth.",
      "Keep accessories intentional and minimal.",
      "Balance structure with one softer piece.",
    ],
    imagePrompt:
      "High-fashion editorial photo of a model in a cohesive outfit, soft focus, clean studio background, full body, realistic fabrics.",
    usedPieces: [] as string[],
  };

  if (!raw || typeof raw !== "object") return fallback;

  const parsed = raw as {
    lookName?: unknown;
    description?: unknown;
    tips?: unknown;
    imagePrompt?: unknown;
    usedPieces?: unknown;
  };

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
    usedPieces,
  };
}

function tryParseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const maybeJson = trimmed.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(maybeJson) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return {};
  }
}

function buildStylePrompt(options: {
  items: NormalizedStyleItem[];
  occasion: string;
  gender: StyleGender;
  event: string;
  season: string;
  aesthetic: string;
  colorPalette: string;
  customPrompt: string;
  requiredPieces: string[];
  forceModifyRequest?: string;
  originalDescription?: string;
  originalTips?: string[];
  outputMode: StyleOutputMode;
  hasReferenceImages: boolean;
  imageInputMode: ImageInputMode;
  sourceMode: StylingSourceMode;
  allowExtraPieces: boolean;
}): string {
  const itemLines = options.items.map((item, index) => {
    const descriptionPart = normalizeStringValue(item.description);
    return `${index + 1}. ${item.name} (${item.category}, ${item.color}${descriptionPart ? `, ${descriptionPart}` : ""})`;
  });

  const promptParts: string[] = [];

  if (options.hasReferenceImages) {
    promptParts.push(
      "Using the attached image(s), select garments visible in them to create a brand-new outfit from scratch, following the instructions below:",
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
    `- Required pieces: ${options.requiredPieces.length > 0 ? options.requiredPieces.join(", ") : "None explicitly required"}`,
  );

  promptParts.push("Source mode rules (MANDATORY):");

  if (options.sourceMode === "photo_only") {
    promptParts.push(
      "- Build the outfit primarily from garments visible in the uploaded reference image(s).",
      "- Do not use hidden wardrobe memory or invent a saved closet.",
      options.allowExtraPieces
        ? '- You may add at most 2 subtle finishing pieces only when necessary. Mark each added item with "(added)" in usedPieces.'
        : "- Do not add extra garments that are not visible in the uploaded image(s).",
      "- Keep garment identity faithful to the reference image(s): same silhouette, cut, fabric feel, pattern, and base colors.",
      options.imageInputMode === "multi_item"
        ? "- Multi-item photo mode: combine visible garments across the uploaded images into one coherent outfit."
        : "- Single-item photo mode: prioritize garments from the uploaded image(s) exactly as shown.",
    );
  }

  if (options.sourceMode === "saved_wardrobe") {
    promptParts.push(
      "- Use ONLY the structured wardrobe pieces provided in the request.",
      "- Do not add, invent, or suggest any extra garments as part of the final outfit.",
      "- If the selected wardrobe pieces are not enough for a perfect look, still build the best outfit possible using only those pieces.",
      '- In "usedPieces", include only pieces from the provided wardrobe list.',
    );
  }

  if (options.sourceMode === "saved_wardrobe_plus") {
    promptParts.push(
      "- Use the structured wardrobe pieces provided in the request as the main outfit foundation.",
      "- You may add at most 2 finishing pieces only if the outfit needs them to feel complete.",
      '- Any added piece must be clearly marked with "(added)" in usedPieces.',
      "- Prioritize the user's own wardrobe before adding anything new.",
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
      `The imagePrompt must be optimized for a single ${STYLE_IMAGE_SIZE} realistic editorial fashion shot with soft focus and a clean background.`,
    );
  } else {
    promptParts.push("Prioritize concise and practical styling text output.");
  }

  return promptParts.join("\n");
}

function toGeminiInlineImageParts(uploadedImages: UploadedReferenceImage[]): GeminiInlineDataPart[] {
  return uploadedImages.map((image) => ({
    inlineData: {
      mimeType: image.mimeType || "image/jpeg",
      data: image.base64,
    },
  }));
}

function buildImageGenerationPrompt(options: {
  imagePrompt: string;
  usedPieces: string[];
  hasReferenceImages: boolean;
  imageInputMode: ImageInputMode;
  isModification: boolean;
}): string {
  const basePrefix = `High-fashion editorial portrait, full-body model, soft focus, clean background, 1:1 composition, ${STYLE_IMAGE_SIZE}`;
  const detailLabel = options.isModification ? "Modified outfit details" : "Outfit details";
  const selectedPiecesLine =
    options.usedPieces.length > 0
      ? `Selected pieces: ${options.usedPieces.join(", ")}.`
      : "Selected pieces: derive them from the reference image(s).";

  if (!options.hasReferenceImages) {
    return `${basePrefix}, ${selectedPiecesLine} ${detailLabel.toLowerCase()}: ${options.imagePrompt}`;
  }

  const leadInstruction =
    "Using the attached image(s), select garments visible in them to create a brand-new outfit from scratch, following the instructions below:";

  const modeLine =
    options.imageInputMode === "multi_item"
      ? "When multiple reference images are provided, use garments from those images without changing their identity."
      : "Use garments from the single reference image as the primary outfit pieces.";

  return [
    leadInstruction,
    basePrefix,
    "Reference-image constraints (MANDATORY): use uploaded image(s) as the source for primary garments.",
    "Do not remodel or replace core garments; keep silhouette, cut, fabric feel, patterns, and base colors faithful.",
    modeLine,
    selectedPiecesLine,
    "You may add only minimal finishing pieces if absent (belt, shoes, subtle accessories).",
    `${detailLabel}: ${options.imagePrompt}`,
  ].join("\n");
}

function getObjectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function extractGeminiText(responseJson: unknown): string {
  const root = getObjectRecord(responseJson);
  if (!root) return "";

  const candidates = Array.isArray(root.candidates) ? root.candidates : [];
  for (const candidate of candidates) {
    const candidateRecord = getObjectRecord(candidate);
    const content = getObjectRecord(candidateRecord?.content);
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    for (const part of parts) {
      const partRecord = getObjectRecord(part);
      const text = partRecord?.text;
      if (typeof text === "string" && text.trim().length > 0) {
        return text;
      }
    }
  }

  return "";
}

function extractGeminiImageBase64(responseJson: unknown): string | undefined {
  const root = getObjectRecord(responseJson);
  if (!root) return undefined;

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
      if (
        typeof mimeType === "string" &&
        mimeType.startsWith("image/") &&
        typeof data === "string" &&
        data.length > 0
      ) {
        return data;
      }
    }
  }

  return undefined;
}

async function generateGeminiContent(options: {
  model: string;
  parts: GeminiPart[];
  responseMimeType?: string;
  maxOutputTokens?: number;
  temperature?: number;
  responseModalities?: string[];
}): Promise<unknown> {
  const apiKey = getGeminiApiKey();
  const rawModelName = normalizeStringValue(options.model);
  const modelName = rawModelName.startsWith("models/")
    ? rawModelName.slice("models/".length)
    : rawModelName;
  if (!modelName) {
    throw new Error("Gemini model name is missing.");
  }

  const url = `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(modelName)}:generateContent`;

  const generationConfig: Record<string, unknown> = {};
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

  const payload: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: options.parts,
      },
    ],
  };
  if (Object.keys(generationConfig).length > 0) {
    payload.generationConfig = generationConfig;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  let parsed: unknown = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const parsedRecord = getObjectRecord(parsed);
    const errorRecord = getObjectRecord(parsedRecord?.error);
    const remoteMessage =
      typeof errorRecord?.message === "string"
        ? errorRecord.message
        : typeof parsedRecord?.message === "string"
          ? parsedRecord.message
          : "";
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
  uploadedImages,
}: {
  prompt: string;
  uploadedImages: UploadedReferenceImage[];
}) {
  const parts: GeminiPart[] = [
    { text: prompt },
    ...toGeminiInlineImageParts(uploadedImages),
  ];

  let rawContent = "{}";
  try {
    const response = await generateGeminiContent({
      model: DEFAULT_STYLE_TEXT_MODEL,
      parts,
      responseMimeType: "application/json",
      maxOutputTokens: 1200,
      temperature: 0.4,
    });
    rawContent = extractGeminiText(response) || "{}";
  } catch (jsonModeError: unknown) {
    const errorMessage = toErrorMessage(jsonModeError, "").toLowerCase();
    const shouldFallback =
      errorMessage.includes("responsemimetype") ||
      errorMessage.includes("json schema") ||
      errorMessage.includes("response mime");
    if (!shouldFallback) {
      throw jsonModeError;
    }

    const fallbackResponse = await generateGeminiContent({
      model: DEFAULT_STYLE_TEXT_MODEL,
      parts,
      maxOutputTokens: 1200,
      temperature: 0.4,
    });
    rawContent = extractGeminiText(fallbackResponse) || "{}";
    if (process.env.NODE_ENV !== "production") {
      console.warn("Gemini JSON mode unsupported, fallback used:", jsonModeError);
    }
  }

  return sanitizeStylingResponse(tryParseJsonObject(rawContent));
}

async function consumeCredits(userId: string, amount: number, feature: string): Promise<boolean> {
  if (!Number.isInteger(amount) || amount < 1) {
    throw new Error("Invalid credit amount");
  }

  const [user] = await db.select({ credits: users.credits }).from(users).where(eq(users.id, userId));
  if (!user || user.credits < amount) {
    return false;
  }

  const nextCredits = user.credits - amount;
  await db
    .update(users)
    .set({ credits: nextCredits, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await db.insert(creditTransactions).values({
    userId,
    type: "usage",
    amountCredits: -amount,
    source: "app",
    description: feature,
  });

  return true;
}

async function refundCredits(userId: string, amount: number, reason: string): Promise<void> {
  if (!Number.isInteger(amount) || amount < 1) return;

  const [user] = await db.select({ credits: users.credits }).from(users).where(eq(users.id, userId));
  if (!user) return;

  await db
    .update(users)
    .set({ credits: user.credits + amount, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await db.insert(creditTransactions).values({
    userId,
    type: "refund",
    amountCredits: amount,
    source: "app",
    description: reason,
  });
}

function getDefaultBaseUrl(req: Request): string {
  const publicWebUrl = process.env.PUBLIC_WEB_URL;
  if (publicWebUrl) return publicWebUrl.replace(/\/+$/, "");

  const proto = firstHeaderValue(req.headers["x-forwarded-proto"]) || req.protocol || "https";
  const host = firstHeaderValue(req.headers["x-forwarded-host"]) || req.get("host") || "localhost:5000";

  return `${proto}://${host}`.replace(/\/+$/, "");
}

function getRawBodyText(req: Request): string {
  const rawBody = (req as Request & { rawBody?: unknown }).rawBody;
  if (Buffer.isBuffer(rawBody)) return rawBody.toString("utf8");
  if (typeof rawBody === "string") return rawBody;
  if (rawBody instanceof Uint8Array) return Buffer.from(rawBody).toString("utf8");
  return JSON.stringify(req.body ?? {});
}

function parseStripeSignatureHeader(headerValue: string): { timestamp: string; signatures: string[] } | null {
  const entries = headerValue
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  let timestamp = "";
  const signatures: string[] = [];
  for (const entry of entries) {
    const [key, value] = entry.split("=");
    if (!key || !value) continue;
    if (key === "t") timestamp = value;
    if (key === "v1") signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) return null;
  return { timestamp, signatures };
}

function verifyStripeWebhookSignature(payload: string, headerValue: string, secret: string): boolean {
  const parsed = parseStripeSignatureHeader(headerValue);
  if (!parsed) return false;

  const nowSec = Math.floor(Date.now() / 1000);
  const timestampSec = Number(parsed.timestamp);
  if (!Number.isFinite(timestampSec)) return false;
  if (Math.abs(nowSec - timestampSec) > STRIPE_WEBHOOK_TOLERANCE_SEC) return false;

  const signedPayload = `${parsed.timestamp}.${payload}`;
  const expected = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  return parsed.signatures.some((candidate) => {
    if (!/^[0-9a-fA-F]+$/.test(candidate) || candidate.length !== expected.length) return false;
    const candidateBuffer = Buffer.from(candidate, "hex");
    if (candidateBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(candidateBuffer, expectedBuffer);
  });
}

function extractStripeInvoiceMetadata(invoice: StripeInvoicePayload): Record<string, string> {
  const metadataSources: Array<Record<string, string> | undefined> = [
    invoice.subscription_details?.metadata,
    invoice.parent?.subscription_details?.metadata,
    invoice.lines?.data?.[0]?.metadata,
    invoice.metadata,
  ];

  const merged: Record<string, string> = {};
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

async function processPaidStripeSession(session: StripeCheckoutSessionPayload): Promise<void> {
  if (session.payment_status !== "paid") return;

  const metadata = session.metadata ?? {};
  const userId = normalizeStringValue(metadata.userId);
  if (!userId) return;

  const itemType = normalizeStringValue(metadata.itemType);
  const itemId = normalizeStringValue(metadata.itemId);
  const paymentIntentId = normalizeStringValue(session.payment_intent || "") || null;

  const [existingBySession] = await db
    .select({ id: creditTransactions.id })
    .from(creditTransactions)
    .where(eq(creditTransactions.stripeSessionId, session.id));
  if (existingBySession) return;

  if (paymentIntentId) {
    const [existingByIntent] = await db
      .select({ id: creditTransactions.id, stripeSessionId: creditTransactions.stripeSessionId })
      .from(creditTransactions)
      .where(eq(creditTransactions.stripePaymentIntentId, paymentIntentId));

    if (existingByIntent) {
      if (!existingByIntent.stripeSessionId) {
        await db
          .update(creditTransactions)
          .set({ stripeSessionId: session.id })
          .where(eq(creditTransactions.id, existingByIntent.id));
      }
      return;
    }
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return;

  if (itemType === "subscription") {
    const plan = SUBSCRIPTION_PLANS.find((entry) => entry.id === itemId);
    if (!plan) return;

    const renewal = new Date();
    renewal.setMonth(renewal.getMonth() + 1);

    await db
      .update(users)
      .set({
        credits: user.credits + plan.creditsPerMonth,
        subscriptionPlan: plan.id,
        subscriptionRenewAt: renewal,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await db.insert(creditTransactions).values({
      userId: user.id,
      type: "subscription",
      amountCredits: plan.creditsPerMonth,
      amountUsdCents: plan.priceCents,
      source: "stripe",
      description: `${plan.name} subscription`,
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
    });
    return;
  }

  const pkg = CREDIT_PACKAGES.find((entry) => entry.id === itemId);
  const creditsFromMetadata = Number.parseInt(metadata.credits || "0", 10);
  const creditsToAdd = pkg?.credits ?? creditsFromMetadata;
  if (!Number.isInteger(creditsToAdd) || creditsToAdd < 1) return;

  await db
    .update(users)
    .set({
      credits: user.credits + creditsToAdd,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  await db.insert(creditTransactions).values({
    userId: user.id,
    type: "purchase",
    amountCredits: creditsToAdd,
    amountUsdCents: pkg?.priceCents ?? null,
    source: "stripe",
    description: "Credit package purchase",
    stripeSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
  });
}

async function processPaidStripeInvoice(invoice: StripeInvoicePayload): Promise<void> {
  const billingReason = normalizeStringValue(invoice.billing_reason).toLowerCase();
  // Initial subscription credit grant is handled from checkout session processing.
  // Here we only process recurring renewals to avoid duplicate credits.
  if (billingReason !== "subscription_cycle") return;

  const paymentIntentId = normalizeStringValue(invoice.payment_intent || "");
  if (!paymentIntentId) return;

  const [existing] = await db
    .select({ id: creditTransactions.id })
    .from(creditTransactions)
    .where(eq(creditTransactions.stripePaymentIntentId, paymentIntentId));
  if (existing) return;

  const metadata = extractStripeInvoiceMetadata(invoice);
  const userId = normalizeStringValue(metadata.userId);
  if (!userId) return;

  const planId = normalizeStringValue(metadata.itemId || metadata.planId);
  const plan = SUBSCRIPTION_PLANS.find((entry) => entry.id === planId);
  const creditsFromMetadata = Number.parseInt(metadata.credits || "", 10);
  const creditsToAdd = plan?.creditsPerMonth ?? creditsFromMetadata;
  if (!Number.isInteger(creditsToAdd) || creditsToAdd < 1) return;

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return;

  const renewal = new Date();
  renewal.setMonth(renewal.getMonth() + 1);

  await db
    .update(users)
    .set({
      credits: user.credits + creditsToAdd,
      subscriptionPlan: plan?.id ?? user.subscriptionPlan,
      subscriptionRenewAt: renewal,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  await db.insert(creditTransactions).values({
    userId: user.id,
    type: "subscription",
    amountCredits: creditsToAdd,
    amountUsdCents:
      typeof invoice.amount_paid === "number" && invoice.amount_paid > 0
        ? invoice.amount_paid
        : plan?.priceCents ?? null,
    source: "stripe",
    description: plan ? `${plan.name} subscription renewal` : "Subscription renewal",
    stripeSessionId: invoice.id,
    stripePaymentIntentId: paymentIntentId,
  });
}

async function processStripeCreditReversal(paymentIntentId: string, reversalType: "refund" | "dispute"): Promise<void> {
  const markerId = `${reversalType}_${paymentIntentId}`;
  const [alreadyProcessed] = await db
    .select({ id: creditTransactions.id })
    .from(creditTransactions)
    .where(eq(creditTransactions.stripePaymentIntentId, markerId));
  if (alreadyProcessed) return;

  const originalTransactions = await db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.stripePaymentIntentId, paymentIntentId));

  const original = originalTransactions.find(
    (entry) => (entry.type === "purchase" || entry.type === "subscription") && entry.amountCredits > 0,
  );
  if (!original) return;

  const [user] = await db
    .select({
      id: users.id,
      credits: users.credits,
      subscriptionPlan: users.subscriptionPlan,
    })
    .from(users)
    .where(eq(users.id, original.userId));
  if (!user) return;

  const creditsToDeduct = Math.max(original.amountCredits, 0);
  const nextCredits = Math.max(user.credits - creditsToDeduct, 0);
  const shouldClearSubscription = original.type === "subscription";
  const userUpdate: Partial<typeof users.$inferInsert> = {
    credits: nextCredits,
    updatedAt: new Date(),
  };
  if (shouldClearSubscription) {
    userUpdate.subscriptionPlan = null;
    userUpdate.subscriptionRenewAt = null;
  }

  await db
    .update(users)
    .set(userUpdate)
    .where(eq(users.id, user.id));

  await db.insert(creditTransactions).values({
    userId: user.id,
    type: "refund",
    amountCredits: -creditsToDeduct,
    amountUsdCents:
      typeof original.amountUsdCents === "number" && original.amountUsdCents > 0
        ? -Math.abs(original.amountUsdCents)
        : null,
    source: "stripe",
    description: reversalType === "refund" ? "Stripe refund" : "Stripe dispute chargeback",
    stripePaymentIntentId: markerId,
  });
}

async function createGoogleJwt(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const headerPart = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadPart = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${headerPart}.${payloadPart}`;

  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key, "base64url");

  return `${signingInput}.${signature}`;
}

async function getGoogleAccessToken(jwt: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    throw new Error("Failed to get Google access token");
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Google access token is missing from response");
  }
  return payload.access_token;
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/health", (_req, res) => {
    const headerRequestId = firstHeaderValue(_req.headers["x-client-request-id"]);
    return res.json({
      status: "ok",
      service: "style-assistant-api",
      timestamp: new Date().toISOString(),
      requestId: headerRequestId || null,
      nodeEnv: process.env.NODE_ENV || "unknown",
    });
  });

  app.post("/api/auth/register", async (req, res) => {
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
      const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail));
      if (existing) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const [newUser] = await db
        .insert(users)
        .values({
          id: randomUUID(),
          email: normalizedEmail,
          name: name.trim(),
          passwordHash: hashPassword(password),
          authProvider: "email",
          credits: getInitialCredits(),
        })
        .returning();

      const accessToken = generateAccessToken({
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      });
      const refreshToken = generateRefreshToken();
      await createSession(newUser.id, refreshToken);

      res.status(201).json({
        user: sanitizeUser(newUser),
        accessToken,
        refreshToken,
      });
    } catch (error: unknown) {
      console.error("Register error:", error);
      res.status(500).json({ error: toErrorMessage(error, "Registration failed") });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body ?? {};
      if (!email?.trim() || !password?.trim()) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const [user] = await db.select().from(users).where(eq(users.email, normalizeEmail(email)));
      if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const accessToken = generateAccessToken({
        id: user.id,
        email: user.email,
        name: user.name,
      });
      const refreshToken = generateRefreshToken();
      await createSession(user.id, refreshToken);

      res.json({
        user: sanitizeUser(user),
        accessToken,
        refreshToken,
      });
    } catch (error: unknown) {
      console.error("Login error:", error);
      res.status(500).json({ error: toErrorMessage(error, "Login failed") });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
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
      const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail));
      if (!user) {
        return res.status(404).json({ error: "No account found for this email" });
      }
      if (user.authProvider !== "email" || !user.passwordHash) {
        return res.status(400).json({
          error: "This account uses social sign-in. Use Apple or Google sign-in instead.",
        });
      }

      const [updated] = await db
        .update(users)
        .set({
          passwordHash: hashPassword(newPassword),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning({ id: users.id });

      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }

      await revokeAllSessions(user.id);
      res.json({ success: true, message: "Password reset successful" });
    } catch (error: unknown) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: toErrorMessage(error, "Password reset failed") });
    }
  });

  app.post("/api/auth/social", async (req, res) => {
    try {
      const { provider, idToken, identityToken, email, name } = req.body ?? {};
      if (!provider || !["apple", "google"].includes(provider)) {
        return res.status(400).json({ error: "Invalid provider" });
      }

      let providerId = "";
      let normalizedEmail: string | null = null;
      let resolvedName =
        typeof name === "string" && name.trim().length > 0 ? name.trim() : null;

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

        const normalizedRequestEmail =
          typeof email === "string" && email.trim().length > 0
            ? normalizeEmail(email)
            : null;

        normalizedEmail = appleIdentity.email
          ? normalizeEmail(appleIdentity.email)
          : normalizedRequestEmail;

        if (!resolvedName) {
          resolvedName = "Apple User";
        }
      }

      const [existingByProvider] = await db
        .select()
        .from(users)
        .where(and(eq(users.authProvider, provider), eq(users.providerId, providerId)));

      let user = existingByProvider;
      if (!user) {
        if (!normalizedEmail) {
          return res.status(400).json({
            error: "No email received from provider. Please sign in again and share your email.",
          });
        }
        if (!isValidEmail(normalizedEmail)) {
          return res.status(400).json({ error: "Invalid email address" });
        }

        const [existingByEmail] = await db.select().from(users).where(eq(users.email, normalizedEmail));
        if (existingByEmail && existingByEmail.authProvider === "email") {
          return res.status(400).json({
            error: "This email is already used by an email/password account",
          });
        }

        if (existingByEmail) {
          const [updated] = await db
            .update(users)
            .set({
              authProvider: provider,
              providerId,
              name: resolvedName || existingByEmail.name,
              updatedAt: new Date(),
            })
            .where(eq(users.id, existingByEmail.id))
            .returning();
          user = updated;
        } else {
          const [created] = await db
            .insert(users)
            .values({
              id: randomUUID(),
              email: normalizedEmail,
              name: resolvedName || normalizedEmail.split("@")[0],
              authProvider: provider,
              providerId,
              credits: getInitialCredits(),
            })
            .returning();
          user = created;
        }
      }

      const accessToken = generateAccessToken({
        id: user.id,
        email: user.email,
        name: user.name,
      });
      const refreshToken = generateRefreshToken();
      await createSession(user.id, refreshToken);

      res.status(201).json({
        user: sanitizeUser(user),
        accessToken,
        refreshToken,
      });
    } catch (error: unknown) {
      console.error("Social login error:", error);
      res.status(500).json({ error: toErrorMessage(error, "Social login failed") });
    }
  });

  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body ?? {};
      if (!refreshToken) {
        return res.status(400).json({ error: "Refresh token is required" });
      }

      const userId = await validateRefreshToken(refreshToken);
      if (!userId) {
        return res.status(401).json({ error: "Invalid or expired refresh token" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));
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
          name: user.name,
        }),
        refreshToken: nextRefreshToken,
      });
    } catch (error: unknown) {
      console.error("Refresh error:", error);
      res.status(500).json({ error: toErrorMessage(error, "Failed to refresh session") });
    }
  });

  app.post("/api/auth/logout", authMiddleware, async (req, res) => {
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

  app.delete("/api/auth/account", authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const [deletedUser] = await db.delete(users).where(eq(users.id, userId)).returning({ id: users.id });
      if (!deletedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ success: true, message: "Account deleted successfully" });
    } catch (error) {
      console.error("Delete account error:", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  app.get("/api/profile", authMiddleware, async (req, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.user!.id));
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(sanitizeUser(user));
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({ error: "Failed to load profile" });
    }
  });

  app.put("/api/profile", authMiddleware, async (req, res) => {
    try {
      const { name, stylePreferences, favoriteLooks, notificationsEnabled, styleGender } = req.body ?? {};
      const updateData: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };

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

      const [updatedUser] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, req.user!.id))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(sanitizeUser(updatedUser));
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.post("/api/wardrobe/suggest", authMiddleware, async (req, res) => {
    try {
      const imageBase64 = normalizeStringValue(req.body?.imageBase64);
      if (!imageBase64) {
        return res.status(400).json({ error: "imageBase64 is required" });
      }
      const requestedModel = normalizeWardrobeSuggestModel(req.body?.model);

      const rawMimeType = normalizeStringValue(req.body?.mimeType).toLowerCase();
      const mimeType = rawMimeType.startsWith("image/") ? rawMimeType : "image/jpeg";
      const workerUrl = getWardrobeSuggestWorkerUrl();

      const runWorkerRequest = async (model: WardrobeSuggestModel) => {
        const timeoutController = new AbortController();
        const timeoutHandle = setTimeout(() => timeoutController.abort(), WARDROBE_SUGGEST_TIMEOUT_MS);
        try {
          const response = await fetch(workerUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              imageBase64,
              mimeType,
              model,
            }),
            signal: timeoutController.signal,
          });
          const text = await response.text();
          let payload: WardrobeSuggestWorkerPayload = {};
          try {
            payload = text ? (JSON.parse(text) as WardrobeSuggestWorkerPayload) : {};
          } catch {
            payload = {};
          }
          return { response, text, payload, model };
        } finally {
          clearTimeout(timeoutHandle);
        }
      };

      const payloadHasStructuredFields = (payload: WardrobeSuggestWorkerPayload): boolean =>
        Boolean(
          normalizeStringValue(payload.category) ||
            normalizeStringValue(payload.color) ||
            normalizeStringValue(payload.name) ||
            normalizeStringValue(payload.pattern) ||
            normalizeStringValue(payload.shade),
        );

      let workerAttempt = await runWorkerRequest(requestedModel);

      if (requestedModel !== "llava") {
        const needsLlavaFallback =
          !workerAttempt.response.ok || !payloadHasStructuredFields(workerAttempt.payload);
        if (needsLlavaFallback) {
          try {
            const llavaAttempt = await runWorkerRequest("llava");
            if (llavaAttempt.response.ok && payloadHasStructuredFields(llavaAttempt.payload)) {
              workerAttempt = llavaAttempt;
            }
          } catch (fallbackError: unknown) {
            if (process.env.NODE_ENV !== "production") {
              console.warn("Wardrobe suggest llava fallback failed:", fallbackError);
            }
          }
        }
      }

      const workerResponse = workerAttempt.response;
      const workerText = workerAttempt.text;
      const workerPayload = workerAttempt.payload;

      if (Object.keys(workerPayload).length === 0 && workerText.trim().length > 0) {
        const rawTextLower = workerText.toLowerCase();
        if (rawTextLower.includes("hello world")) {
          return res.status(502).json({
            error:
              "Wardrobe worker is still running Hello World template. Deploy wardrobe-suggest-worker code to the active worker.",
          });
        }
      }

      if (!workerResponse.ok) {
        const workerErrorMessage =
          normalizeStringValue(workerPayload?.error) ||
          normalizeStringValue(workerPayload?.details) ||
          workerText ||
          "Wardrobe suggestion worker returned an error.";
        return res.status(502).json({ error: workerErrorMessage });
      }

      const rawHintText =
        normalizeStringValue(workerPayload.raw) || normalizeStringValue(workerPayload.details);
      const candidateName = normalizeStringValue(workerPayload.name).slice(0, 80);
      const normalizedName = isGenericWardrobeName(candidateName) ? "" : candidateName;
      const normalizedCategory = normalizeWardrobeCategory(
        workerPayload.category || rawHintText || normalizedName,
      );
      const normalizedShade = normalizeWardrobeShade(workerPayload.shade);
      const inferredColorFromShade = inferWardrobeColorFromShade(normalizedShade);
      const normalizedColor = normalizeWardrobeColor(
        workerPayload.color || inferredColorFromShade || rawHintText || normalizedName,
      );
      const normalizedPattern = normalizeWardrobePattern(workerPayload.pattern || rawHintText || normalizedName);
      const normalizedConfidence = normalizeWardrobeConfidence(workerPayload.confidence);
      const modelUsed = normalizeWardrobeSuggestModel(workerPayload.modelUsed);

      const workerRaisedError = normalizeStringValue(workerPayload.error || workerPayload.details);
      if (!normalizedName && !normalizedCategory && !normalizedColor && workerRaisedError) {
        return res.status(502).json({ error: workerRaisedError });
      }

      if (!normalizedName && !normalizedCategory && !normalizedColor && !normalizedPattern) {
        return res.status(502).json({
          error: "Wardrobe worker returned an unstructured response. Check worker deployment and model output.",
        });
      }

      return res.json({
        name: normalizedName || buildWardrobeFallbackName(normalizedCategory, normalizedColor),
        category: normalizedCategory,
        color: normalizedColor,
        shade: normalizedShade,
        pattern: normalizedPattern,
        confidence: normalizedConfidence,
        modelUsed: modelUsed === "auto" ? "" : modelUsed,
      });
    } catch (error: unknown) {
      console.error("Wardrobe suggest error:", error);
      const message = toErrorMessage(error, "Failed to suggest wardrobe details");
      const normalizedMessage = message.toLowerCase();
      const isWorkerConnectivityError =
        normalizedMessage.includes("fetch failed") ||
        normalizedMessage.includes("network") ||
        normalizedMessage.includes("timed out") ||
        normalizedMessage.includes("aborted");

      if (isWorkerConnectivityError) {
        return res.status(502).json({
          error: "Wardrobe suggestion service is unavailable. Check WARDROBE_SUGGEST_WORKER_URL.",
        });
      }

      return res.status(500).json({ error: message });
    }
  });

  app.post("/api/stripe/webhook", async (req, res) => {
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

      const event = (req.body && typeof req.body === "object" ? req.body : JSON.parse(payloadText || "{}")) as {
        type?: unknown;
        data?: { object?: unknown };
      };
      const eventType = normalizeStringValue(event.type);
      const payload = event.data?.object;

      if (!eventType || !payload || typeof payload !== "object") {
        return res.status(400).json({ error: "Invalid Stripe webhook payload" });
      }

      if (eventType === "checkout.session.completed") {
        await processPaidStripeSession(payload as StripeCheckoutSessionPayload);
      } else if (eventType === "invoice.paid") {
        await processPaidStripeInvoice(payload as StripeInvoicePayload);
      } else if (eventType === "charge.refunded") {
        const paymentIntentId = normalizeStringValue((payload as { payment_intent?: unknown }).payment_intent);
        if (paymentIntentId) {
          await processStripeCreditReversal(paymentIntentId, "refund");
        }
      } else if (eventType === "charge.dispute.created") {
        const paymentIntentId = normalizeStringValue((payload as { payment_intent?: unknown }).payment_intent);
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

  app.get("/api/credits", authMiddleware, async (req, res) => {
    try {
      const [user] = await db
        .select({ credits: users.credits, subscription: users.subscriptionPlan })
        .from(users)
        .where(eq(users.id, req.user!.id));
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Get credits error:", error);
      res.status(500).json({ error: "Failed to load credits" });
    }
  });

  app.post("/api/credits/use", authMiddleware, async (req, res) => {
    try {
      const { feature: rawFeature } = req.body ?? {};
      const feature = normalizeStringValue(rawFeature) || "style_generation";
      const consumed = await consumeCredits(req.user!.id, 1, feature);
      if (!consumed) {
        return res.status(402).json({ error: "Not enough credits" });
      }

      const [user] = await db.select({ credits: users.credits }).from(users).where(eq(users.id, req.user!.id));
      res.json({ success: true, credits: user?.credits ?? 0 });
    } catch (error) {
      console.error("Use credit error:", error);
      res.status(500).json({ error: "Failed to use credit" });
    }
  });

  app.post("/api/credits/dev-grant", authMiddleware, async (req, res) => {
    try {
      if (!isDevCreditGrantEnabled()) {
        return res.status(403).json({ error: "Developer credit grants are disabled." });
      }

      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const grantAmount = resolveDevCreditGrantAmount(req.body?.amount);
      const [user] = await db.select({ credits: users.credits }).from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const nextCredits = user.credits + grantAmount;
      await db
        .update(users)
        .set({ credits: nextCredits, updatedAt: new Date() })
        .where(eq(users.id, userId));

      await db.insert(creditTransactions).values({
        userId,
        type: "purchase",
        amountCredits: grantAmount,
        amountUsdCents: 0,
        source: "manual",
        description: "Developer test credit grant",
      });

      return res.json({
        success: true,
        grantedCredits: grantAmount,
        credits: nextCredits,
      });
    } catch (error: unknown) {
      console.error("Dev grant credits error:", error);
      return res.status(500).json({ error: toErrorMessage(error, "Failed to grant test credits") });
    }
  });

  app.get("/api/credits/packages", (_req, res) => {
    res.json(
      CREDIT_PACKAGES.map((pkg) => ({
        ...pkg,
        price: pkg.priceCents / 100,
      })),
    );
  });

  app.get("/api/credits/transactions", authMiddleware, async (req, res) => {
    try {
      const rows = await db
        .select()
        .from(creditTransactions)
        .where(eq(creditTransactions.userId, req.user!.id))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(50);

      res.json(rows);
    } catch (error) {
      console.error("Get transactions error:", error);
      res.status(500).json({ error: "Failed to load transactions" });
    }
  });

  app.post("/api/credits/subscription", authMiddleware, async (req, res) => {
    return res.status(410).json({
      error:
        "Direct subscription activation is disabled. Use /api/credits/checkout to start a paid subscription.",
    });
  });

  app.post("/api/credits/checkout", authMiddleware, async (req, res) => {
    try {
      const {
        itemType: rawItemType,
        itemId: rawItemId,
        successUrl: rawSuccessUrl,
        cancelUrl: rawCancelUrl,
      } = req.body ?? {};
      const itemType = normalizeStringValue(rawItemType);
      const itemId = normalizeStringValue(rawItemId);
      const successUrl = normalizeStringValue(rawSuccessUrl);
      const cancelUrl = normalizeStringValue(rawCancelUrl);
      if (!itemType || !itemId) {
        return res.status(400).json({ error: "itemType and itemId are required" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, req.user!.id));
      if (!user) return res.status(404).json({ error: "User not found" });

      const defaultBaseUrl = getDefaultBaseUrl(req);
      const mode = itemType === "subscription" ? "subscription" : "payment";

      const safeSuccessUrl =
        successUrl.length > 0
          ? successUrl
          : `${defaultBaseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
      const safeCancelUrl =
        cancelUrl.length > 0
          ? cancelUrl
          : `${defaultBaseUrl}/credits`;

      if (mode === "payment") {
        const pkg = CREDIT_PACKAGES.find((p) => p.id === itemId);
        if (!pkg) return res.status(400).json({ error: "Invalid package" });

        const session = await createStripeCheckoutSession({
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
            credits: String(pkg.credits),
          },
        });

        return res.json({ url: session.url, sessionId: session.id });
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
          credits: String(plan.creditsPerMonth),
        },
      });

      return res.json({ url: session.url, sessionId: session.id });
    } catch (error: unknown) {
      console.error("Checkout error:", error);
      res.status(500).json({ error: toErrorMessage(error, "Failed to create checkout session") });
    }
  });

  app.get("/api/credits/verify-session/:sessionId", authMiddleware, async (req, res) => {
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
      if (!userId || userId !== req.user!.id) {
        return res.status(403).json({ error: "Session does not belong to this user" });
      }

      await processPaidStripeSession(session as StripeCheckoutSessionPayload);

      const [updatedUser] = await db
        .select({ credits: users.credits, subscription: users.subscriptionPlan })
        .from(users)
        .where(eq(users.id, req.user!.id));

      res.json({
        success: true,
        credits: updatedUser?.credits || 0,
        subscription: updatedUser?.subscription || null,
      });
    } catch (error: unknown) {
      console.error("Verify session error:", error);
      res.status(500).json({ error: toErrorMessage(error, "Failed to verify payment session") });
    }
  });

  app.post("/api/credits/apple-verify", authMiddleware, async (req, res) => {
    try {
      const userId = req.user!.id;
      const receiptData = normalizeStringValue(req.body?.receiptData);
      const productId = normalizeStringValue(req.body?.productId);

      if (!receiptData || !productId) {
        return res.status(400).json({ success: false, error: "Missing receipt data or product ID" });
      }

      const expectedCredits = APPLE_IAP_PRODUCT_CREDITS[productId];
      if (!expectedCredits) {
        return res.status(400).json({ success: false, error: "Unknown Apple product ID" });
      }

      const verifyReceipt = async (url: string) => {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            "receipt-data": receiptData,
            password: process.env.APPLE_SHARED_SECRET || "",
            "exclude-old-transactions": true,
          }),
        });
        return response.json();
      };

      let appleResult = await verifyReceipt(
        process.env.NODE_ENV === "production"
          ? "https://buy.itunes.apple.com/verifyReceipt"
          : "https://sandbox.itunes.apple.com/verifyReceipt",
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
        process.env.APPLE_BUNDLE_ID || process.env.EXPO_PUBLIC_APPLE_BUNDLE_ID,
      );
      const receiptBundleId = normalizeStringValue(appleResult?.receipt?.bundle_id);
      if (expectedBundleId && receiptBundleId !== expectedBundleId) {
        return res.status(400).json({ success: false, error: "Apple receipt bundle ID mismatch" });
      }

      const inAppItems = Array.isArray(appleResult?.latest_receipt_info)
        ? appleResult.latest_receipt_info
        : Array.isArray(appleResult?.receipt?.in_app)
          ? appleResult.receipt.in_app
          : [];
      const matchingTransactions = inAppItems
        .filter((item: any) => item?.product_id === productId)
        .sort((a: any, b: any) => {
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

        const [existing] = await db
          .select({ id: creditTransactions.id })
          .from(creditTransactions)
          .where(eq(creditTransactions.stripePaymentIntentId, candidateId));
        if (!existing) {
          transactionId = candidateId;
          break;
        }
      }

      if (!transactionId) {
        const [existingUser] = await db
          .select({ credits: users.credits })
          .from(users)
          .where(eq(users.id, userId));
        return res.json({
          success: true,
          credits: existingUser?.credits ?? 0,
          message: "Apple transaction already processed",
        });
      }

      const [user] = await db
        .select({ credits: users.credits })
        .from(users)
        .where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      await db
        .update(users)
        .set({
          credits: user.credits + expectedCredits,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      await db.insert(creditTransactions).values({
        userId,
        type: "purchase",
        amountCredits: expectedCredits,
        amountUsdCents: null,
        source: "app",
        description: "Apple in-app credit purchase",
        stripePaymentIntentId: transactionId,
      });

      const [updatedUser] = await db
        .select({ credits: users.credits })
        .from(users)
        .where(eq(users.id, userId));

      return res.json({ success: true, credits: updatedUser?.credits ?? user.credits + expectedCredits });
    } catch (error) {
      console.error("Apple verify error:", error);
      return res.status(500).json({ success: false, error: "Failed to verify Apple purchase" });
    }
  });

  app.post("/api/credits/google-verify", authMiddleware, async (req, res) => {
    try {
      const userId = req.user!.id;
      const purchaseToken = normalizeStringValue(req.body?.purchaseToken);
      const productId = normalizeStringValue(req.body?.productId);

      if (!purchaseToken || !productId) {
        return res.status(400).json({ success: false, error: "Missing purchase token or product ID" });
      }

      const expectedCredits = GOOGLE_IAP_PRODUCT_CREDITS[productId];
      if (!expectedCredits) {
        return res.status(400).json({ success: false, error: "Unknown Google product ID" });
      }

      const [existingTransaction] = await db
        .select({ id: creditTransactions.id })
        .from(creditTransactions)
        .where(eq(creditTransactions.stripePaymentIntentId, purchaseToken));
      if (existingTransaction) {
        const [existingUser] = await db
          .select({ credits: users.credits })
          .from(users)
          .where(eq(users.id, userId));
        return res.json({
          success: true,
          credits: existingUser?.credits ?? 0,
          message: "Google transaction already processed",
        });
      }

      const isDev = process.env.NODE_ENV !== "production";
      const allowBypass = isDev && normalizeStringValue(process.env.ALLOW_GOOGLE_IAP_BYPASS).toLowerCase() === "true";
      const serviceAccountJson = normalizeStringValue(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT);
      const useDevBypass = isDev && (allowBypass || !serviceAccountJson);

      if (useDevBypass) {
        const [user] = await db
          .select({ credits: users.credits })
          .from(users)
          .where(eq(users.id, userId));
        if (!user) {
          return res.status(404).json({ success: false, error: "User not found" });
        }

        await db
          .update(users)
          .set({
            credits: user.credits + expectedCredits,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));

        await db.insert(creditTransactions).values({
          userId,
          type: "purchase",
          amountCredits: expectedCredits,
          amountUsdCents: null,
          source: "app",
          description: allowBypass
            ? "Google Play purchase (dev bypass)"
            : "Google Play purchase (dev fallback: missing service account)",
          stripePaymentIntentId: purchaseToken,
        });

        const [updatedUser] = await db
          .select({ credits: users.credits })
          .from(users)
          .where(eq(users.id, userId));
        return res.json({
          success: true,
          credits: updatedUser?.credits ?? user.credits + expectedCredits,
          bypass: true,
        });
      }

      if (!serviceAccountJson) {
        return res.status(500).json({ success: false, error: "Google verification is not configured" });
      }

      const parsedServiceAccount = JSON.parse(serviceAccountJson) as {
        client_email?: string;
        private_key?: string;
      };
      const serviceAccount = {
        client_email: normalizeStringValue(parsedServiceAccount.client_email),
        private_key: normalizeStringValue(parsedServiceAccount.private_key).replace(/\\n/g, "\n"),
      };
      if (!serviceAccount.client_email || !serviceAccount.private_key) {
        return res.status(500).json({ success: false, error: "Google verification credentials are invalid" });
      }
      const packageName = normalizeStringValue(process.env.GOOGLE_PLAY_PACKAGE_NAME) || "com.iulia.muse";
      const jwt = await createGoogleJwt(serviceAccount);
      const accessToken = await getGoogleAccessToken(jwt);

      const verifyUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
        packageName,
      )}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
      const verifyResponse = await fetch(verifyUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!verifyResponse.ok) {
        const errorText = await verifyResponse.text();
        console.error("Google verification failed:", errorText);
        return res.status(400).json({ success: false, error: "Google purchase verification failed" });
      }

      const purchaseData = (await verifyResponse.json()) as {
        purchaseState?: number;
        acknowledgementState?: number;
      };
      if (purchaseData.purchaseState !== 0) {
        return res.status(400).json({ success: false, error: "Google purchase is not completed" });
      }

      if (purchaseData.acknowledgementState !== 1) {
        const acknowledgeUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
          packageName,
        )}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(
          purchaseToken,
        )}:acknowledge`;
        await fetch(acknowledgeUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });
      }

      const [user] = await db
        .select({ credits: users.credits })
        .from(users)
        .where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      await db
        .update(users)
        .set({
          credits: user.credits + expectedCredits,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      await db.insert(creditTransactions).values({
        userId,
        type: "purchase",
        amountCredits: expectedCredits,
        amountUsdCents: null,
        source: "app",
        description: "Google Play credit purchase",
        stripePaymentIntentId: purchaseToken,
      });

      const [updatedUser] = await db
        .select({ credits: users.credits })
        .from(users)
        .where(eq(users.id, userId));
      return res.json({ success: true, credits: updatedUser?.credits ?? user.credits + expectedCredits });
    } catch (error) {
      console.error("Google verify error:", error);
      return res.status(500).json({ success: false, error: "Failed to verify Google purchase" });
    }
  });

  app.post("/api/style", authMiddleware, async (req, res) => {
    const userId = req.user!.id;
    const body = req.body || {};
    const outputMode: StyleOutputMode = normalizeOutputMode(body.outputMode);
    const imageInputMode: ImageInputMode = normalizeImageInputMode(body.imageInputMode);
    const sourceMode: StylingSourceMode = normalizeStylingSourceMode(body.sourceMode);
    const allowExtraPieces =
      body.allowExtraPieces === true || sourceMode === "saved_wardrobe_plus";
    const creditCost = STYLE_COSTS[outputMode];

    const normalizedItems = normalizeRequestedItems(body.items);

    const occasion: string = normalizeStringValue(body.occasion) || "Any occasion";
    const gender: StyleGender = normalizeStyleGender(body.gender);
    const event: string = normalizeStringValue(body.event);
    const season: string = normalizeStringValue(body.season);
    const aesthetic: string = normalizeStringValue(body.aesthetic);
    const colorPalette: string = normalizeStringValue(body.colorPalette);
    const customPrompt: string = normalizeStringValue(body.customPrompt);
    const requiredPieces: string[] = normalizeStringList(body.requiredPieces);

    let uploadedImages: UploadedReferenceImage[] = [];
    try {
      uploadedImages = normalizeUploadedImages(body.photos, imageInputMode);
    } catch (error: unknown) {
      return res.status(400).json({ error: toErrorMessage(error, "Invalid image payload") });
    }

    if (sourceMode === "photo_only" && uploadedImages.length === 0) {
      return res.status(400).json({
        error: "Photo styling mode requires at least one uploaded photo.",
      });
    }

    if (
      (sourceMode === "saved_wardrobe" || sourceMode === "saved_wardrobe_plus") &&
      normalizedItems.length === 0
    ) {
      return res.status(400).json({
        error: "Wardrobe styling mode requires at least one selected wardrobe item.",
      });
    }

    if (
      normalizedItems.length === 0 &&
      uploadedImages.length === 0 &&
      !event &&
      !customPrompt &&
      requiredPieces.length === 0
    ) {
      return res.status(400).json({
        error: "Add at least one item, one image, event details, a required piece, or a custom request.",
      });
    }

    let creditsConsumed = false;
    try {
      const consumed = await consumeCredits(userId, creditCost, `style_generation_${outputMode}`);
      if (!consumed) {
        return res.status(402).json({
          error: `Not enough credits. This request costs ${creditCost} credits.`,
          requiredCredits: creditCost,
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
          allowExtraPieces,
        }),
      });

      let imageBase64: string | undefined;
      let debugImagePrompt: string | undefined;
      if (outputMode === "image") {
        const imagePrompt = buildImageGenerationPrompt({
          imagePrompt: stylingPlan.imagePrompt,
          usedPieces: stylingPlan.usedPieces,
          hasReferenceImages: uploadedImages.length > 0,
          imageInputMode,
          isModification: false,
        });
        debugImagePrompt = imagePrompt;
        const imageParts: GeminiPart[] = [{ text: imagePrompt }, ...toGeminiInlineImageParts(uploadedImages)];
        const imageResponse = await generateGeminiContent({
          model: DEFAULT_STYLE_IMAGE_MODEL,
          parts: imageParts,
          responseModalities: ["IMAGE", "TEXT"],
          maxOutputTokens: 800,
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
        ...(EXPOSE_STYLE_DEBUG_PROMPT ? { debugImagePrompt } : {}),
      });
    } catch (error: unknown) {
      console.error("Styling error:", error);
      if (creditsConsumed) {
        await refundCredits(userId, creditCost, `style_generation_${outputMode}_failed`);
      }
      const errorMessage: string = toErrorMessage(error, "Failed to generate styling");
      if (errorMessage.startsWith("AI_NOT_CONFIGURED:")) {
        return res.status(503).json({ error: errorMessage.replace("AI_NOT_CONFIGURED: ", "") });
      }
      res.status(500).json({ error: errorMessage });
    }
  });

  app.post("/api/style/modify", authMiddleware, async (req, res) => {
    const userId = req.user!.id;
    const body = req.body || {};
    const outputMode: StyleOutputMode = normalizeOutputMode(body.outputMode);
    const imageInputMode: ImageInputMode = normalizeImageInputMode(body.imageInputMode);
    const sourceMode: StylingSourceMode = normalizeStylingSourceMode(body.sourceMode);
    const allowExtraPieces =
      body.allowExtraPieces === true || sourceMode === "saved_wardrobe_plus";
    const creditCost = STYLE_COSTS[outputMode];

    const originalDescription: string = normalizeStringValue(body.originalDescription);
    const originalTips: string[] = normalizeStringList(body.originalTips);
    const modifyRequest: string = normalizeStringValue(body.modifyRequest);
    const occasion: string = normalizeStringValue(body.occasion) || "Any occasion";
    const gender: StyleGender = normalizeStyleGender(body.gender);
    const event: string = normalizeStringValue(body.event);
    const season: string = normalizeStringValue(body.season);
    const aesthetic: string = normalizeStringValue(body.aesthetic);
    const colorPalette: string = normalizeStringValue(body.colorPalette);
    const customPrompt: string = normalizeStringValue(body.customPrompt);
    const requiredPieces: string[] = normalizeStringList(body.requiredPieces);

    if (!modifyRequest) {
      return res.status(400).json({ error: "A modification request is required." });
    }

    const normalizedItems = normalizeRequestedItems(body.items);

    let uploadedImages: UploadedReferenceImage[] = [];
    try {
      uploadedImages = normalizeUploadedImages(body.photos, imageInputMode);
    } catch (error: unknown) {
      return res.status(400).json({ error: toErrorMessage(error, "Invalid image payload") });
    }

    if (sourceMode === "photo_only" && uploadedImages.length === 0) {
      return res.status(400).json({
        error: "Photo styling mode requires at least one uploaded photo.",
      });
    }

    if (
      (sourceMode === "saved_wardrobe" || sourceMode === "saved_wardrobe_plus") &&
      normalizedItems.length === 0
    ) {
      return res.status(400).json({
        error: "Wardrobe styling mode requires at least one selected wardrobe item.",
      });
    }

    let creditsConsumed = false;
    try {
      const consumed = await consumeCredits(userId, creditCost, `style_modify_${outputMode}`);
      if (!consumed) {
        return res.status(402).json({
          error: `Not enough credits. This request costs ${creditCost} credits.`,
          requiredCredits: creditCost,
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
          allowExtraPieces,
        }),
      });

      let imageBase64: string | undefined;
      let debugImagePrompt: string | undefined;
      if (outputMode === "image") {
        const imagePrompt = buildImageGenerationPrompt({
          imagePrompt: stylingPlan.imagePrompt,
          usedPieces: stylingPlan.usedPieces,
          hasReferenceImages: uploadedImages.length > 0,
          imageInputMode,
          isModification: true,
        });
        debugImagePrompt = imagePrompt;
        const imageParts: GeminiPart[] = [{ text: imagePrompt }, ...toGeminiInlineImageParts(uploadedImages)];
        const imageResponse = await generateGeminiContent({
          model: DEFAULT_STYLE_IMAGE_MODEL,
          parts: imageParts,
          responseModalities: ["IMAGE", "TEXT"],
          maxOutputTokens: 800,
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
        ...(EXPOSE_STYLE_DEBUG_PROMPT ? { debugImagePrompt } : {}),
      });
    } catch (error: unknown) {
      console.error("Modify error:", error);
      if (creditsConsumed) {
        await refundCredits(userId, creditCost, `style_modify_${outputMode}_failed`);
      }
      const errorMessage: string = toErrorMessage(error, "Failed to modify styling");
      if (errorMessage.startsWith("AI_NOT_CONFIGURED:")) {
        return res.status(503).json({ error: errorMessage.replace("AI_NOT_CONFIGURED: ", "") });
      }
      res.status(500).json({ error: errorMessage });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
