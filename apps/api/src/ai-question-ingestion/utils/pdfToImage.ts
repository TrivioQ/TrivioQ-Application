import fs from 'fs';
import path from 'path';
import { fromPath } from 'pdf2pic';
import type { Options as Pdf2PicOptions } from 'pdf2pic/dist/types/options';

export interface PdfToImageOptions {
  /** @default "png" */
  format?: 'png' | 'jpeg' | 'webp';
  /** @default 200 */
  density?: number;
  /** Image width in pixels (preserves aspect ratio by default). */
  width?: number;
  /** Image height in pixels (preserves aspect ratio by default). */
  height?: number;
  /** @default true */
  preserveAspectRatio?: boolean;
}

/**
 * Converts a local PDF file into an array of image file paths.
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

  const { format = 'png', density = 200, width, height, preserveAspectRatio = true } = options;

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
  const response = await converter.bulk(-1);

  const imagePaths = response.map((res) => res.path!);

  // pdf2pic may return paths in arbitrary order; sort them so indexes are stable.
  imagePaths.sort((a, b) => a.localeCompare(b));

  return imagePaths;
}
