import { useMutation } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";

import { client } from "@/lib/hono";

type ResponseType = InferResponseType<typeof client.api.ai["rewrite-text"]["$post"]>;
type RequestType = InferRequestType<typeof client.api.ai["rewrite-text"]["$post"]>["json"];

export const useRewriteText = () => {
  const mutation = useMutation<
    ResponseType,
    Error,
    RequestType
  >({
    mutationFn: async (json) => {
      const response = await client.api.ai["rewrite-text"].$post({ json });
      return await response.json();
    },
  });

  return mutation;
};
