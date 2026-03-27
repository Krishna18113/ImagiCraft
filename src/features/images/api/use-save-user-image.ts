import { useMutation, useQueryClient } from "@tanstack/react-query";

type SaveImageInput = { url: string; name: string };

export const useSaveUserImage = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (values: SaveImageInput) => {
            const response = await fetch("/api/user-images", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });
            if (!response.ok) throw new Error("Failed to save image");
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["user-images"] });
        },
    });
};
