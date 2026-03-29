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
type ThemeColorMap = Record<string, string>;
type TextStyle = {
  fill?: string;
  fontFamily?: string;
  fontSize?: number;
  fontStyle?: "italic" | "normal";
  fontWeight?: number;
  linethrough?: boolean;
  underline?: boolean;
};
type TextRun = {
  style: TextStyle;
  text: string;
};
type ParagraphContent = {
  alignment: fabric.Textbox["textAlign"];
  runs: TextRun[];
};
type PlaceholderInfo = {
  idx?: string;
  type?: string;
};
type ShapeStyleContext = {
  masterDefaultRunProps?: Element;
  placeholderInfo?: PlaceholderInfo;
  slideMasterXml?: XMLDocument;
  sourceShapes: Element[];
};

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

const getFirstDescendantByLocalName = (node: XmlNode, localName: string) => {
  return getDescendantsByLocalName(node, localName)[0];
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

const getParagraphAlignment = (
  paragraphProps: Element | undefined,
  fallback: fabric.Textbox["textAlign"]
) => {
  const alignment = paragraphProps?.getAttribute("algn");

  switch (alignment) {
    case "ctr":
      return "center";
    case "r":
      return "right";
    case "just":
      return "justify";
    default:
      return fallback;
  }
};

const pptFontSizeToPx = (pptSize?: string | null) => {
  const parsedSize = Number(pptSize || "1800");
  return Math.max(14, (parsedSize / 100) * (96 / 72));
};

const normalizeColor = (value?: string | null) => {
  if (!value) return undefined;
  return value.startsWith("#") ? value : `#${value}`;
};

const getColorFromFill = (
  fillParent: Element | undefined,
  themeColors: ThemeColorMap
) => {
  if (!fillParent) return undefined;

  const solidFill =
    fillParent.localName === "solidFill"
      ? fillParent
      : getDirectChildByLocalName(fillParent, "solidFill");

  if (!solidFill) return undefined;

  const srgbClr = getDirectChildByLocalName(solidFill, "srgbClr");
  const schemeClr = getDirectChildByLocalName(solidFill, "schemeClr");
  const presetClr = getDirectChildByLocalName(solidFill, "prstClr");

  if (srgbClr?.getAttribute("val")) {
    return normalizeColor(srgbClr.getAttribute("val"));
  }

  if (schemeClr?.getAttribute("val")) {
    return themeColors[schemeClr.getAttribute("val") || ""] || undefined;
  }

  if (presetClr?.getAttribute("val")) {
    return presetClr.getAttribute("val") || undefined;
  }

  return undefined;
};

const getShapeTextColor = (shape: Element, themeColors: ThemeColorMap) => {
  const textBody = getDescendantsByLocalName(shape, "txBody")[0];
  const bodyProps = textBody ? getDirectChildByLocalName(textBody, "bodyPr") : undefined;
  const shapeFill = getDescendantsByLocalName(shape, "solidFill")[0];

  return (
    getColorFromFill(bodyProps, themeColors) ||
    getColorFromFill(shapeFill, themeColors) ||
    "#111827"
  );
};

const getPlaceholderInfo = (shape: Element): PlaceholderInfo | undefined => {
  const nvSpPr = getDirectChildByLocalName(shape, "nvSpPr");
  const nvPr = nvSpPr ? getDirectChildByLocalName(nvSpPr, "nvPr") : undefined;
  const placeholder = nvPr ? getDirectChildByLocalName(nvPr, "ph") : undefined;

  if (!placeholder) return undefined;

  return {
    idx: placeholder.getAttribute("idx") || undefined,
    type: placeholder.getAttribute("type") || "body",
  };
};

const findPlaceholderShape = (
  sourceXml: XMLDocument | undefined,
  placeholderInfo: PlaceholderInfo | undefined
) => {
  if (!sourceXml || !placeholderInfo) return undefined;

  const shapes = getDescendantsByLocalName(sourceXml, "sp");

  return shapes.find((shape) => {
    const info = getPlaceholderInfo(shape);
    if (!info) return false;

    const sameType = (info.type || "body") === (placeholderInfo.type || "body");
    const sameIdx = (info.idx || "") === (placeholderInfo.idx || "");

    if (placeholderInfo.idx) {
      return sameType && sameIdx;
    }

    return sameType;
  });
};

const getTextLevelProps = (shape: Element, level = 0) => {
  const textBody = getFirstDescendantByLocalName(shape, "txBody");
  const listStyle = textBody ? getDirectChildByLocalName(textBody, "lstStyle") : undefined;
  const levelTag = `lvl${level + 1}pPr`;
  const paragraphProps = listStyle ? getDirectChildByLocalName(listStyle, levelTag) : undefined;

  return {
    defaultRunProps: paragraphProps ? getDirectChildByLocalName(paragraphProps, "defRPr") : undefined,
    paragraphProps,
  };
};

const getMasterTextStyleProps = (
  slideMasterXml: XMLDocument | undefined,
  placeholderType: string | undefined,
  level = 0
) => {
  if (!slideMasterXml) return {};

  const txStyles = getFirstDescendantByLocalName(slideMasterXml, "txStyles");
  if (!txStyles) return {};

  const styleTag =
    placeholderType === "title" || placeholderType === "ctrTitle"
      ? "titleStyle"
      : placeholderType === "body" || placeholderType === "subTitle"
        ? "bodyStyle"
        : "otherStyle";

  const styleNode = getDirectChildByLocalName(txStyles, styleTag);
  if (!styleNode) return {};

  const levelTag = `lvl${level + 1}pPr`;
  const paragraphProps = getDirectChildByLocalName(styleNode, levelTag);

  return {
    defaultRunProps: paragraphProps ? getDirectChildByLocalName(paragraphProps, "defRPr") : undefined,
    paragraphProps,
  };
};

const buildShapeStyleContext = ({
  shape,
  slideLayoutXml,
  slideMasterXml,
}: {
  shape: Element;
  slideLayoutXml?: XMLDocument;
  slideMasterXml?: XMLDocument;
}): ShapeStyleContext => {
  const placeholderInfo = getPlaceholderInfo(shape);
  const layoutShape = findPlaceholderShape(slideLayoutXml, placeholderInfo);
  const masterShape = findPlaceholderShape(slideMasterXml, placeholderInfo);
  const masterTextStyle = getMasterTextStyleProps(
    slideMasterXml,
    placeholderInfo?.type,
    0
  );

  return {
    masterDefaultRunProps: masterTextStyle.defaultRunProps,
    placeholderInfo,
    slideMasterXml,
    sourceShapes: [shape, layoutShape, masterShape].filter(Boolean) as Element[],
  };
};

const getDefaultRunProps = (
  styleContext: ShapeStyleContext,
  level = 0
) => {
  for (const sourceShape of styleContext.sourceShapes) {
    const textLevelProps = getTextLevelProps(sourceShape, level);
    const directDefRpr = getFirstDescendantByLocalName(sourceShape, "defRPr");
    const endParaRPr = getFirstDescendantByLocalName(sourceShape, "endParaRPr");

    if (directDefRpr || textLevelProps.defaultRunProps || endParaRPr) {
      return directDefRpr || textLevelProps.defaultRunProps || endParaRPr;
    }
  }

  return styleContext.masterDefaultRunProps;
};

const getRunTypeface = (runProps: Element | undefined) => {
  const latin = runProps ? getDirectChildByLocalName(runProps, "latin") : undefined;
  const typeface = latin?.getAttribute("typeface");

  if (!typeface || typeface.startsWith("+")) {
    return "Arial";
  }

  return typeface;
};

const getRunStyle = ({
  defaultRunProps,
  fallbackColor,
  runProps,
  themeColors,
}: {
  defaultRunProps?: Element;
  fallbackColor: string;
  runProps?: Element;
  themeColors: ThemeColorMap;
}): TextStyle => {
  const sizeSource = runProps?.getAttribute("sz") || defaultRunProps?.getAttribute("sz");
  const fill =
    getColorFromFill(runProps, themeColors) ||
    getColorFromFill(defaultRunProps, themeColors) ||
    fallbackColor;

  return {
    fill,
    fontFamily: getRunTypeface(runProps) || getRunTypeface(defaultRunProps),
    fontSize: pptFontSizeToPx(sizeSource),
    fontStyle: runProps?.getAttribute("i") === "1" || defaultRunProps?.getAttribute("i") === "1"
      ? "italic"
      : "normal",
    fontWeight: runProps?.getAttribute("b") === "1" || defaultRunProps?.getAttribute("b") === "1"
      ? 700
      : 400,
    linethrough:
      runProps?.getAttribute("strike") === "sngStrike" ||
      defaultRunProps?.getAttribute("strike") === "sngStrike",
    underline:
      (runProps?.getAttribute("u") && runProps.getAttribute("u") !== "none") ||
      (defaultRunProps?.getAttribute("u") && defaultRunProps.getAttribute("u") !== "none")
        ? true
        : false,
  };
};

const buildParagraphContent = (
  styleContext: ShapeStyleContext,
  paragraph: Element,
  themeColors: ThemeColorMap
): ParagraphContent | null => {
  const level = Number(getDirectChildByLocalName(paragraph, "pPr")?.getAttribute("lvl") || "0");
  const defaultRunProps = getDefaultRunProps(styleContext, level);
  const paragraphProps = getDirectChildByLocalName(paragraph, "pPr");
  const paragraphDefaultFromSource = styleContext.sourceShapes
    .map((sourceShape) => getTextLevelProps(sourceShape, level).defaultRunProps)
    .find(Boolean);
  const paragraphPropsFromSource = styleContext.sourceShapes
    .map((sourceShape) => getTextLevelProps(sourceShape, level).paragraphProps)
    .find(Boolean);
  const masterTextStyle = getMasterTextStyleProps(
    styleContext.slideMasterXml,
    styleContext.placeholderInfo?.type,
    level
  );
  const paragraphDefaultRunProps = paragraphProps
    ? getDirectChildByLocalName(paragraphProps, "defRPr")
    : paragraphDefaultFromSource || masterTextStyle.defaultRunProps;
  const fallbackColor =
    styleContext.sourceShapes
      .map((sourceShape) => getShapeTextColor(sourceShape, themeColors))
      .find(Boolean) || "#111827";

  const runs: TextRun[] = [];

  for (const child of toArray(paragraph.childNodes)) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const element = child as Element;

    if (element.localName === "r") {
      const runProps = getDirectChildByLocalName(element, "rPr") || paragraphDefaultRunProps || defaultRunProps;
      const textNode = getDirectChildByLocalName(element, "t");
      const text = textNode?.textContent || "";

      if (!text) continue;

      runs.push({
        style: getRunStyle({
          defaultRunProps: paragraphDefaultRunProps || defaultRunProps,
          fallbackColor,
          runProps,
          themeColors,
        }),
        text,
      });
    }

    if (element.localName === "br") {
      runs.push({
        style: getRunStyle({
          defaultRunProps: paragraphDefaultRunProps || defaultRunProps,
          fallbackColor,
          runProps: getDirectChildByLocalName(element, "rPr") || paragraphDefaultRunProps || defaultRunProps,
          themeColors,
        }),
        text: "\n",
      });
    }

    if (element.localName === "fld") {
      const runProps = getDirectChildByLocalName(element, "rPr") || paragraphDefaultRunProps || defaultRunProps;
      const textNode = getDirectChildByLocalName(element, "t");
      const text = textNode?.textContent || "";

      if (!text) continue;

      runs.push({
        style: getRunStyle({
          defaultRunProps: paragraphDefaultRunProps || defaultRunProps,
          fallbackColor,
          runProps,
          themeColors,
        }),
        text,
      });
    }
  }

  if (runs.length === 0) {
    const endParaRPr = getDirectChildByLocalName(paragraph, "endParaRPr") || paragraphDefaultRunProps || defaultRunProps;
    return {
      alignment: getParagraphAlignment(
        paragraphProps || paragraphPropsFromSource || masterTextStyle.paragraphProps,
        getTextAlignment(styleContext.sourceShapes[0]) as fabric.Textbox["textAlign"]
      ),
      runs: [{
        style: getRunStyle({
          defaultRunProps: paragraphDefaultRunProps || defaultRunProps,
          fallbackColor,
          runProps: endParaRPr,
          themeColors,
        }),
        text: "",
      }],
    };
  }

  return {
    alignment: getParagraphAlignment(
      paragraphProps || paragraphPropsFromSource || masterTextStyle.paragraphProps,
      getTextAlignment(styleContext.sourceShapes[0]) as fabric.Textbox["textAlign"]
    ),
    runs,
  };
};

