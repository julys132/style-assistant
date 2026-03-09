export interface Env {
	AI: Ai;
}

type WardrobeSuggestModel = "auto" | "uform" | "llava";
type ConcreteVisionModel = "uform" | "llava";

const MODEL_NAME: Record<ConcreteVisionModel, string> = {
	uform: "@cf/unum/uform-gen2-qwen-500m",
	llava: "@cf/llava-hf/llava-1.5-7b-hf",
};

const ALLOWED_CATEGORIES = [
	"Top",
	"Bottom",
	"Dress",
	"Outerwear",
	"Shoes",
	"Bag",
	"Accessory",
] as const;

const ALLOWED_COLORS = [
	"Black",
	"White",
	"Navy",
	"Beige",
	"Brown",
	"Blue",
	"Gray",
	"Red",
	"Pink",
	"Green",
	"Yellow",
	"Orange",
	"Purple",
	"Multi",
] as const;

const ALLOWED_PATTERNS = [
	"Solid",
	"Striped",
	"Floral",
	"Checked",
	"Graphic",
	"Other",
] as const;

type WardrobeSuggestion = {
	category: string;
	color: string;
	shade: string;
	name: string;
	pattern: string;
	confidence: number;
};

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"access-control-allow-origin": "*",
			"access-control-allow-methods": "POST, OPTIONS",
			"access-control-allow-headers": "Content-Type, Authorization",
		},
	});
}

function badRequest(message: string) {
	return json({ error: message }, 400);
}

function pickFirstString(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0
		? value
		: null;
}

function stripDataUriPrefix(base64OrDataUri: string): string {
	const commaIndex = base64OrDataUri.indexOf(",");
	return commaIndex >= 0
		? base64OrDataUri.slice(commaIndex + 1)
		: base64OrDataUri;
}

function decodeBase64ToBytes(base64OrDataUri: string): number[] | null {
	try {
		const normalized = stripDataUriPrefix(base64OrDataUri)
			.replace(/\s+/g, "")
			.trim();
		if (!normalized) return null;

		const binary = atob(normalized);
		const bytes = new Uint8Array(binary.length);
		for (let index = 0; index < binary.length; index += 1) {
			bytes[index] = binary.charCodeAt(index);
		}
		return Array.from(bytes);
	} catch {
		return null;
	}
}

function extractJsonObject(text: string): Record<string, unknown> | null {
	const match = text.match(/\{[\s\S]*\}/);
	if (!match) return null;

	try {
		return JSON.parse(match[0]) as Record<string, unknown>;
	} catch {
		return null;
	}
}

function cleanModelField(value: unknown): string {
	if (typeof value !== "string") return "";
	const trimmed = value.trim();
	if (!trimmed) return "";

	// Model sometimes echoes the enum template instead of choosing one value.
	if (
		trimmed.includes("|") ||
		trimmed.toLowerCase().includes("short user-friendly") ||
		trimmed.toLowerCase().includes("max 4 words")
	) {
		return "";
	}
	return trimmed;
}

function normalizeModelChoice(value: unknown): WardrobeSuggestModel {
	const normalized = cleanModelField(value).toLowerCase();
	if (normalized === "uform" || normalized === "llava") return normalized;
	return "auto";
}

function getModelOrder(requestedModel: WardrobeSuggestModel): ConcreteVisionModel[] {
	if (requestedModel === "uform") return ["uform", "llava"];
	if (requestedModel === "llava") return ["llava", "uform"];
	return ["uform", "llava"];
}

function normalizeEnumValue(
	value: unknown,
	allowedValues: readonly string[],
	synonyms: Record<string, string> = {},
): string {
	const cleaned = cleanModelField(value).toLowerCase();
	if (!cleaned) return "";

	if (synonyms[cleaned]) {
		return synonyms[cleaned];
	}

	const direct = allowedValues.find(
		(item) => item.toLowerCase() === cleaned,
	);
	if (direct) return direct;

	const contains = allowedValues.find((item) =>
		cleaned.includes(item.toLowerCase()),
	);
	return contains || "";
}

