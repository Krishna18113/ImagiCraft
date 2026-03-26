"use client";

import Link from "next/link";
import { Loader, TriangleAlert } from "lucide-react";

import { useGetProject } from "@/features/projects/api/use-get-project";

import { Editor } from "@/features/editor/components/editor";
import { Button } from "@/components/ui/button";

interface EditorProjectIdPageProps {
  params: {
    projectId: string;
  };
};

const EditorProjectIdPage = ({
  params,
}: EditorProjectIdPageProps) => {
  const { 
    data, 
    isLoading, 
    isError
  } = useGetProject(params.projectId);

  if (isLoading || !data) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        <div className="flex flex-col items-center gap-y-4">
          <div className="relative">
            <div className="size-16 rounded-2xl bg-gradient-to-r from-[#00c4cc] to-[#7d2ae8] flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-2xl">I</span>
            </div>
            <div className="absolute -inset-2 rounded-2xl border-2 border-indigo-200 animate-ping opacity-30" />
          </div>
          <div className="flex flex-col items-center gap-y-2">
            <h2 className="text-lg font-semibold text-gray-700">Loading your design...</h2>
            <p className="text-sm text-muted-foreground">Setting up the canvas</p>
          </div>
          <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-gradient-to-r from-[#00c4cc] to-[#7d2ae8] rounded-full animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-full flex flex-col gap-y-5 items-center justify-center">
        <TriangleAlert className="size-6 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">
          Failed to fetch project
        </p>
        <Button asChild variant="secondary">
          <Link href="/">
            Back to Home
          </Link>
        </Button>
      </div>
    );
  }

  return <Editor initialData={data} />
};
 
export default EditorProjectIdPage;
