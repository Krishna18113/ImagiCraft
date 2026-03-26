import { z } from "zod";
import { Hono } from "hono";
import { verifyAuth } from "@hono/auth-js";
import { zValidator } from "@hono/zod-validator";


const app = new Hono()
  .post(
    "/remove-bg",
    verifyAuth(),
    zValidator(
      "json",
      z.object({
        image: z.string(),
      }),
    ),
    async (c) => {
      try {
        const { image } = c.req.valid("json");
        const base64Data = image.replace(/^data:image\/[a-zA-Z0-9+\.-]+;base64,/, "");

        // Convert base64 to Blob instead of Buffer for Edge compatibility
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const imageBlob = new Blob([byteArray], { type: "image/png" });

        const formData = new FormData();
        formData.append("image_file", imageBlob, "image.png");
        formData.append("size", "auto");

        const response = await fetch(
          "https://api.remove.bg/v1.0/removebg",
          {
            headers: {
              "X-Api-Key": process.env.REMOVE_BG_API_KEY || "",
            },
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Remove.bg API Error Details:", response.status, errorText);
          throw new Error(`Remove.bg API Error: ${response.status} - ${errorText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const dataUrl = `data:image/png;base64,${base64}`;

        return c.json({ data: dataUrl });
      } catch (error: any) {
        console.error("Remove.bg API Error:", error.message || error);
        return c.json(
          { error: error.message || "Failed to remove background." },
          500
        );
      }
    },
  )
  .post(
    "/generate-image",
    verifyAuth(),
    zValidator(
      "json",
      z.object({
        prompt: z.string(),
      }),
    ),
    async (c) => {
      const { prompt } = c.req.valid("json");

      try {
        const response = await fetch(
          "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
          {
            headers: {
              Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
              "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({ inputs: prompt }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HF API Error: ${response.status} - ${errorText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const dataUrl = `data:image/jpeg;base64,${base64}`;

        return c.json({ data: dataUrl });
      } catch (error: any) {
        console.error("Hugging Face API Error:", error.message || error);
        return c.json(
          { error: error.message || "Failed to generate image." },
          500
        );
      }
    },
  )
  .post(
    "/generate-text",
    verifyAuth(),
    zValidator(
      "json",
      z.object({
        prompt: z.string(),
        type: z.enum(["headline", "tagline", "body", "custom"]).default("custom"),
      }),
    ),
    async (c) => {
      const { prompt, type } = c.req.valid("json");

      const systemPrompts: Record<string, string> = {
        headline: "Generate a short, punchy headline (max 8 words) for a design project. Only output the headline text, nothing else.",
        tagline: "Generate a catchy tagline or slogan (max 12 words) for a design project. Only output the tagline text, nothing else.",
        body: "Generate a short body paragraph (2-3 sentences max) for a design project. Only output the paragraph text, nothing else.",
        custom: "Generate design-ready text based on the user's request. Be concise and creative. Only output the text, nothing else.",
      };

      try {
        const response = await fetch(
          "https://router.huggingface.co/hf-inference/models/mistralai/Mistral-7B-Instruct-v0.3/v1/chat/completions",
          {
            headers: {
              Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
              "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({
              model: "mistralai/Mistral-7B-Instruct-v0.3",
              messages: [
                { role: "system", content: systemPrompts[type] || systemPrompts.custom },
                { role: "user", content: prompt },
              ],
              max_tokens: 150,
              temperature: 0.8,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HF API Error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        const text = result.choices?.[0]?.message?.content?.trim() || "Could not generate text.";

        return c.json({ data: text });
      } catch (error: any) {
        console.error("AI Text Generation Error:", error.message || error);
        return c.json(
          { error: error.message || "Failed to generate text." },
          500
        );
      }
    },
  );

export default app;
