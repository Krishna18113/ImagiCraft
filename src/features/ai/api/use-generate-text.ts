import { useMutation } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";

import { client } from "@/lib/hono";

type ResponseType = InferResponseType<typeof client.api.ai["generate-text"]["$post"]>;
type RequestType = InferRequestType<typeof client.api.ai["generate-text"]["$post"]>["json"];

export const useGenerateText = () => {
  const mutation = useMutation<
    ResponseType,
    Error,
    RequestType
  >({
    mutationFn: async (json) => {
      const response = await client.api.ai["generate-text"].$post({ json });
      return await response.json();
    },
  });

  return mutation;
};
