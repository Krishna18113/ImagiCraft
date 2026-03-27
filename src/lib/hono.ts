import { hc } from "hono/client";

import { AppType } from "@/app/api/[[...route]]/route";

export const client = hc<AppType>(
    typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL!
);
