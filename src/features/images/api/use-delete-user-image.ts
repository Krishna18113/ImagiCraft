import { toast } from "sonner";
import { InferRequestType, InferResponseType } from "hono";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "@/lib/hono";

type ResponseType = InferResponseType<typeof client.api["user-images"][":id"]["$delete"], 200>;
type RequestType = InferRequestType<typeof client.api["user-images"][":id"]["$delete"]>["param"];

export const useDeleteUserImage = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<
    ResponseType,
    Error,
    RequestType
  >({
    mutationFn: async (param) => {
      const response = await client.api["user-images"][":id"].$delete({ 
        param,
      });

      if (!response.ok) {
        throw new Error("Failed to delete image");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-images"] });
      toast.success("Image deleted");
    },
    onError: () => {
      toast.error("Failed to delete image");
    }
  });

  return mutation;
};
