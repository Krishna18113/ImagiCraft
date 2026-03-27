import { useQuery } from "@tanstack/react-query";

export const useGetUserImages = () => {
    return useQuery({
        queryKey: ["user-images"],
        queryFn: async () => {
            const response = await fetch("/api/user-images");
            if (!response.ok) throw new Error("Failed to fetch user images");
            const { data } = await response.json();
            return data as { id: string; url: string; name: string; createdAt: string }[];
        },
    });
};
