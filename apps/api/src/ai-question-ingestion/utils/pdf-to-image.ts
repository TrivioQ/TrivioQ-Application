import fs from 'fs';
import path from 'path';
import { fromPath } from 'pdf2pic';
import { PDFDocument } from 'pdf-lib';
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

  let start = fromPage ?? 1;
  let end = toPage;

  if (end === undefined) {
    // Read the total number of pages using pdf-lib to avoid converting excess pages
    const pdfBytes = fs.readFileSync(resolvedPdf);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    end = pdfDoc.getPageCount();
  }

  // We now have a definitive range [start, end]
  const allPages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  let response: WriteImageResponse[] = [];

  // Batch process pages to prevent running out of /tmp space or memory (e.g. write EPIPE errors from graphicsmagick)
  const BATCH_SIZE = 10;
  for (let i = 0; i < allPages.length; i += BATCH_SIZE) {
    const chunk = allPages.slice(i, i + BATCH_SIZE);
    const chunkResponse = await converter.bulk(chunk);
    response.push(...chunkResponse);
  }

  const imagePaths = response.map((res) => res.path!);

  // pdf2pic may return paths in arbitrary order; sort them numerically so indexes are stable (e.g., page 2 before page 10).
  imagePaths.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  return imagePaths;
}
