import type { Express } from "express";
import { createServer, type Server } from "node:http";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/style", async (req, res) => {
    try {
      const { items, occasion, customPrompt, hasPhotos, photoCount } = req.body;

      let prompt = "You are an expert personal fashion stylist. ";

      if (items && items.length > 0) {
        const itemDescriptions = items.map(
          (item: any) => `${item.name} (${item.category}, ${item.color}${item.description ? `, ${item.description}` : ""})`
        );
        prompt += `The client has the following wardrobe items: ${itemDescriptions.join(", ")}. `;
      }

      if (hasPhotos) {
        prompt += `The client has also uploaded ${photoCount} reference photo(s) of clothing they want to include. Consider these as additional styling references. `;
      }

      prompt += `The occasion is: ${occasion}. `;

      if (customPrompt) {
        prompt += `Additional request: ${customPrompt}. `;
      }

      prompt += `Create a stunning outfit combination. Respond in JSON format with:
{
  "description": "A detailed description of the complete outfit and how pieces work together (2-3 sentences)",
  "tips": ["tip1", "tip2", "tip3", "tip4"],
  "imagePrompt": "A detailed fashion illustration prompt describing the complete styled outfit on a model"
}

Make the styling advice specific, actionable, and aimed at creating a wow effect. Focus on color coordination, proportions, textures, and accessories.`;

      const chatResponse = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 8192,
      });

      const content = chatResponse.choices[0]?.message?.content || "{}";
      const styling = JSON.parse(content);

      let imageBase64: string | undefined;
      try {
        const imagePrompt = `High-fashion editorial photograph, professional studio lighting, fashion model wearing: ${styling.imagePrompt || styling.description}. Vogue magazine style, full body shot, black background, dramatic lighting, haute couture aesthetic. No text or watermarks.`;

        const imageResponse = await openai.images.generate({
          model: "gpt-image-1",
          prompt: imagePrompt,
          n: 1,
          size: "1024x1024",
        });

        imageBase64 = imageResponse.data[0]?.b64_json;
      } catch (imgError) {
        console.error("Image generation failed:", imgError);
      }

      res.json({
        description: styling.description || "A beautifully styled outfit combination.",
        tips: styling.tips || [],
        imageBase64,
      });
    } catch (error) {
      console.error("Styling error:", error);
      res.status(500).json({ error: "Failed to generate styling" });
    }
  });

  app.post("/api/style/modify", async (req, res) => {
    try {
      const { originalDescription, originalTips, modifyRequest, items, occasion } = req.body;

      let prompt = "You are an expert personal fashion stylist. ";
      prompt += `The client previously received this outfit suggestion: "${originalDescription}". `;
      prompt += `Previous styling tips were: ${originalTips.join("; ")}. `;

      if (items && items.length > 0) {
        const itemDescriptions = items.map(
          (item: any) => `${item.name} (${item.category}, ${item.color})`
        );
        prompt += `Available wardrobe items: ${itemDescriptions.join(", ")}. `;
      }

      prompt += `The occasion is: ${occasion}. `;
      prompt += `The client wants the following modifications: ${modifyRequest}. `;
      prompt += `Create a modified outfit based on these changes. Respond in JSON format with:
{
  "description": "A detailed description of the modified outfit (2-3 sentences)",
  "tips": ["tip1", "tip2", "tip3", "tip4"],
  "imagePrompt": "A detailed fashion illustration prompt describing the modified styled outfit on a model"
}

Make the modifications meaningful while maintaining overall style coherence.`;

      const chatResponse = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 8192,
      });

      const content = chatResponse.choices[0]?.message?.content || "{}";
      const styling = JSON.parse(content);

      let imageBase64: string | undefined;
      try {
        const imagePrompt = `High-fashion editorial photograph, professional studio lighting, fashion model wearing: ${styling.imagePrompt || styling.description}. Vogue magazine style, full body shot, black background, dramatic lighting, haute couture aesthetic. No text or watermarks.`;

        const imageResponse = await openai.images.generate({
          model: "gpt-image-1",
          prompt: imagePrompt,
          n: 1,
          size: "1024x1024",
        });

        imageBase64 = imageResponse.data[0]?.b64_json;
      } catch (imgError) {
        console.error("Image generation failed:", imgError);
      }

      res.json({
        description: styling.description || "A modified outfit combination.",
        tips: styling.tips || [],
        imageBase64,
      });
    } catch (error) {
      console.error("Modify error:", error);
      res.status(500).json({ error: "Failed to modify styling" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
