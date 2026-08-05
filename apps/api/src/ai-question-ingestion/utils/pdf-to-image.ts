import fs from 'fs';
import path from 'path';
import { fromPath } from 'pdf2pic';
import { PDFDocument } from 'pdf-lib';
import type { Options as Pdf2PicOptions } from 'pdf2pic/dist/types/options';
import { detectAndCorrectOrientation } from './detect-and-correct-orientation';

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
  /**
   * Automatically detect and correct sideways pages using Tesseract OSD.
   *
   * PDF pages physically scanned or generated sideways have a rotation flag of
   * 0 in their metadata, so standard libraries cannot detect the issue. This
   * option uses pixel-level orientation analysis (Tesseract PSM 0) to find
   * pages whose text is rotated 90°/180°/270° and corrects them in-place
   * before they enter the AI pipeline.
   *
   * @default true
   */
  autoOrient?: boolean;
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

  const { format = 'jpeg', density = 100, width, height, preserveAspectRatio = true, fromPage, toPage, autoOrient = true } = options;
  const baseFilename = path.basename(resolvedPdf, path.extname(resolvedPdf));

  // Load the original PDF document to slice it into manageable chunks.
  const pdfBytes = fs.readFileSync(resolvedPdf);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  const start = fromPage ?? 1;
  const end = toPage ?? pdfDoc.getPageCount();

  const responsePaths: string[] = [];
  const CHUNK_SIZE = 25; // 25 pages per chunk for optimal speed vs memory balance

  // pdf-lib pages are 0-indexed
  const allPageIndices = Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);

  for (let i = 0; i < allPageIndices.length; i += CHUNK_SIZE) {
    const chunkIndices = allPageIndices.slice(i, i + CHUNK_SIZE);

    // Create a temporary PDF for this chunk
    const tempDoc = await PDFDocument.create();
    const copiedPages = await tempDoc.copyPages(pdfDoc, chunkIndices);
    for (const page of copiedPages) {
      tempDoc.addPage(page);
    }
    const tempBytes = await tempDoc.save();

    // Use a unique name for the temporary PDF to avoid any conflicts
    const randomHex = Math.random().toString(36).substring(2, 8);
    const tempFileName = `temp_${baseFilename}_${randomHex}.pdf`;
    const tempFilePath = path.join(resolvedOutput, tempFileName);
    fs.writeFileSync(tempFilePath, tempBytes);

    try {
      const pdf2picOptions: Pdf2PicOptions = {
        format,
        density,
        preserveAspectRatio,
        savePath: resolvedOutput,
        saveFilename: `${baseFilename}_temp_${randomHex}`,
      };

      if (width !== undefined) pdf2picOptions.width = width;
      if (height !== undefined) pdf2picOptions.height = height;

      const converter = fromPath(tempFilePath, pdf2picOptions);

      // Convert all pages in this tiny temporary PDF via a single Ghostscript process! (EXTREMELY FAST)
      const chunkResponse = await converter.bulk(-1);

      // Rename files to match the expected page number format
      for (const res of chunkResponse) {
        if (!res.path || res.page === undefined) continue;

        const ext = path.extname(res.path);
        // res.page is 1-indexed relative to the chunk (e.g. 1 to 25)
        const actualPage = start + i + res.page - 1;
        const finalPath = path.join(resolvedOutput, `${baseFilename}_page.${actualPage}${ext}`);

        fs.renameSync(res.path, finalPath);

        // Detect and correct sideways pages whose PDF rotation metadata is 0.
        // Tesseract OSD (PSM 0) analyses text pixels to find the dominant angle;
        // sharp rotates the image in-place when a non-zero angle is detected.
        if (autoOrient) {
          try {
            await detectAndCorrectOrientation(finalPath);
          } catch (err) {
            // Non-fatal — a sideways image is better than a crashed pipeline.
            console.warn(`[AutoOrient] OSD failed for ${path.basename(finalPath)}, skipping:`, err);
          }
        }

        responsePaths.push(finalPath);
      }
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  }

  // Sort paths numerically so indexes are stable
  responsePaths.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  return responsePaths;
}
