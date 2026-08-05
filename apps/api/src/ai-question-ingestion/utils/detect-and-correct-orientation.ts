import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export interface OrientationCorrectionResult {
  /** The rotation (in degrees) applied to correct the image. 0 means no correction was needed. */
  rotationApplied: 0 | 90 | 180 | 270;
  /** Tesseract's confidence in the detected orientation (0–100). */
  confidence: number;
  /** Whether the image file was modified on disk. */
  corrected: boolean;
}

/**
 * Detects the text orientation of an image using Tesseract OSD (PSM 0) and,
 * if a non-zero rotation is detected above the confidence threshold, rotates
 * the image in-place to make the text upright.
 *
 * This handles the case where PDF pages are physically scanned or generated
 * sideways on an upright canvas — the PDF rotation metadata flag is 0, so
 * the page appears portrait-shaped, but the text content is rotated inside it.
 * Standard aspect-ratio checks cannot detect this; only pixel-level analysis can.
 *
 * @param imagePath - Absolute path to the image file (JPEG or PNG).
 * @param confidenceThreshold - Minimum OSD confidence (0–100) required to apply
 *   a rotation. Pages with mostly diagrams/images and little text return low-
 *   confidence OSD results; the threshold prevents them from being incorrectly
 *   rotated. Default: 40.
 * @returns Metadata about what correction, if any, was applied.
 */
export async function detectAndCorrectOrientation(imagePath: string, confidenceThreshold = 40): Promise<OrientationCorrectionResult> {
  // Run Tesseract in OSD-only mode (PSM 0) — analyses text pixels to find the
  // dominant text angle. This is much faster than a full OCR pass.
  // We use the low-level createWorker API so we can pass the PSM config
  // cleanly without hitting the 3-arg limit of the recognize() shorthand.

  const psmOsd = (Tesseract.PSM as any).OSD_ONLY;
  const worker = await Tesseract.createWorker('eng', undefined, { logger: () => {} }, {
    tessedit_pageseg_mode: psmOsd,
  } as Parameters<typeof Tesseract.createWorker>[3]);
  let data: Tesseract.RecognizeResult['data'];
  try {
    ({ data } = await worker.recognize(imagePath));
  } finally {
    await worker.terminate();
  }

  // tesseract.js exposes these on the raw data object

  const raw = data as any;
  const degree: number = raw.orientation_degrees ?? 0;
  const confidence: number = raw.orientation_confidence ?? 0;

  const noCorrection: OrientationCorrectionResult = { rotationApplied: 0, confidence, corrected: false };

  // Skip if Tesseract isn't confident enough (e.g. mostly diagrams, sparse text)
  if (confidence < confidenceThreshold) {
    console.log(`[AutoOrient] ${path.basename(imagePath)} — OSD confidence ${confidence.toFixed(1)} < ${confidenceThreshold}, skipping rotation.`);
    return noCorrection;
  }

  // No rotation needed
  if (degree === 0) {
    return noCorrection;
  }

  const rotation = degree as 0 | 90 | 180 | 270;

  console.log(`[AutoOrient] ${path.basename(imagePath)} — detected rotation: ${rotation}°, confidence: ${confidence.toFixed(1)}. Correcting in-place...`);

  // Rotate and overwrite the original file
  const rotated = await sharp(imagePath).rotate(rotation).toBuffer();
  fs.writeFileSync(imagePath, rotated);

  console.log(`[AutoOrient] ${path.basename(imagePath)} — corrected ✓`);

  return { rotationApplied: rotation, confidence, corrected: true };
}
