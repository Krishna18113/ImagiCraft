"use client";

import { fabric } from "fabric";

import { JSON_KEYS } from "@/features/editor/types";

const PPTX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const EMU_PER_INCH = 914400;
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;

type XmlNode = Document | Element;

type SlideImportResult = {
  height: number;
  json: string;
  width: number;
};

type SlideRelationshipMap = Record<string, string>;

const toArray = <T>(value: ArrayLike<T>) => Array.from(value);

const getDescendantsByLocalName = (node: XmlNode, localName: string) => {
  return Array.from(node.getElementsByTagName("*")).filter(
    (element) => element.localName === localName
  );
};

const getDirectChildByLocalName = (node: XmlNode, localName: string) => {
  return toArray(node.childNodes).find(
    (child): child is Element =>
      child.nodeType === Node.ELEMENT_NODE && (child as Element).localName === localName
  );
};

const readXml = async (zip: any, path: string) => {
  const file = zip.file(path);
  if (!file) return null;

  const xmlText = await file.async("text");
  return new DOMParser().parseFromString(xmlText, "application/xml");
};

const normalizeZipPath = (basePath: string, target: string) => {
  const baseParts = basePath.split("/");
  baseParts.pop();

  const targetParts = target.split("/");
  for (const part of targetParts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      baseParts.pop();
      continue;
    }
    baseParts.push(part);
  }

  return baseParts.join("/");
};

const buildRelationshipMap = async (zip: any, relsPath: string, sourcePath: string) => {
  const relsXml = await readXml(zip, relsPath);
  if (!relsXml) return {} as SlideRelationshipMap;

  const relationships = getDescendantsByLocalName(relsXml, "Relationship");
  return relationships.reduce((acc, relationship) => {
    const id = relationship.getAttribute("Id");
    const target = relationship.getAttribute("Target");

    if (id && target) {
      acc[id] = normalizeZipPath(sourcePath, target);
    }

    return acc;
  }, {} as SlideRelationshipMap);
};

const getMimeTypeFromPath = (path: string) => {
  const extension = path.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
};

const getTextAlignment = (shape: Element) => {
  const paragraph = getDescendantsByLocalName(shape, "p")[0];
  const paragraphProps = paragraph ? getDirectChildByLocalName(paragraph, "pPr") : undefined;
  const alignment = paragraphProps?.getAttribute("algn");

  switch (alignment) {
    case "ctr":
      return "center";
    case "r":
      return "right";
    case "just":
      return "justify";
    default:
      return "left";
  }
};

const getTextColor = (shape: Element) => {
  const solidFill = getDescendantsByLocalName(shape, "solidFill")[0];
  const srgbClr = solidFill ? getDirectChildByLocalName(solidFill, "srgbClr") : undefined;
  const value = srgbClr?.getAttribute("val");

  return value ? `#${value}` : "#111827";
};

const getFontSize = (shape: Element) => {
  const runProps =
    getDescendantsByLocalName(shape, "rPr")[0] ||
    getDescendantsByLocalName(shape, "endParaRPr")[0];
  const pptSize = Number(runProps?.getAttribute("sz") || "1800");

  return Math.max(14, (pptSize / 100) * (96 / 72));
};

const getShapeBox = (
  element: Element,
  widthRatio: number,
  heightRatio: number
) => {
  const transform = getDescendantsByLocalName(element, "xfrm")[0];
  const offset = transform ? getDirectChildByLocalName(transform, "off") : undefined;
  const extent = transform ? getDirectChildByLocalName(transform, "ext") : undefined;

  const x = Number(offset?.getAttribute("x") || 0) * widthRatio;
  const y = Number(offset?.getAttribute("y") || 0) * heightRatio;
  const width = Number(extent?.getAttribute("cx") || 0) * widthRatio;
  const height = Number(extent?.getAttribute("cy") || 0) * heightRatio;
  const rotation = Number(transform?.getAttribute("rot") || 0) / 60000;

  return {
    angle: rotation,
    height,
    left: x,
    top: y,
    width,
  };
};

const fileToDataUrl = async (zip: any, path: string) => {
  const file = zip.file(path);
  if (!file) return null;

  const base64 = await file.async("base64");
  return `data:${getMimeTypeFromPath(path)};base64,${base64}`;
};

const createFabricImage = async (dataUrl: string) => {
  return new Promise<fabric.Image>((resolve, reject) => {
    fabric.Image.fromURL(
      dataUrl,
      (image) => {
        if (!image) {
          reject(new Error("Failed to load slide image"));
          return;
        }

        resolve(image);
      },
      { crossOrigin: "anonymous" }
    );
  });
};

