import fs from 'fs';
import path from 'path';
import { fromPath } from 'pdf2pic';
import type { Options as Pdf2PicOptions } from 'pdf2pic/dist/types/options';
import type { WriteImageResponse } from 'pdf2pic/dist/types/convertResponse';

export interface PdfToImageOptions {
  /** @default "jpeg" */
  format?: 'png' | 'jpeg' | 'webp';
  /** @default 100 */
  density?: number;
  /** Image width in pixels (preserves aspect ratio by default). */
  width?: number;
  /** Image height in pixels (preserves aspect ratio by default). */
  height?: number;
  /** @default true */
  preserveAspectRatio?: boolean;
  /**
   * 1-based first page to convert (inclusive).
   * If omitted, conversion starts from page 1.
   */
  fromPage?: number;
  /**
   * 1-based last page to convert (inclusive).
   * If omitted, conversion continues to the last page.
   */
  toPage?: number;
}

/**
 * Converts a local PDF file into an array of image file paths.
 *
 * When `fromPage` and/or `toPage` are provided, only the specified page range
 * is converted. If neither is set, all pages are converted (default behaviour).
 *
 * @param pdfPath - Absolute or relative path to the PDF file.
 * @param outputDir - Directory where page images will be saved.
 * @param options - Optional conversion settings.
 * @returns A sorted array of paths to the generated image files.
 */
export async function pdfToImage(pdfPath: string, outputDir: string, options: PdfToImageOptions = {}): Promise<string[]> {
  const resolvedPdf = path.resolve(pdfPath);
  const resolvedOutput = path.resolve(outputDir);

  if (!fs.existsSync(resolvedPdf)) {
    throw new Error(`PDF file not found: ${resolvedPdf}`);
  }

  if (!fs.existsSync(resolvedOutput)) {
    fs.mkdirSync(resolvedOutput, { recursive: true });
  }

  const { format = 'jpeg', density = 100, width, height, preserveAspectRatio = true, fromPage, toPage } = options;

  const baseFilename = path.basename(resolvedPdf, path.extname(resolvedPdf));

  const pdf2picOptions: Pdf2PicOptions = {
    format,
    density,
    preserveAspectRatio,
    savePath: resolvedOutput,
    saveFilename: `${baseFilename}_page`,
  };

  if (width !== undefined) pdf2picOptions.width = width;
  if (height !== undefined) pdf2picOptions.height = height;

  const converter = fromPath(resolvedPdf, pdf2picOptions);

  let response: WriteImageResponse[];

  if (fromPage !== undefined || toPage !== undefined) {
    // Build an explicit list of 1-based page numbers for the requested range.
    const start = fromPage ?? 1;
    const end = toPage; // may be undefined — handled below

    if (end !== undefined) {
      // Both bounds known: produce [start, start+1, ..., end]
      const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      response = await converter.bulk(pages);
    } else {
      // Only fromPage given — convert from that page to the end of the PDF.
      // pdf2pic does not natively support "from page X to end", so we convert
      // all pages and then filter the results down to those at or after `start`.
      const allResponse = await converter.bulk(-1);
      response = allResponse.filter((res) => (res.page ?? 0) >= start);
    }
  } else {
    // No range specified — convert all pages.
    response = await converter.bulk(-1);
  }

  const imagePaths = response.map((res) => res.path!);

  // pdf2pic may return paths in arbitrary order; sort them numerically so indexes are stable (e.g., page 2 before page 10).
  imagePaths.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  return imagePaths;
}
