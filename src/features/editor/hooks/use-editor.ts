import { fabric } from "fabric";
import { useCallback, useState, useMemo, useRef } from "react";

import {
  Editor,
  FILL_COLOR,
  STROKE_WIDTH,
  STROKE_COLOR,
  CIRCLE_OPTIONS,
  DIAMOND_OPTIONS,
  TRIANGLE_OPTIONS,
  BuildEditorProps,
  RECTANGLE_OPTIONS,
  EditorHookProps,
  STROKE_DASH_ARRAY,
  TEXT_OPTIONS,
  FONT_FAMILY,
  FONT_WEIGHT,
  FONT_SIZE,
  JSON_KEYS,
} from "@/features/editor/types";
import { useHistory } from "@/features/editor/hooks/use-history";
import {
  createFilter,
  downloadFile,
  isTextType,
  transformText
} from "@/features/editor/utils";
import { useHotkeys } from "@/features/editor/hooks/use-hotkeys";
import { useClipboard } from "@/features/editor/hooks//use-clipboard";
import { useAutoResize } from "@/features/editor/hooks/use-auto-resize";
import { useCanvasEvents } from "@/features/editor/hooks/use-canvas-events";
import { useWindowEvents } from "@/features/editor/hooks/use-window-events";
import { useLoadState } from "@/features/editor/hooks/use-load-state";