function normalizeShade(value: unknown): string {
	const cleaned = cleanModelField(value)
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (!cleaned || cleaned.includes("|")) return "";

	return cleaned
		.split(" ")
		.map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
		.slice(0, 3)
		.join(" ");
}

function normalizeName(value: unknown): string {
	const cleaned = cleanModelField(value)
		.replace(/[{}[\]"]/g, "")
		.replace(/\s+/g, " ")
		.trim();
	if (!cleaned) return "";

	return cleaned
		.split(" ")
		.filter(Boolean)
		.slice(0, 4)
		.join(" ");
}

function normalizeConfidence(value: unknown): number {
	const numeric =
		typeof value === "number" ? value : Number.parseFloat(String(value || ""));
	if (!Number.isFinite(numeric)) return 0;
	return Math.max(0, Math.min(1, Math.round(numeric * 100) / 100));
}

function extractModelText(result: unknown): string {
	const record = result as Record<string, unknown>;
	const nestedResult =
		typeof record.result === "object" && record.result !== null
			? (record.result as Record<string, unknown>)
			: null;

	return (
		pickFirstString(record.response) ||
		pickFirstString(nestedResult?.response) ||
		pickFirstString(record.text) ||
		pickFirstString(record.description) ||
		pickFirstString(nestedResult?.description) ||
		JSON.stringify(result)
	);
}

function inferCategoryFromText(text: string): string {
	const lower = text.toLowerCase();
	if (/(t-?shirt|tee|shirt|blouse|top|tank)/.test(lower)) return "Top";
	if (/(jeans|pants|trousers|shorts|skirt|leggings)/.test(lower)) return "Bottom";
	if (/(dress|gown)/.test(lower)) return "Dress";
	if (/(jacket|coat|blazer|hoodie|cardigan|outerwear|sweater)/.test(lower)) return "Outerwear";
	if (/(sneaker|shoe|shoes|boot|heel|sandals?)/.test(lower)) return "Shoes";
	if (/(bag|purse|tote|backpack|handbag)/.test(lower)) return "Bag";
	if (/(belt|hat|scarf|necklace|earring|bracelet|accessory)/.test(lower)) return "Accessory";
	return "";
}

function inferColorFromText(text: string): string {
	const lower = text.toLowerCase();
	if (/(charcoal|dark heather|heather|gray|grey|ash)/.test(lower)) return "Gray";
	if (/black/.test(lower)) return "Black";
	if (/white|ivory|cream/.test(lower)) return "White";
	if (/navy/.test(lower)) return "Navy";
	if (/beige|tan|sand/.test(lower)) return "Beige";
	if (/brown|chocolate|camel/.test(lower)) return "Brown";
	if (/blue|navy/.test(lower)) return "Blue";
	if (/red|burgundy|maroon/.test(lower)) return "Red";
	if (/pink/.test(lower)) return "Pink";
	if (/green|olive/.test(lower)) return "Green";
	if (/yellow|mustard/.test(lower)) return "Yellow";
	if (/orange/.test(lower)) return "Orange";
	if (/purple|violet/.test(lower)) return "Purple";
	if (/multi|multicolor|colourful|colorful/.test(lower)) return "Multi";
	return "";
}

function inferShadeFromText(text: string): string {
	const lower = text.toLowerCase();
	if (/(dark[\s_-]?heather)/.test(lower)) return "Dark Heather";
	if (/charcoal/.test(lower)) return "Charcoal";
	if (/oatmeal/.test(lower)) return "Oatmeal";
	if (/taupe/.test(lower)) return "Taupe";
	if (/(off[\s_-]?white)/.test(lower)) return "Off White";
	if (/stone/.test(lower)) return "Stone";
	if (/khaki/.test(lower)) return "Khaki";
	if (/ivory/.test(lower)) return "Ivory";
	if (/cream/.test(lower)) return "Cream";
	if (/burgundy/.test(lower)) return "Burgundy";
	if (/maroon/.test(lower)) return "Maroon";
	if (/sage/.test(lower)) return "Sage";
	if (/olive/.test(lower)) return "Olive";
	return "";
}

function inferBaseColorFromShade(shade: string): string {
	const normalized = shade.toLowerCase();
	if (!normalized) return "";
	if (normalized.includes("heather") || normalized.includes("charcoal")) return "Gray";
	if (
		normalized.includes("oatmeal") ||
		normalized.includes("taupe") ||
		normalized.includes("stone") ||
		normalized.includes("khaki")
	) {
		return "Beige";
	}
	if (
		normalized.includes("off white") ||
		normalized.includes("ivory") ||
		normalized.includes("cream")
	) {
		return "White";
	}
	if (normalized.includes("burgundy") || normalized.includes("maroon")) return "Red";
	if (normalized.includes("sage") || normalized.includes("olive")) return "Green";
	return "";
}

function inferPatternFromText(text: string): string {
	const lower = text.toLowerCase();
	if (/(striped|stripes)/.test(lower)) return "Striped";
	if (/floral/.test(lower)) return "Floral";
	if (/(checked|checkered|plaid)/.test(lower)) return "Checked";
	if (/(graphic|logo|print)/.test(lower)) return "Graphic";
	if (/(solid|plain)/.test(lower)) return "Solid";
	return "Solid";
}

function inferName(category: string, color: string, rawText: string): string {
	const inferredCategory = category || inferCategoryFromText(rawText) || "Top";
	const colorPrefix = color ? `${color.toLowerCase()} ` : "";

	switch (inferredCategory) {
		case "Top":
			return `${colorPrefix}t-shirt`.trim();
		case "Bottom":
			return `${colorPrefix}pants`.trim();
		case "Dress":
			return `${colorPrefix}dress`.trim();
		case "Outerwear":
			return `${colorPrefix}jacket`.trim();
		case "Shoes":
			return `${colorPrefix}shoes`.trim();
		case "Bag":
			return `${colorPrefix}bag`.trim();
		default:
			return `${colorPrefix}accessory`.trim();
	}
}

function parseSuggestionFromText(rawText: string): WardrobeSuggestion {
	let parsed = extractJsonObject(rawText);

	if (
		parsed &&
		!parsed.category &&
		!parsed.color &&
		!parsed.name &&
		!parsed.pattern &&
		typeof parsed.description === "string"
	) {
		parsed = extractJsonObject(parsed.description) || parsed;
	}

	const normalizedShade = normalizeShade(parsed?.shade) || inferShadeFromText(rawText);
	const normalizedColor = normalizeEnumValue(parsed?.color, ALLOWED_COLORS, {
		gray: "Gray",
		grey: "Gray",
		charcoal: "Gray",
		darkheather: "Gray",
		dark_heather: "Gray",
		heather: "Gray",
		ash: "Gray",
		ivory: "White",
		cream: "White",
		navyblue: "Navy",
		tan: "Beige",
		camel: "Beige",
	}) || inferBaseColorFromShade(normalizedShade) || inferColorFromText(rawText);

	const normalizedCategory =
		normalizeEnumValue(parsed?.category, ALLOWED_CATEGORIES) || inferCategoryFromText(rawText);
	const normalizedPattern =
		normalizeEnumValue(parsed?.pattern, ALLOWED_PATTERNS, {
			checkered: "Checked",
			plaid: "Checked",
		}) || inferPatternFromText(rawText);
	const normalizedName =
		normalizeName(parsed?.name) || inferName(normalizedCategory, normalizedColor, rawText);
	const normalizedConfidence =
		parsed && Object.prototype.hasOwnProperty.call(parsed, "confidence")
			? normalizeConfidence(parsed.confidence)
			: 0.45;

	return {
		category: normalizedCategory,
		color: normalizedColor,
		shade: normalizedShade,
		name: normalizedName,
		pattern: normalizedPattern,
		confidence: normalizedConfidence,
	};
}

function scoreSuggestion(suggestion: WardrobeSuggestion): number {
	let score = 0;
	if (suggestion.category) score += 1;
	if (suggestion.color) score += 1;
	if (suggestion.name) score += 1;
	if (suggestion.pattern) score += 0.5;
	if (suggestion.shade) score += 0.25;
	if (suggestion.confidence > 0) score += 0.25;
	return score;
}

async function runModel(
	env: Env,
	model: ConcreteVisionModel,
	image: number[],
	prompt: string,
): Promise<{ rawText: string; modelName: string }> {
	const result = await env.AI.run(MODEL_NAME[model], {
		image,
		prompt,
		max_tokens: 200,
		temperature: 0.1,
	});

	return {
		rawText: extractModelText(result),
		modelName: MODEL_NAME[model],
	};
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: {
					"access-control-allow-origin": "*",
					"access-control-allow-methods": "POST, OPTIONS",
					"access-control-allow-headers": "Content-Type, Authorization",
				},
			});
		}

		const url = new URL(request.url);

		if (url.pathname !== "/suggest-wardrobe") {
			return json({ error: "Not found" }, 404);
		}

		if (request.method !== "POST") {
			return json({ error: "Method not allowed" }, 405);
		}

		let body: Record<string, unknown>;
		try {
			body = (await request.json()) as Record<string, unknown>;
		} catch {
			return badRequest("Invalid JSON body.");
		}

		const imageBase64 = body.imageBase64;

		if (!imageBase64 || typeof imageBase64 !== "string") {
			return badRequest("imageBase64 is required.");
		}
		const requestedModel = normalizeModelChoice(body.model);
		const modelOrder = getModelOrder(requestedModel);
		const imageBytes = decodeBase64ToBytes(imageBase64);
		if (!imageBytes) {
			return badRequest("imageBase64 is invalid or cannot be decoded.");
		}

		const prompt = `
Describe the main clothing item in the image.
Return ONLY JSON:
{
  "category": "Top",
  "color": "Gray",
  "shade": "Dark Heather",
  "name": "gray t-shirt",
  "pattern": "Solid",
  "confidence": 0.9
}
Use exactly one value for category from: Top, Bottom, Dress, Outerwear, Shoes, Bag, Accessory.
Use exactly one value for color from: Black, White, Navy, Beige, Brown, Blue, Gray, Red, Pink, Green, Yellow, Orange, Purple, Multi.
shade is optional. If unknown use an empty string.
Use exactly one value for pattern from: Solid, Striped, Floral, Checked, Graphic, Other.
		`.trim();

		let best: {
			modelUsed: ConcreteVisionModel;
			modelName: string;
			rawText: string;
			suggestion: WardrobeSuggestion;
			score: number;
		} | null = null;
		let lastError = "";
		const modelsTried: ConcreteVisionModel[] = [];

		for (const model of modelOrder) {
			modelsTried.push(model);
			try {
				const response = await runModel(env, model, imageBytes, prompt);
				const suggestion = parseSuggestionFromText(response.rawText);
				const score = scoreSuggestion(suggestion);

				if (!best || score > best.score) {
					best = {
						modelUsed: model,
						modelName: response.modelName,
						rawText: response.rawText,
						suggestion,
						score,
					};
				}

				// Accept early when we have a usable structured result.
				if (suggestion.category && suggestion.color && suggestion.name) {
					return json({
						...suggestion,
						modelUsed: model,
						modelName: response.modelName,
						modelsTried,
						raw: response.rawText,
					});
				}
			} catch (error: unknown) {
				lastError = error instanceof Error ? error.message : String(error);
			}
		}

		if (best) {
			return json({
				...best.suggestion,
				modelUsed: best.modelUsed,
				modelName: best.modelName,
				modelsTried,
				raw: best.rawText,
			});
		}

		return json(
			{
				error: "Workers AI request failed.",
				details: lastError || "No usable output from configured models.",
				modelsTried,
			},
			500,
		);
	},
};
