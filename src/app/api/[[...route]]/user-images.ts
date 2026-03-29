import { Hono } from "hono";
import { verifyAuth } from "@hono/auth-js";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { userImages } from "@/db/schema";

const app = new Hono()
    // GET /api/user-images – list current user's uploads
    .get("/", verifyAuth(), async (c) => {
        const auth = c.get("authUser");
        const userId = auth.session?.user?.id;
        if (!userId) return c.json({ error: "Unauthorized" }, 401);

        const images = await db
            .select()
            .from(userImages)
            .where(eq(userImages.userId, userId))
            .orderBy(desc(userImages.createdAt));

        return c.json({ data: images });
    })
    // POST /api/user-images – save a newly uploaded image
    .post(
        "/",
        verifyAuth(),
        zValidator("json", z.object({ url: z.string().url(), name: z.string() })),
        async (c) => {
            const auth = c.get("authUser");
            const userId = auth.session?.user?.id;
            if (!userId) return c.json({ error: "Unauthorized" }, 401);

            const { url, name } = c.req.valid("json");

            const [image] = await db
                .insert(userImages)
                .values({ userId, url, name, createdAt: new Date() })
                .returning();

            return c.json({ data: image });
        }
    )
    .delete(
        "/:id",
        verifyAuth(),
        zValidator("param", z.object({ id: z.string() })),
        async (c) => {
            const auth = c.get("authUser");
            const userId = auth.session?.user?.id;
            if (!userId) return c.json({ error: "Unauthorized" }, 401);

            const { id } = c.req.valid("param");

            const [image] = await db
                .delete(userImages)
                .where(
                    and(
                        eq(userImages.id, id),
                        eq(userImages.userId, userId)
                    )
                )
                .returning();

            if (!image) {
                return c.json({ error: "Not found" }, 404);
            }

            return c.json({ data: image });
        }
    );

export default app;
