"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, ImageIcon, Loader, X } from "lucide-react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";

import { useGetUserImages } from "@/features/images/api/use-get-user-images";

type UploadedImage = { id: string; url: string; name: string; createdAt: string };

// ─── Lightbox ────────────────────────────────────────────────────────────────
function Lightbox({
  images,
  index,
  onClose,
}: {
  images: UploadedImage[];
  index: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(index);

  const prev = () => setCurrent((c) => (c - 1 + images.length) % images.length);
  const next = () => setCurrent((c) => (c + 1) % images.length);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const image = images[current];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Card — stop propagation so clicking card doesn't close */}
      <div
        className="relative flex flex-col items-center max-w-4xl w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/80 hover:text-white transition"
        >
          <X className="size-7" />
        </button>

        {/* Image */}
        <div className="relative w-full max-h-[75vh] rounded-xl overflow-hidden shadow-2xl bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={image.name}
            className="w-full max-h-[75vh] object-contain"
          />
        </div>

        {/* Caption */}
        <p className="mt-3 text-white/90 text-sm font-medium truncate max-w-md">{image.name}</p>
        <p className="text-white/50 text-xs">
          {formatDistanceToNow(new Date(image.createdAt), { addSuffix: true })}
        </p>

        {/* Navigation — only show if more than 1 image */}
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white rounded-full p-2 transition"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white rounded-full p-2 transition"
            >
              <ChevronRight className="size-6" />
            </button>

            {/* Dots */}
            <div className="flex gap-1.5 mt-3">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`size-2 rounded-full transition ${i === current ? "bg-white" : "bg-white/30 hover:bg-white/60"
                    }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export const UploadsSection = () => {
  const { data, status } = useGetUserImages();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (status === "pending") {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-2xl text-gray-800">Your uploads</h3>
        <div className="flex items-center justify-center h-32">
          <Loader className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-2xl text-gray-800">Your uploads</h3>
        <div className="flex flex-col gap-y-4 items-center justify-center h-32">
          <AlertTriangle className="size-6 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">Failed to load uploads</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-2xl text-gray-800">Your uploads</h3>
        <div className="flex flex-col gap-y-4 items-center justify-center h-32">
          <ImageIcon className="size-6 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">No uploads yet</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {lightboxIndex !== null && (
        <Lightbox
          images={data}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      <div className="space-y-4">
        <h3 className="font-semibold text-2xl text-gray-800">Your uploads</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {data.map((image, i) => (
            <button
              key={image.id}
              onClick={() => setLightboxIndex(i)}
              className="group relative flex flex-col gap-y-2 cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl"
            >
              <div className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50 shadow-sm group-hover:shadow-md transition-shadow duration-200">
                <Image
                  src={image.url}
                  alt={image.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  unoptimized
                />
              </div>
              <div className="px-0.5">
                <p className="text-sm font-medium text-gray-700 truncate">{image.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(image.createdAt), { addSuffix: true })}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
