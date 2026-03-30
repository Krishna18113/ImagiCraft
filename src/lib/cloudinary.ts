type CloudinaryUploadResult = {
    name: string;
    url: string;
};

const uploadFile = async ({
    endpoint,
    file,
    uploadPreset,
    extraFields = {},
}: {
    endpoint: string;
    file: File;
    uploadPreset: string;
    extraFields?: Record<string, string>;
}): Promise<CloudinaryUploadResult> => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    Object.entries(extraFields).forEach(([key, value]) => {
        formData.append(key, value);
    });

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/${endpoint}`,
        { method: "POST", body: formData }
    );

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || "Cloudinary upload failed");
    }

    const data = await response.json();
    return { url: data.secure_url as string, name: file.name };
};

/**
 * Uploads a file directly to Cloudinary using an unsigned upload preset.
 */
export async function uploadToCloudinary(file: File): Promise<CloudinaryUploadResult> {
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

    return uploadFile({
        endpoint: "auto/upload",
        file,
        uploadPreset,
    });
}

/**
 * Uploads a PowerPoint file to Cloudinary raw storage.
 * Use an upload preset with Aspose conversion enabled for exact slide rendering.
 */
export async function uploadOfficeToCloudinary(file: File): Promise<CloudinaryUploadResult> {
    const uploadPreset =
        process.env.NEXT_PUBLIC_CLOUDINARY_ASPOSE_UPLOAD_PRESET ||
        process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

    try {
        return await uploadFile({
            endpoint: "raw/upload",
            file,
            uploadPreset,
        });
    } catch (rawError) {
        try {
            return await uploadFile({
                endpoint: "auto/upload",
                file,
                uploadPreset,
            });
        } catch (autoError) {
            const rawMessage =
                rawError instanceof Error ? rawError.message : "raw/upload failed";
            const autoMessage =
                autoError instanceof Error ? autoError.message : "auto/upload failed";

            throw new Error(
                `Cloudinary Aspose upload failed. raw/upload: ${rawMessage}. auto/upload: ${autoMessage}. Check that the preset is unsigned and has Aspose conversion enabled.`
            );
        }
    }
}