const buildSlideJson = async ({
  height,
  presentationHeightEmu,
  presentationWidthEmu,
  slideRelationships,
  slideXml,
  width,
  zip,
}: {
  height: number;
  presentationHeightEmu: number;
  presentationWidthEmu: number;
  slideRelationships: SlideRelationshipMap;
  slideXml: XMLDocument;
  width: number;
  zip: any;
}) => {
  const widthRatio = presentationWidthEmu ? width / presentationWidthEmu : 1;
  const heightRatio = presentationHeightEmu ? height / presentationHeightEmu : 1;

  const tempCanvas = new fabric.StaticCanvas(null, { width, height });
  const workspace = new fabric.Rect({
    fill: "white",
    hasControls: false,
    height,
    left: 0,
    name: "clip",
    selectable: false,
    top: 0,
    width,
  });

  tempCanvas.add(workspace);

  const shapes = getDescendantsByLocalName(slideXml, "sp");
  for (const shape of shapes) {
    const text = getDescendantsByLocalName(shape, "p")
      .map((paragraph) =>
        getDescendantsByLocalName(paragraph, "t")
          .map((textNode) => textNode.textContent || "")
          .join("")
          .trim()
      )
      .filter(Boolean)
      .join("\n");

    if (!text) continue;

    const box = getShapeBox(shape, widthRatio, heightRatio);
    const textbox = new fabric.Textbox(text, {
      angle: box.angle,
      fill: getTextColor(shape),
      fontFamily: "Arial",
      fontSize: getFontSize(shape),
      height: Math.max(box.height, 32),
      left: box.left,
      textAlign: getTextAlignment(shape) as fabric.Textbox["textAlign"],
      top: box.top,
      width: Math.max(box.width, 80),
    });

    tempCanvas.add(textbox);
  }

  const pictures = getDescendantsByLocalName(slideXml, "pic");
  for (const picture of pictures) {
    const blip = getDescendantsByLocalName(picture, "blip")[0];
    const relationshipId = blip?.getAttribute("r:embed") || blip?.getAttribute("embed");
    const mediaPath = relationshipId ? slideRelationships[relationshipId] : undefined;

    if (!mediaPath) continue;

    const dataUrl = await fileToDataUrl(zip, mediaPath);
    if (!dataUrl) continue;

    const box = getShapeBox(picture, widthRatio, heightRatio);
    const image = await createFabricImage(dataUrl);
    const naturalWidth = image.width || box.width || 1;
    const naturalHeight = image.height || box.height || 1;

    image.set({
      angle: box.angle,
      left: box.left,
      scaleX: (box.width || naturalWidth) / naturalWidth,
      scaleY: (box.height || naturalHeight) / naturalHeight,
      top: box.top,
    });

    tempCanvas.add(image);
  }

  const slideJson = JSON.stringify(tempCanvas.toJSON(JSON_KEYS));
  tempCanvas.dispose();

  return slideJson;
};

export const isPptxFile = (fileName: string) => fileName.toLowerCase().endsWith(".pptx");

export const isLegacyPptFile = (fileName: string) => fileName.toLowerCase().endsWith(".ppt");

export const isPowerPointFile = (fileName: string) =>
  isPptxFile(fileName) || isLegacyPptFile(fileName);

export const isJsonFile = (fileName: string) => fileName.toLowerCase().endsWith(".json");

export const importPptxFile = async (file: File): Promise<SlideImportResult> => {
  if (!isPptxFile(file.name)) {
    throw new Error("Only .pptx files are supported for import right now.");
  }

  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const presentationXml = await readXml(zip, "ppt/presentation.xml");
  if (!presentationXml) {
    throw new Error("This file does not look like a valid PPTX presentation.");
  }

  const presentationRels = await buildRelationshipMap(
    zip,
    "ppt/_rels/presentation.xml.rels",
    "ppt/presentation.xml"
  );

  const sizeNode = getDescendantsByLocalName(presentationXml, "sldSz")[0];
  const presentationWidthEmu = Number(sizeNode?.getAttribute("cx") || 10 * EMU_PER_INCH);
  const presentationHeightEmu = Number(sizeNode?.getAttribute("cy") || 5.625 * EMU_PER_INCH);

  const width = DEFAULT_WIDTH;
  const height = Math.max(
    1,
    Math.round((presentationHeightEmu / presentationWidthEmu) * DEFAULT_WIDTH)
  ) || DEFAULT_HEIGHT;

  const slideIds = getDescendantsByLocalName(presentationXml, "sldId");
  const slidePaths = slideIds
    .map((slideId) => slideId.getAttribute("r:id") || slideId.getAttribute("id"))
    .filter(Boolean)
    .map((relationshipId) => presentationRels[relationshipId as string])
    .filter(Boolean);

  if (slidePaths.length === 0) {
    throw new Error("No slides were found in this PPTX file.");
  }

  const pages: string[] = [];

  for (const slidePath of slidePaths) {
    const slideXml = await readXml(zip, slidePath);
    if (!slideXml) continue;

    const slideRelationships = await buildRelationshipMap(
      zip,
      slidePath.replace("/slides/", "/slides/_rels/").replace(".xml", ".xml.rels"),
      slidePath
    );

    pages.push(
      await buildSlideJson({
        height,
        presentationHeightEmu,
        presentationWidthEmu,
        slideRelationships,
        slideXml,
        width,
        zip,
      })
    );
  }

  if (pages.length === 0) {
    throw new Error("The PPTX file was read, but no slide content could be imported.");
  }

  return {
    height,
    json: JSON.stringify({
      isMultiPage: true,
      pages,
    }),
    width,
  };
};

export const fetchFileFromUrl = async (url: string, fileName: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to download the uploaded file.");
  }

  const blob = await response.blob();
  return new File([blob], fileName, {
    type: blob.type || PPTX_MIME_TYPE,
  });
};
