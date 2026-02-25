/**
 * Magic bytes validation — detects binary file types by their header bytes
 * and rejects files whose binary signature contradicts the claimed extension.
 */

interface MagicSignature {
  ext: string;
  bytes: number[];
  offset?: number;
}

const SIGNATURES: MagicSignature[] = [
  { ext: ".pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { ext: ".png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { ext: ".jpg", bytes: [0xff, 0xd8, 0xff] },
  { ext: ".jpeg", bytes: [0xff, 0xd8, 0xff] },
  { ext: ".gif", bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  { ext: ".zip", bytes: [0x50, 0x4b, 0x03, 0x04] },
  { ext: ".bmp", bytes: [0x42, 0x4d] }, // BM
  // WebP: RIFF at 0-3, WEBP at 8-11
  { ext: ".webp", bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
];

// Text file extensions that have no magic bytes — allow when extension matches
const TEXT_EXTENSIONS = new Set([
  ".py", ".txt", ".js", ".ts", ".md", ".html", ".css", ".json", ".csv",
  ".jsx", ".tsx", ".yml", ".yaml", ".xml", ".sql", ".sh", ".bat",
]);

function detectBinaryType(buffer: Buffer): string | null {
  for (const sig of SIGNATURES) {
    const offset = sig.offset ?? 0;
    if (buffer.length < offset + sig.bytes.length) continue;

    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[offset + i] !== sig.bytes[i]) {
        match = false;
        break;
      }
    }
    if (match) return sig.ext;
  }
  return null;
}

/**
 * Validates that a file's content matches its claimed extension.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateFileMagic(
  buffer: Buffer,
  filename: string
): string | null {
  const ext = ("." + (filename.split(".").pop() || "")).toLowerCase();
  const detectedType = detectBinaryType(buffer);

  if (detectedType) {
    // Binary signature detected — it must match the claimed extension
    // .jpg and .jpeg are interchangeable
    const normalizedExt = ext === ".jpeg" ? ".jpg" : ext;
    const normalizedDetected = detectedType === ".jpeg" ? ".jpg" : detectedType;

    if (normalizedExt !== normalizedDetected) {
      return `File content does not match extension ${ext} (detected ${detectedType})`;
    }
    return null;
  }

  // No binary signature — allow text extensions through
  if (TEXT_EXTENSIONS.has(ext)) {
    return null;
  }

  // Known binary extensions with no matching signature are suspicious
  // but we allow unknown extensions through (could be arbitrary data files)
  return null;
}
