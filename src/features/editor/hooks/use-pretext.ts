"use client";

import { useCallback, useRef } from "react";

// Pretext is a client-side-only library — these are lazy-loaded on first use
let pretextModule: typeof import("@chenglou/pretext") | null = null;

async function getPretextModule() {
  if (!pretextModule) {
    pretextModule = await import("@chenglou/pretext");
  }
  return pretextModule;
}

export interface PretextMeasurement {
  height: number;
  lineCount: number;
}

/**
 * Hook that provides Pretext text measurement utilities.
 * Uses lazy-loading so the heavy module is only pulled in when needed.
 */
export function usePretext() {
  const cacheRef = useRef<Map<string, any>>(new Map());

  /**
   * Measure text height and line count at a given maxWidth + lineHeight.
   */
  const measureText = useCallback(
    async (
      text: string,
      font: string,
      maxWidth: number,
      lineHeight: number
    ): Promise<PretextMeasurement> => {
      const mod = await getPretextModule();
      const cacheKey = `${text}|${font}`;
      let prepared = cacheRef.current.get(cacheKey);
      if (!prepared) {
        prepared = mod.prepare(text, font);
        cacheRef.current.set(cacheKey, prepared);
      }
      return mod.layout(prepared, maxWidth, lineHeight);
    },
    []
  );

  /**
   * Get individual lines with their widths for manual rendering or analysis.
   */
  const getLines = useCallback(
    async (
      text: string,
      font: string,
      maxWidth: number,
      lineHeight: number
    ) => {
      const mod = await getPretextModule();
      const cacheKey = `seg|${text}|${font}`;
      let prepared = cacheRef.current.get(cacheKey);
      if (!prepared) {
        prepared = mod.prepareWithSegments(text, font);
        cacheRef.current.set(cacheKey, prepared);
      }
      return mod.layoutWithLines(prepared, maxWidth, lineHeight);
    },
    []
  );

  /**
   * Find the optimal "balanced" width for a piece of text.
   * Binary-searches for the narrowest width that keeps the same line count.
   */
  const findBalancedWidth = useCallback(
    async (
      text: string,
      font: string,
      maxWidth: number,
      lineHeight: number
    ): Promise<number> => {
      const mod = await getPretextModule();
      const cacheKey = `seg|${text}|${font}`;
      let prepared = cacheRef.current.get(cacheKey);
      if (!prepared) {
        prepared = mod.prepareWithSegments(text, font);
        cacheRef.current.set(cacheKey, prepared);
      }

      const baseline = mod.measureLineStats(prepared, maxWidth);
      if (baseline.lineCount <= 1) return maxWidth;

      // Binary search for the tightest width that keeps the same line count
      let lo = baseline.maxLineWidth * 0.5;
      let hi = maxWidth;
      while (hi - lo > 1) {
        const mid = (lo + hi) / 2;
        const trial = mod.measureLineStats(prepared, mid);
        if (trial.lineCount <= baseline.lineCount) {
          hi = mid;
        } else {
          lo = mid;
        }
      }
      return Math.ceil(hi);
    },
    []
  );

  /**
   * Clear internal pretext caches (useful on font/locale change).
   */
  const clearPretextCache = useCallback(async () => {
    const mod = await getPretextModule();
    mod.clearCache();
    cacheRef.current.clear();
  }, []);

  return {
    measureText,
    getLines,
    findBalancedWidth,
    clearPretextCache,
  };
}
