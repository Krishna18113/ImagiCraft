import { fabric } from "fabric";
import { JSON_KEYS } from "@/features/editor/types";
import { downloadFile } from "@/features/editor/utils";

interface BuildExportActionsProps {
  canvas: fabric.Canvas;
  pages: string[];
  currentPageIndex: number;
  autoZoom: () => void;
  getWorkspace: () => fabric.Object | undefined;
}

// Helper: renders a page JSON string into a dataURL using a temporary StaticCanvas
const renderPageToDataUrl = (
  pageJson: string,
  format: "png" | "jpeg"
): Promise<string> => {
  return new Promise((resolve) => {
    const pageData = JSON.parse(pageJson);
    const clipObj = pageData.objects?.find((o: any) => o.name === "clip");
    const w = clipObj?.width || 1920;
    const h = clipObj?.height || 1080;

    const tempCanvas = new fabric.StaticCanvas(null, { width: w, height: h });
    tempCanvas.loadFromJSON(pageData, () => {
      tempCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      const dataUrl = tempCanvas.toDataURL({
        format,
        quality: 1,
        width: w,
        height: h,
        left: clipObj?.left || 0,
        top: clipObj?.top || 0,
      });
      tempCanvas.dispose();
      resolve(dataUrl);
    });
  });
};

export const buildExportActions = ({
  canvas,
  pages,
  currentPageIndex,
  autoZoom,
  getWorkspace,
}: BuildExportActionsProps) => {
  const generateSaveOptions = () => {
    const { width, height, left, top } = getWorkspace() as fabric.Rect;
    return {
      name: "Image",
      format: "png",
      quality: 1,
      width,
      height,
      left,
      top,
    };
  };

  // Get all pages with current canvas state synced in
  const getAllPagesSync = (): string[] => {
    const currentState = JSON.stringify(canvas.toJSON(JSON_KEYS));
    const allPages = [...pages];
    if (allPages.length === 0) {
      allPages.push(currentState);
    } else {
      allPages[currentPageIndex] = currentState;
    }
    return allPages;
  };

  return {
    savePng: async () => {
      const allPages = getAllPagesSync();

      if (allPages.length <= 1) {
        const options = generateSaveOptions();
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        const dataUrl = canvas.toDataURL(options);
        downloadFile(dataUrl, "png");
        autoZoom();
        return;
      }

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      for (let i = 0; i < allPages.length; i++) {
        const dataUrl = await renderPageToDataUrl(allPages[i], "png");
        const base64 = dataUrl.split(",")[1];
        zip.file(`slide-${i + 1}.png`, base64, { base64: true });
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      downloadFile(url, "zip");
      URL.revokeObjectURL(url);
      autoZoom();
    },

    saveJpg: async () => {
      const allPages = getAllPagesSync();

      if (allPages.length <= 1) {
        const options = generateSaveOptions();
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        const dataUrl = canvas.toDataURL(options);
        downloadFile(dataUrl, "jpg");
        autoZoom();
        return;
      }

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      for (let i = 0; i < allPages.length; i++) {
        const dataUrl = await renderPageToDataUrl(allPages[i], "jpeg");
        const base64 = dataUrl.split(",")[1];
        zip.file(`slide-${i + 1}.jpg`, base64, { base64: true });
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      downloadFile(url, "zip");
      URL.revokeObjectURL(url);
      autoZoom();
    },

    saveSvg: () => {
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      const svgContent = canvas.toSVG();
      const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      downloadFile(url, "svg");
      URL.revokeObjectURL(url);
      autoZoom();
    },

    savePdf: async () => {
      const allPages = getAllPagesSync();
      const { jsPDF } = await import("jspdf");

      const workspace = getWorkspace() as fabric.Rect;
      const w = workspace?.width || 1920;
      const h = workspace?.height || 1080;
      const orientation = w > h ? "landscape" : "portrait";

      const pdf = new jsPDF({
        orientation,
        unit: "px",
        format: [w, h],
      });

      for (let i = 0; i < allPages.length; i++) {
        if (i > 0) pdf.addPage([w, h], orientation);
        const dataUrl = await renderPageToDataUrl(allPages[i], "jpeg");
        pdf.addImage(dataUrl, "JPEG", 0, 0, w, h);
      }

      pdf.save("presentation.pdf");
    },

    saveJson: async () => {
      const allPages = getAllPagesSync();

      const payload = {
        isMultiPage: true,
        pages: allPages,
      };

      const fileString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(payload, null, "\t"),
      )}`;
      downloadFile(fileString, "json");
    },

    loadJson: (json: string) => {
      const data = JSON.parse(json);
      canvas.loadFromJSON(data, () => {
        autoZoom();
      });
    },
  };
};
