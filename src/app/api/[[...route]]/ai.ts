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

        let imageBlob: Blob;

        if (image.startsWith("data:")) {
          // Handle base64 data URL
          const base64Data = image.replace(/^data:image\/[a-zA-Z0-9+\.-]+;base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");
          imageBlob = new Blob([new Uint8Array(buffer)], { type: "image/png" });
        } else {
          // Handle regular URL — fetch the image bytes first
          const imgResponse = await fetch(image);
          if (!imgResponse.ok) {
            throw new Error(`Failed to fetch image from URL: ${imgResponse.status}`);
          }
          const imgBuffer = await imgResponse.arrayBuffer();
          imageBlob = new Blob([imgBuffer], { type: "image/png" });
        }

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
        // ── Step 1: Smart-rephrase the prompt via LLM ──────────────────────
        // This converts vague/person-name prompts into vivid visual descriptions
        // that image models can actually generate well.
        let imagePrompt = prompt;

        try {
          const rephraseRes = await fetch(
            "https://router.huggingface.co/novita/v3/openai/chat/completions",
            {
              headers: {
                Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                "Content-Type": "application/json",
              },
              method: "POST",
              body: JSON.stringify({
                model: "meta-llama/llama-3.1-8b-instruct",
                messages: [
                  {
                    role: "system",
                    content: `You are a prompt engineer for AI image generation models like FLUX and Stable Diffusion.

Your job: Take the user's request and rewrite it as a detailed, vivid visual description optimized for image generation.

RULES:
- NEVER use real person names (politicians, celebrities, etc). Instead, describe their appearance, attire, setting, and pose in detail.
- If the user mentions a real person, describe what they LOOK LIKE (physical features, clothing, expression, setting) without naming them.
- Add artistic details: lighting, camera angle, style, mood, colors.
- Keep it under 80 words.
- Output ONLY the rephrased prompt. No quotes, no explanation, no markdown.

Examples:
- "prime minister modi" → "A distinguished Indian man with a white beard, wearing a cream-colored kurta and vest, giving a powerful speech at a massive outdoor rally with Indian flags, dramatic sunset lighting, photorealistic, 8k"
- "elon musk" → "A tall businessman with short brown hair in a dark suit, standing in front of a SpaceX rocket on a launch pad, cinematic lighting, photorealistic"
- "A cat on a table" → "A fluffy orange tabby cat sitting on a polished wooden kitchen table, warm afternoon sunlight streaming through a window, bokeh background, photorealistic, 4k"`,
                  },
                  { role: "user", content: prompt },
                ],
                max_tokens: 150,
                temperature: 0.7,
              }),
            }
          );

          if (rephraseRes.ok) {
            const rephraseResult = await rephraseRes.json();
            const rephrased = rephraseResult.choices?.[0]?.message?.content?.trim();
            if (rephrased && rephrased.length > 10) {
              imagePrompt = rephrased;
              console.log(`[Image Gen] Rephrased: "${prompt}" → "${imagePrompt}"`);
            }
          }
        } catch (rephraseErr) {
          // If rephrase fails, just use the original prompt — no big deal
          console.warn("Prompt rephrase failed, using original:", rephraseErr);
        }

        // ── Step 2: Generate image with FLUX.1-schnell ─────────────────────
        const response = await fetch(
          "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
          {
            headers: {
              Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
              "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({
              inputs: imagePrompt,
              parameters: {
                num_inference_steps: 4,
                guidance_scale: 3.5,
                width: 1024,
                height: 1024,
              },
            }),
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
    "/rewrite-text",
    verifyAuth(),
    zValidator(
      "json",
      z.object({
        text: z.string(),
        instruction: z.string(),
      }),
    ),
    async (c) => {
      const { text, instruction } = c.req.valid("json");

      const systemPrompt = `You are a graphic design AI assistant specializing in text refinement.
The user has a text layer on their canvas and wants to modify it using this instruction: "${instruction}".
Modify the text accordingly. ONLY return the modified text string. Do NOT use markdown. Do NOT use emojis unless asked. Do NOT include any meta-commentary. Just output the refined text.`;

      try {
        const response = await fetch(
          "https://router.huggingface.co/novita/v3/openai/chat/completions",
          {
            headers: {
              Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
              "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({
              model: "meta-llama/llama-3.1-8b-instruct",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Original text: ${text}` },
              ],
              max_tokens: 300,
              temperature: 0.8,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HF API Error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        let rewrittenText = result.choices?.[0]?.message?.content?.trim();

        // Strip stray quotes
        rewrittenText = rewrittenText.replace(/^["'\u201c]+|["'\u201d]+$/g, '').trim();

        return c.json({ data: rewrittenText });
      } catch (error: any) {
        console.error("AI Rewrite Error:", error.message || error);
        return c.json(
          { error: error.message || "Failed to rewrite text." },
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

      const validFonts = "Arial, Arial Black, Verdana, Helvetica, Tahoma, Trebuchet MS, Times New Roman, Georgia, Garamond, Courier New, Brush Script MT, Palatino, Bookman, Comic Sans MS, Impact, Lucida Sans Unicode, Geneva, Lucida Console";

      const systemPrompt = `You are an expert graphic design assistant. You must respond ONLY with valid JSON.
The JSON must have a single key "elements" containing an array of objects representing text layers to be added to a design canvas.

Each object MUST have the following properties:
- content (string): The generated text phrase.
- fontSize (number): The font size in pixels (e.g. 64 for title, 24 for body). Max 120.
- fontFamily (string): Pick EXACTLY ONE font from this list: ${validFonts}.
- fill (string): The text color as a hex code. EXTREMELY IMPORTANT: ALWAYS use high-contrast, bold colors (like stark white #FFFFFF or pure black #000000, or a very bright pop of color) that are easily readable on a poster. Do NOT use dull or low-contrast colors.
- fontWeight (number): Font weight (e.g. 400 for normal, 700 for bold, 900 for extra bold).
- textAlign (string): Alignment ("left", "center", "right").

INSTRUCTIONS:
- If the user explicitly asks for multiple elements (like "title and subtitle" or bullet points), generate exactly those elements.
- For body text with bullet points, generate each bullet point as a separate element in the array with fontSize 24.
- If the request is generic, just generate 1 element perfectly styled for the request.
- Ensure colors look good together. Do NOT include markdown blocks (\`\`\`json). Just the raw JSON object.`;

      try {
        const response = await fetch(
          "https://router.huggingface.co/novita/v3/openai/chat/completions",
          {
            headers: {
              Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
              "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({
              model: "meta-llama/llama-3.1-8b-instruct",
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Text Type Requested: ${type === 'custom' ? 'Follow User Instructions' : type}.\nUser Prompt: ${prompt}` },
              ],
              max_tokens: 800,
              temperature: 0.8,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HF API Error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        let textContent = result.choices?.[0]?.message?.content?.trim();

        // Strip markdown if Llama ignored the system prompt
        if (textContent?.startsWith("```")) {
          textContent = textContent.replace(/^```json/g, "").replace(/^```/g, "").replace(/```$/g, "").trim();
        }

        const parsed = JSON.parse(textContent || '{"elements":[]}');
        let elements = parsed.elements || [];

        // Post-process bullets so they stay together in one textbox
        if (/bullet|point|list/i.test(prompt) && elements.length > 1) {
          const merged = elements.map((e: any) => "• " + e.content).join("\n");
          elements = [{
            content: merged,
            fontSize: 24,
            fontFamily: elements[0]?.fontFamily || "Arial",
            fill: elements[0]?.fill || "#000000",
            fontWeight: 400,
            textAlign: "left"
          }];
        }

        return c.json({ data: elements });
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
