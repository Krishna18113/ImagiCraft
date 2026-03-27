"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Presentation,
    FileText,
    Monitor,
    Globe,
    Mail,
    Image as ImageIcon,
    Plus,
    Upload,
    CloudUpload,
    X,
    Loader2,
} from "lucide-react";

import { useCreateProject } from "@/features/projects/api/use-create-project";
import { useSaveUserImage } from "@/features/images/api/use-save-user-image";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { usePrompt } from "@/hooks/use-prompt";

const categories = [
    { id: "presentation", label: "Presentation", icon: Presentation, color: "text-orange-500", bgColor: "bg-orange-100", width: 1920, height: 1080, projectType: "PRESENTATION" as const },
    { id: "doc", label: "Doc", icon: FileText, color: "text-teal-500", bgColor: "bg-teal-100", width: 800, height: 1131, projectType: "POSTER" as const },
    { id: "whiteboard", label: "Whiteboard", icon: Monitor, color: "text-green-500", bgColor: "bg-green-100", width: 2000, height: 2000, projectType: "IMAGE" as const },
    { id: "website", label: "Website", icon: Globe, color: "text-blue-500", bgColor: "bg-blue-100", width: 1440, height: 1024, projectType: "IMAGE" as const },
    { id: "email", label: "Email", icon: Mail, color: "text-indigo-500", bgColor: "bg-indigo-100", width: 600, height: 1200, projectType: "POSTER" as const },
    { id: "photo", label: "Photo editor", icon: ImageIcon, color: "text-slate-500", bgColor: "bg-slate-100", width: 1080, height: 1080, projectType: "IMAGE" as const },
    { id: "logo", label: "Logo Design", icon: Plus, color: "text-gray-500", bgColor: "bg-gray-100", width: 500, height: 500, projectType: "LOGO" as const },
];

export const CategoriesSection = () => {
    const router = useRouter();
    const mutation = useCreateProject();
    const saveImage = useSaveUserImage();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loadingCategory, setLoadingCategory] = useState<string | null>(null);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadedCount, setUploadedCount] = useState(0);
    const [dragging, setDragging] = useState(false);

    const [PromptDialog, prompt] = usePrompt("Project Name", "What would you like to call this project?");

    const onClick = async (category: typeof categories[0]) => {
        const name = await prompt();
        if (!name) return;

        setLoadingCategory(category.id);
        mutation.mutate(
            {
                name: name,
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

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploading(true);
        try {
            for (const file of Array.from(files)) {
                if (!file.type.startsWith("image/")) continue;
                const { url, name } = await uploadToCloudinary(file);
                saveImage.mutate({ url, name });
                setUploadedCount((c) => c + 1);
            }
        } catch (e) {
            console.error("Upload failed:", e);
        } finally {
            setUploading(false);
        }
    };

    return (
        <>
            <PromptDialog />
            <div className="w-full overflow-x-auto pb-4 pt-2">
                <div className="flex items-center gap-x-6 w-max mx-auto px-4">
                    {categories.map((category) => (
                        <button
                            key={category.id}
                            onClick={() => onClick(category)}
                            disabled={mutation.isPending}
                            className="flex flex-col items-center gap-y-3 group"
                        >
                            <div className={`size-16 rounded-full flex items-center justify-center transition hover:scale-105 shadow-sm ${category.bgColor}`}>
                                <category.icon className={`size-8 ${category.color}`} />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground group-hover:text-primary transition">
                                {category.label}
                            </span>
                        </button>
                    ))}

                    {/* Upload — opens modal */}
                    <button
                        onClick={() => { setUploadedCount(0); setUploadOpen(true); }}
                        className="flex flex-col items-center gap-y-3 group"
                    >
                        <div className="size-16 rounded-full flex items-center justify-center transition hover:scale-105 shadow-sm bg-zinc-100">
                            <Upload className="size-8 text-zinc-500" />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground group-hover:text-primary transition">
                            Upload
                        </span>
                    </button>
                </div>
            </div>

            {/* Upload Modal */}
            {uploadOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) setUploadOpen(false); }}
                >
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 p-6 relative">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-semibold text-gray-800">Upload</h2>
                            <button
                                onClick={() => setUploadOpen(false)}
                                className="text-gray-400 hover:text-gray-600 transition rounded-full p-1 hover:bg-gray-100"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => handleFiles(e.target.files)}
                        />

                        {/* Drop zone */}
                        <div
                            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragging(false);
                                handleFiles(e.dataTransfer.files);
                            }}
                            onClick={() => fileInputRef.current?.click()}
                            className={`cursor-pointer border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-4 py-14 transition-colors ${dragging ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                                }`}
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="size-12 text-blue-400 animate-spin" />
                                    <p className="text-sm text-muted-foreground">Uploading…</p>
                                </>
                            ) : (
                                <>
                                    <CloudUpload className="size-16 text-blue-400" strokeWidth={1.5} />
                                    <p className="text-sm text-muted-foreground">Drop your images here or</p>
                                    <span className="text-sm font-medium px-5 py-2 rounded-lg bg-white border border-gray-200 shadow-sm hover:bg-gray-50 text-gray-700 transition">
                                        Upload files
                                    </span>
                                </>
                            )}

                            {uploadedCount > 0 && !uploading && (
                                <p className="text-xs text-green-600 font-medium">
                                    ✓ {uploadedCount} file{uploadedCount > 1 ? "s" : ""} uploaded — accessible in the Images panel
                                </p>
                            )}
                        </div>

                        <p className="text-xs text-center text-muted-foreground mt-3">
                            Supports PNG, JPG, JPEG, WEBP images
                        </p>
                    </div>
                </div>
            )}
        </>
    );
};