const buildTextContent = (
  shape: Element,
  styleContext: ShapeStyleContext,
  themeColors: ThemeColorMap
) => {
  const paragraphs = getDescendantsByLocalName(shape, "p")
    .map((paragraph) => buildParagraphContent(styleContext, paragraph, themeColors))
    .filter(Boolean) as ParagraphContent[];

  if (paragraphs.length === 0) return null;

  let text = "";
  let defaultStyle: TextStyle | undefined;
  const styles: Record<number, Record<number, TextStyle>> = {};
  let lineIndex = 0;
  let charIndex = 0;
  let textAlign: fabric.Textbox["textAlign"] = "left";

  const applyText = (value: string, style: TextStyle) => {
    if (!defaultStyle) {
      defaultStyle = style;
    }

    for (const character of value) {
      if (character === "\n") {
        text += "\n";
        lineIndex += 1;
        charIndex = 0;
        continue;
      }

      if (!styles[lineIndex]) {
        styles[lineIndex] = {};
      }

      styles[lineIndex][charIndex] = style;
      text += character;
      charIndex += 1;
    }
  };

  paragraphs.forEach((paragraph, paragraphIndex) => {
    if (paragraphIndex === 0) {
      textAlign = paragraph.alignment;
    }

    paragraph.runs.forEach((run) => applyText(run.text, run.style));

    if (paragraphIndex < paragraphs.length - 1) {
      applyText("\n", defaultStyle || paragraph.runs[0]?.style || {});
    }
  });

  if (!text.trim()) return null;

  return {
    defaultStyle: defaultStyle || {
      fill: getShapeTextColor(shape, themeColors),
      fontFamily: "Arial",
      fontSize: 24,
      fontStyle: "normal" as const,
      fontWeight: 400,
      underline: false,
      linethrough: false,
    },
    styles,
    text,
    textAlign,
  };
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

const buildThemeColorMap = async (zip: any) => {
  const themeXml = await readXml(zip, "ppt/theme/theme1.xml");
  if (!themeXml) return {} as ThemeColorMap;

  const colorScheme = getDescendantsByLocalName(themeXml, "clrScheme")[0];
  if (!colorScheme) return {} as ThemeColorMap;

  const themeColors: ThemeColorMap = {};

  for (const node of toArray(colorScheme.childNodes)) {
    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    const element = node as Element;
    const colorNode =
      getDirectChildByLocalName(element, "srgbClr") ||
      getDirectChildByLocalName(element, "sysClr");
    const colorValue = colorNode?.getAttribute("val") || colorNode?.getAttribute("lastClr");

    if (element.localName && colorValue) {
      themeColors[element.localName] = normalizeColor(colorValue) || colorValue;
    }
  }

  return themeColors;
};

const buildSlideJson = async ({
  height,
  presentationHeightEmu,
  presentationWidthEmu,
  slideRelationships,
  slideXml,
  slideLayoutXml,
  slideMasterXml,
  themeColors,
  width,
  zip,
}: {
  height: number;
  presentationHeightEmu: number;
  presentationWidthEmu: number;
  slideRelationships: SlideRelationshipMap;
  slideXml: XMLDocument;
  slideLayoutXml?: XMLDocument;
  slideMasterXml?: XMLDocument;
  themeColors: ThemeColorMap;
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
    const styleContext = buildShapeStyleContext({
      shape,
      slideLayoutXml,
      slideMasterXml,
    });
    const textContent = buildTextContent(shape, styleContext, themeColors);
    if (!textContent) continue;

    const box = getShapeBox(shape, widthRatio, heightRatio);
    const textbox = new fabric.Textbox(textContent.text, {
      angle: box.angle,
      fill: textContent.defaultStyle.fill,
      fontFamily: textContent.defaultStyle.fontFamily || "Arial",
      fontSize: textContent.defaultStyle.fontSize || 24,
      fontStyle: textContent.defaultStyle.fontStyle || "normal",
      fontWeight: textContent.defaultStyle.fontWeight || 400,
      height: Math.max(box.height, 32),
      left: box.left,
      linethrough: textContent.defaultStyle.linethrough || false,
      styles: textContent.styles,
      textAlign: textContent.textAlign,
      top: box.top,
      underline: textContent.defaultStyle.underline || false,
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
  const themeColors = await buildThemeColorMap(zip);

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

    const slideLayoutPath = Object.values(slideRelationships).find((path) =>
      path.includes("/slideLayouts/")
    );
    const slideLayoutXml = slideLayoutPath
      ? ((await readXml(zip, slideLayoutPath)) || undefined)
      : undefined;

    let slideMasterXml: XMLDocument | undefined;
    if (slideLayoutPath && slideLayoutXml) {
      const slideLayoutRelationships = await buildRelationshipMap(
        zip,
        slideLayoutPath.replace("/slideLayouts/", "/slideLayouts/_rels/").replace(".xml", ".xml.rels"),
        slideLayoutPath
      );

      const slideMasterPath = Object.values(slideLayoutRelationships).find((path) =>
        path.includes("/slideMasters/")
      );

      slideMasterXml = slideMasterPath
        ? ((await readXml(zip, slideMasterPath)) || undefined)
        : undefined;
    }

    pages.push(
      await buildSlideJson({
        height,
        presentationHeightEmu,
        presentationWidthEmu,
        slideRelationships,
        slideXml,
        slideLayoutXml,
        slideMasterXml,
        themeColors,
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
