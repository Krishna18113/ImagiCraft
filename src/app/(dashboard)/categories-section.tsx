"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Presentation,
    Video,
    Store,
    FileText,
    Monitor,
    Globe,
    Mail,
    Image as ImageIcon,
    Plus,
    Upload
} from "lucide-react";

import { useCreateProject } from "@/features/projects/api/use-create-project";

const categories = [
    { id: "presentation", label: "Presentation", icon: Presentation, color: "text-orange-500", bgColor: "bg-orange-100", width: 1920, height: 1080, projectType: "PRESENTATION" as const },
    { id: "video", label: "Video", icon: Video, color: "text-purple-500", bgColor: "bg-purple-100", width: 1920, height: 1080, projectType: "PRESENTATION" as const },
    { id: "print", label: "Print Shop", icon: Store, color: "text-fuchsia-500", bgColor: "bg-fuchsia-100", width: 2480, height: 3508, projectType: "POSTER" as const },
    { id: "doc", label: "Doc", icon: FileText, color: "text-teal-500", bgColor: "bg-teal-100", width: 800, height: 1131, projectType: "POSTER" as const },
    { id: "whiteboard", label: "Whiteboard", icon: Monitor, color: "text-green-500", bgColor: "bg-green-100", width: 2000, height: 2000, projectType: "IMAGE" as const },
    { id: "website", label: "Website", icon: Globe, color: "text-blue-500", bgColor: "bg-blue-100", width: 1440, height: 1024, projectType: "IMAGE" as const },
    { id: "email", label: "Email", icon: Mail, color: "text-indigo-500", bgColor: "bg-indigo-100", width: 600, height: 1200, projectType: "POSTER" as const },
    { id: "photo", label: "Photo editor", icon: ImageIcon, color: "text-slate-500", bgColor: "bg-slate-100", width: 1080, height: 1080, projectType: "IMAGE" as const },
    { id: "logo", label: "Logo Design", icon: Plus, color: "text-gray-500", bgColor: "bg-gray-100", width: 500, height: 500, projectType: "LOGO" as const },
    { id: "upload", label: "Upload", icon: Upload, color: "text-zinc-500", bgColor: "bg-zinc-100", width: 1200, height: 1200, projectType: "IMAGE" as const }
];

export const CategoriesSection = () => {
    const router = useRouter();
    const mutation = useCreateProject();
    const [loadingCategory, setLoadingCategory] = useState<string | null>(null);

    const onClick = (category: typeof categories[0]) => {
        setLoadingCategory(category.id);
        mutation.mutate(
            {
                name: `${category.label} project`,
                json: "",
                width: category.width,
                height: category.height,
                projectType: category.projectType,
            },
            {
                onSuccess: ({ data }) => {
                    router.push(`/editor/${data.id}`);
                },
                onSettled: () => {
                    setLoadingCategory(null);
                }
            }
        );
    };

    return (
        <div className="w-full overflow-x-auto pb-4 pt-2">
            <div className="flex items-center gap-x-6 w-max mx-auto px-4">
                {categories.map((category) => (
                    <button
                        key={category.id}
                        onClick={() => onClick(category)}
                        disabled={mutation.isPending}
                        className="flex flex-col items-center gap-y-3 group"
                    >
                        <div
                            className={`size-16 rounded-full flex items-center justify-center transition hover:scale-105 shadow-sm ${category.bgColor}`}
                        >
                            <category.icon className={`size-8 ${category.color}`} />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground group-hover:text-primary transition">
                            {category.label}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};