const buildEditor = ({
  save,
  undo,
  redo,
  canRedo,
  canUndo,
  autoZoom,
  copy,
  paste,
  canvas,
  fillColor,
  fontFamily,
  setFontFamily,
  setFillColor,
  strokeColor,
  setStrokeColor,
  strokeWidth,
  setStrokeWidth,
  selectedObjects,
  strokeDashArray,
  setStrokeDashArray,
  pages,
  currentPageIndex,
  addPage,
  setPageIndex,
  deletePage,
}: BuildEditorProps): Editor => {
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

  const savePng = async () => {
    const allPages = getAllPagesSync();

    if (allPages.length <= 1) {
      // Single page: download directly
      const options = generateSaveOptions();
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      const dataUrl = canvas.toDataURL(options);
      downloadFile(dataUrl, "png");
      autoZoom();
      return;
    }

    // Multi-page: ZIP all slides
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
  };

  const saveSvg = () => {
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    const svgContent = canvas.toSVG();
    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    downloadFile(url, "svg");
    URL.revokeObjectURL(url);
    autoZoom();
  };

  const saveJpg = async () => {
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
  };

  const savePdf = async () => {
    const allPages = getAllPagesSync();
    const { jsPDF } = await import("jspdf");

    // Determine dimensions from workspace
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
  };

  const saveJson = async () => {
    const allPages = getAllPagesSync();

    const payload = {
      isMultiPage: true,
      pages: allPages,
    };

    const fileString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(payload, null, "\t"),
    )}`;
    downloadFile(fileString, "json");
  };

  const loadJson = (json: string) => {
    const data = JSON.parse(json);

    canvas.loadFromJSON(data, () => {
      autoZoom();
    });
  };

  const getWorkspace = () => {
    return canvas
      .getObjects()
      .find((object) => object.name === "clip");
  };

  const center = (object: fabric.Object) => {
    const workspace = getWorkspace();
    const center = workspace?.getCenterPoint();

    if (!center) return;

    // @ts-ignore
    canvas._centerObject(object, center);
  };

  const addToCanvas = (object: fabric.Object) => {
    center(object);
    canvas.add(object);
    canvas.setActiveObject(object);
  };

  return {
    savePng,
    saveJpg,
    saveSvg,
    savePdf,
    saveJson,
    loadJson,
    canUndo,
    canRedo,
    autoZoom,
    getZoomLevel: () => Math.round(canvas.getZoom() * 100),
    getWorkspace,
    zoomIn: () => {
      let zoomRatio = canvas.getZoom();
      zoomRatio += 0.05;
      const center = canvas.getCenter();
      canvas.zoomToPoint(
        new fabric.Point(center.left, center.top),
        zoomRatio > 1 ? 1 : zoomRatio
      );
    },
    zoomOut: () => {
      let zoomRatio = canvas.getZoom();
      zoomRatio -= 0.05;
      const center = canvas.getCenter();
      canvas.zoomToPoint(
        new fabric.Point(center.left, center.top),
        zoomRatio < 0.2 ? 0.2 : zoomRatio,
      );
    },
    changeSize: (value: { width: number; height: number }) => {
      const workspace = getWorkspace();

      workspace?.set(value);
      autoZoom();
      save();
    },
    changeBackground: (value: string) => {
      const workspace = getWorkspace();
      workspace?.set({ fill: value });
      canvas.renderAll();
      save();
    },
    enableDrawingMode: () => {
      canvas.discardActiveObject();
      canvas.renderAll();
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.width = strokeWidth;
      canvas.freeDrawingBrush.color = strokeColor;
    },
    disableDrawingMode: () => {
      canvas.isDrawingMode = false;
    },
    onUndo: () => undo(),
    onRedo: () => redo(),
    onCopy: () => copy(),
    onPaste: () => paste(),
    changeImageFilter: (value: string) => {
      const objects = canvas.getActiveObjects();
      objects.forEach((object) => {
        if (object.type === "image") {
          const imageObject = object as fabric.Image;

          const effect = createFilter(value);

          imageObject.filters = effect ? [effect] : [];
          imageObject.applyFilters();
          canvas.renderAll();
        }
      });
    },
    addImage: (value: string) => {
      fabric.Image.fromURL(
        value,
        (image) => {
          const workspace = getWorkspace();

          image.scaleToWidth(workspace?.width || 0);
          image.scaleToHeight(workspace?.height || 0);

          addToCanvas(image);
        },
        {
          crossOrigin: "anonymous",
        },
      );
    },
    delete: () => {
      canvas.getActiveObjects().forEach((object) => canvas.remove(object));
      canvas.discardActiveObject();
      canvas.renderAll();
    },
    addText: (value, options) => {
      const object = new fabric.Textbox(value, {
        ...TEXT_OPTIONS,
        fill: fillColor,
        ...options,
      });

      addToCanvas(object);
    },
    getActiveOpacity: () => {
      const selectedObject = selectedObjects[0];

      if (!selectedObject) {
        return 1;
      }

      const value = selectedObject.get("opacity") || 1;

      return value;
    },
    changeFontSize: (value: number) => {
      canvas.getActiveObjects().forEach((object) => {
        if (isTextType(object.type)) {
          // @ts-ignore
          // Faulty TS library, fontSize exists.
          object.set({ fontSize: value });
        }
      });
      canvas.renderAll();
    },
    getActiveFontSize: () => {
      const selectedObject = selectedObjects[0];

      if (!selectedObject) {
        return FONT_SIZE;
      }

      // @ts-ignore
      // Faulty TS library, fontSize exists.
      const value = selectedObject.get("fontSize") || FONT_SIZE;

      return value;
    },
    changeTextAlign: (value: string) => {
      canvas.getActiveObjects().forEach((object) => {
        if (isTextType(object.type)) {
          // @ts-ignore
          // Faulty TS library, textAlign exists.
          object.set({ textAlign: value });
        }
      });
      canvas.renderAll();
    },
    getActiveTextAlign: () => {
      const selectedObject = selectedObjects[0];

      if (!selectedObject) {
        return "left";
      }

      // @ts-ignore
      // Faulty TS library, textAlign exists.
      const value = selectedObject.get("textAlign") || "left";

      return value;
    },
    changeFontUnderline: (value: boolean) => {
      canvas.getActiveObjects().forEach((object) => {
        if (isTextType(object.type)) {
          // @ts-ignore
          // Faulty TS library, underline exists.
          object.set({ underline: value });
        }
      });
      canvas.renderAll();
    },
    getActiveFontUnderline: () => {
      const selectedObject = selectedObjects[0];

      if (!selectedObject) {
        return false;
      }

      // @ts-ignore
      // Faulty TS library, underline exists.
      const value = selectedObject.get("underline") || false;

      return value;
    },
    changeFontLinethrough: (value: boolean) => {
      canvas.getActiveObjects().forEach((object) => {
        if (isTextType(object.type)) {
          // @ts-ignore
          // Faulty TS library, linethrough exists.
          object.set({ linethrough: value });
        }
      });
      canvas.renderAll();
    },
    getActiveFontLinethrough: () => {
      const selectedObject = selectedObjects[0];

      if (!selectedObject) {
        return false;
      }

      // @ts-ignore
      // Faulty TS library, linethrough exists.
      const value = selectedObject.get("linethrough") || false;

      return value;
    },
    changeFontStyle: (value: string) => {
      canvas.getActiveObjects().forEach((object) => {
        if (isTextType(object.type)) {
          // @ts-ignore
          // Faulty TS library, fontStyle exists.
          object.set({ fontStyle: value });
        }
      });
      canvas.renderAll();
    },
    getActiveFontStyle: () => {
      const selectedObject = selectedObjects[0];

      if (!selectedObject) {
        return "normal";
      }

      // @ts-ignore
      // Faulty TS library, fontStyle exists.
      const value = selectedObject.get("fontStyle") || "normal";

      return value;
    },
    changeFontWeight: (value: number) => {
      canvas.getActiveObjects().forEach((object) => {
        if (isTextType(object.type)) {
          // @ts-ignore
          // Faulty TS library, fontWeight exists.
          object.set({ fontWeight: value });
        }
      });
      canvas.renderAll();
    },
    changeOpacity: (value: number) => {
      canvas.getActiveObjects().forEach((object) => {
        object.set({ opacity: value });
      });
      canvas.renderAll();
    },
    bringForward: () => {
      canvas.getActiveObjects().forEach((object) => {
        canvas.bringForward(object);
      });

      canvas.renderAll();

      const workspace = getWorkspace();
      workspace?.sendToBack();
    },
    sendBackwards: () => {
      canvas.getActiveObjects().forEach((object) => {
        canvas.sendBackwards(object);
      });

      canvas.renderAll();
      const workspace = getWorkspace();
      workspace?.sendToBack();
    },
    changeFontFamily: (value: string) => {
      setFontFamily(value);
      canvas.getActiveObjects().forEach((object) => {
        if (isTextType(object.type)) {
          // @ts-ignore
          // Faulty TS library, fontFamily exists.
          object.set({ fontFamily: value });
        }
      });
      canvas.renderAll();
    },
    changeFillColor: (value: string) => {
      setFillColor(value);
      canvas.getActiveObjects().forEach((object) => {
        object.set({ fill: value });
      });
      canvas.renderAll();
    },
    changeStrokeColor: (value: string) => {
      setStrokeColor(value);
      canvas.getActiveObjects().forEach((object) => {
        // Text types don't have stroke
        if (isTextType(object.type)) {
          object.set({ fill: value });
          return;
        }

        object.set({ stroke: value });
      });
      canvas.freeDrawingBrush.color = value;
      canvas.renderAll();
    },
    changeStrokeWidth: (value: number) => {
      setStrokeWidth(value);
      canvas.getActiveObjects().forEach((object) => {
        object.set({ strokeWidth: value });
      });
      canvas.freeDrawingBrush.width = value;
      canvas.renderAll();
    },
    changeStrokeDashArray: (value: number[]) => {
      setStrokeDashArray(value);
      canvas.getActiveObjects().forEach((object) => {
        object.set({ strokeDashArray: value });
      });
      canvas.renderAll();
    },
    addCircle: () => {
      const object = new fabric.Circle({
        ...CIRCLE_OPTIONS,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        strokeDashArray: strokeDashArray,
      });

      addToCanvas(object);
    },
    addSoftRectangle: () => {
      const object = new fabric.Rect({
        ...RECTANGLE_OPTIONS,
        rx: 50,
        ry: 50,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        strokeDashArray: strokeDashArray,
      });

      addToCanvas(object);
    },
    addRectangle: () => {
      const object = new fabric.Rect({
        ...RECTANGLE_OPTIONS,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        strokeDashArray: strokeDashArray,
      });

      addToCanvas(object);
    },
    addTriangle: () => {
      const object = new fabric.Triangle({
        ...TRIANGLE_OPTIONS,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        strokeDashArray: strokeDashArray,
      });

      addToCanvas(object);
    },
    addInverseTriangle: () => {
      const HEIGHT = TRIANGLE_OPTIONS.height;
      const WIDTH = TRIANGLE_OPTIONS.width;

      const object = new fabric.Polygon(
        [
          { x: 0, y: 0 },
          { x: WIDTH, y: 0 },
          { x: WIDTH / 2, y: HEIGHT },
        ],
        {
          ...TRIANGLE_OPTIONS,
          fill: fillColor,
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          strokeDashArray: strokeDashArray,
        }
      );

      addToCanvas(object);
    },
    addDiamond: () => {
      const HEIGHT = DIAMOND_OPTIONS.height;
      const WIDTH = DIAMOND_OPTIONS.width;

      const object = new fabric.Polygon(
        [
          { x: WIDTH / 2, y: 0 },
          { x: WIDTH, y: HEIGHT / 2 },
          { x: WIDTH / 2, y: HEIGHT },
          { x: 0, y: HEIGHT / 2 },
        ],
        {
          ...DIAMOND_OPTIONS,
          fill: fillColor,
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          strokeDashArray: strokeDashArray,
        }
      );
      addToCanvas(object);
    },
    canvas,
    getActiveFontWeight: () => {
      const selectedObject = selectedObjects[0];

      if (!selectedObject) {
        return FONT_WEIGHT;
      }

      // @ts-ignore
      // Faulty TS library, fontWeight exists.
      const value = selectedObject.get("fontWeight") || FONT_WEIGHT;

      return value;
    },
    getActiveFontFamily: () => {
      const selectedObject = selectedObjects[0];

      if (!selectedObject) {
        return fontFamily;
      }

      // @ts-ignore
      // Faulty TS library, fontFamily exists.
      const value = selectedObject.get("fontFamily") || fontFamily;

      return value;
    },
    getActiveFillColor: () => {
      const selectedObject = selectedObjects[0];

      if (!selectedObject) {
        return fillColor;
      }

      const value = selectedObject.get("fill") || fillColor;

      // Currently, gradients & patterns are not supported
      return value as string;
    },
    getActiveStrokeColor: () => {
      const selectedObject = selectedObjects[0];

      if (!selectedObject) {
        return strokeColor;
      }

      const value = selectedObject.get("stroke") || strokeColor;

      return value;
    },
    getActiveStrokeWidth: () => {
      const selectedObject = selectedObjects[0];

      if (!selectedObject) {
        return strokeWidth;
      }

      const value = selectedObject.get("strokeWidth") || strokeWidth;

      return value;
    },
    getActiveStrokeDashArray: () => {
      const selectedObject = selectedObjects[0];

      if (!selectedObject) {
        return strokeDashArray;
      }

      const value = selectedObject.get("strokeDashArray") || strokeDashArray;

      return value;
    },
    selectedObjects,
    pages,
    currentPageIndex,
    addPage,
    setPageIndex,
    deletePage,
  };
};

export const useEditor = ({
  defaultState,
  defaultHeight,
  defaultWidth,
  clearSelectionCallback,
  saveCallback,
}: EditorHookProps) => {
  const initialState = useRef(defaultState);
  const initialWidth = useRef(defaultWidth);
  const initialHeight = useRef(defaultHeight);

  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [selectedObjects, setSelectedObjects] = useState<fabric.Object[]>([]);

  const [fontFamily, setFontFamily] = useState(FONT_FAMILY);
  const [fillColor, setFillColor] = useState(FILL_COLOR);
  const [strokeColor, setStrokeColor] = useState(STROKE_COLOR);
  const [strokeWidth, setStrokeWidth] = useState(STROKE_WIDTH);
  const [strokeDashArray, setStrokeDashArray] = useState<number[]>(STROKE_DASH_ARRAY);

  const [pages, setPages] = useState<string[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const isPaging = useRef(false);

  const handleSave = useCallback(
    (values: { json: string; height: number; width: number }) => {
      if (isPaging.current) return;

      setPages((currentPages) => {
        const nextPages = [...currentPages];
        if (nextPages.length === 0) {
          nextPages.push(values.json);
        } else {
          nextPages[currentPageIndex] = values.json;
        }

        const payload = {
          isMultiPage: true,
          pages: nextPages,
        };

        saveCallback?.({
          json: JSON.stringify(payload),
          height: values.height,
          width: values.width,
        });

        return nextPages;
      });
    },
    [currentPageIndex, saveCallback]
  );

  useWindowEvents();

  const {
    save,
    canRedo,
    canUndo,
    undo,
    redo,
    canvasHistory,
    setHistoryIndex,
  } = useHistory({
    canvas,
    saveCallback: handleSave
  });

  const { copy, paste } = useClipboard({ canvas });

  const { autoZoom } = useAutoResize({
    canvas,
    container,
  });

  useCanvasEvents({
    save,
    canvas,
    setSelectedObjects,
    clearSelectionCallback,
  });

  useHotkeys({
    undo,
    redo,
    copy,
    paste,
    save,
    canvas,
  });

  useLoadState({
    canvas,
    autoZoom,
    initialState,
    canvasHistory,
    setHistoryIndex,
    setPages, // newly added parameter
  });

  const setPageIndex = useCallback((index: number) => {
    if (!canvas || index < 0 || index >= pages.length) return;

    isPaging.current = true;
    const currentState = canvas.toJSON(JSON_KEYS);

    // Safely clone from closure. Any pending saves for currentPageIndex 
    // are naturally overwritten by our fresh currentState extraction!
    const nextPages = [...pages];
    nextPages[currentPageIndex] = JSON.stringify(currentState);

    const newPageJson = JSON.parse(nextPages[index]);

    setPages(nextPages);

    canvas.loadFromJSON(newPageJson, () => {
      canvas.renderAll();
      setCurrentPageIndex(index);
      canvasHistory.current = [JSON.stringify(newPageJson)];
      setHistoryIndex(0);
      isPaging.current = false;
    });

    const payload = {
      isMultiPage: true,
      pages: nextPages,
    };

    const workspace = canvas.getObjects().find((obj) => obj.name === "clip");
    const height = workspace?.height || 0;
    const width = workspace?.width || 0;

    saveCallback?.({
      json: JSON.stringify(payload),
      height,
      width,
    });
  }, [canvas, pages, currentPageIndex, canvasHistory, setHistoryIndex, saveCallback]);

  const addPage = useCallback(() => {
    if (!canvas) return;
    isPaging.current = true;

    const currentState = canvas.toJSON(JSON_KEYS);
    const emptyState = { ...currentState };
    emptyState.objects = emptyState.objects.filter((obj: any) => obj.name === "clip");

    const nextPages = [...pages];
    nextPages[currentPageIndex] = JSON.stringify(currentState);
    nextPages.push(JSON.stringify(emptyState));

    const newIndex = nextPages.length - 1;

    setPages(nextPages);

    canvas.loadFromJSON(emptyState, () => {
      canvas.renderAll();
      setCurrentPageIndex(newIndex);
      canvasHistory.current = [JSON.stringify(emptyState)];
      setHistoryIndex(0);
      isPaging.current = false;
    });

    const payload = {
      isMultiPage: true,
      pages: nextPages,
    };

    const workspace = canvas.getObjects().find((obj) => obj.name === "clip");
    const height = workspace?.height || 0;
    const width = workspace?.width || 0;

    saveCallback?.({
      json: JSON.stringify(payload),
      height,
      width,
    });
  }, [canvas, pages, currentPageIndex, canvasHistory, setHistoryIndex, saveCallback]);

  const deletePage = useCallback(() => {
    if (!canvas || pages.length <= 1) return;

    isPaging.current = true;

    const nextPages = [...pages];
    nextPages.splice(currentPageIndex, 1);

    const newIndex = Math.max(0, currentPageIndex - 1);
    const newPageJson = JSON.parse(nextPages[newIndex]);

    setPages(nextPages);

    canvas.loadFromJSON(newPageJson, () => {
      canvas.renderAll();
      setCurrentPageIndex(newIndex);
      canvasHistory.current = [JSON.stringify(newPageJson)];
      setHistoryIndex(0);
      isPaging.current = false;
    });

    const payload = {
      isMultiPage: true,
      pages: nextPages,
    };

    const workspace = canvas.getObjects().find((obj) => obj.name === "clip");
    const height = workspace?.height || 0;
    const width = workspace?.width || 0;

    saveCallback?.({
      json: JSON.stringify(payload),
      height,
      width,
    });
  }, [canvas, pages, currentPageIndex, canvasHistory, setHistoryIndex, saveCallback]);

  const editor = useMemo(() => {
    if (canvas) {
      return buildEditor({
        save,
        undo,
        redo,
        canUndo,
        canRedo,
        autoZoom,
        copy,
        paste,
        canvas,
        fillColor,
        strokeWidth,
        strokeColor,
        setFillColor,
        setStrokeColor,
        setStrokeWidth,
        strokeDashArray,
        selectedObjects,
        setStrokeDashArray,
        fontFamily,
        setFontFamily,
        pages,
        currentPageIndex,
        addPage,
        setPageIndex,
        deletePage,
      });
    }

    return undefined;
  },
    [
      canRedo,
      canUndo,
      undo,
      redo,
      save,
      autoZoom,
      copy,
      paste,
      canvas,
      fillColor,
      strokeWidth,
      strokeColor,
      selectedObjects,
      strokeDashArray,
      fontFamily,
      pages,
      currentPageIndex,
      addPage,
      setPageIndex,
      deletePage,
    ]);

  const init = useCallback(
    ({
      initialCanvas,
      initialContainer,
    }: {
      initialCanvas: fabric.Canvas;
      initialContainer: HTMLDivElement;
    }) => {
      fabric.Object.prototype.set({
        cornerColor: "#FFF",
        cornerStyle: "circle",
        borderColor: "#3b82f6",
        borderScaleFactor: 1.5,
        transparentCorners: false,
        borderOpacityWhenMoving: 1,
        cornerStrokeColor: "#3b82f6",
      });

      const initialWorkspace = new fabric.Rect({
        width: initialWidth.current,
        height: initialHeight.current,
        name: "clip",
        fill: "white",
        selectable: false,
        hasControls: false,
        shadow: new fabric.Shadow({
          color: "rgba(0,0,0,0.8)",
          blur: 5,
        }),
      });

      initialCanvas.setWidth(initialContainer.offsetWidth);
      initialCanvas.setHeight(initialContainer.offsetHeight);

      initialCanvas.add(initialWorkspace);
      initialCanvas.centerObject(initialWorkspace);
      initialCanvas.clipPath = initialWorkspace;

      setCanvas(initialCanvas);
      setContainer(initialContainer);

      const currentState = JSON.stringify(
        initialCanvas.toJSON(JSON_KEYS)
      );
      canvasHistory.current = [currentState];
      setHistoryIndex(0);
    },
    [
      canvasHistory, // No need, this is from useRef
      setHistoryIndex, // No need, this is from useState
    ]
  );

  return { init, editor };
};
