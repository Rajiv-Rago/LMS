/**
 * Detect file type from magic bytes (file signature).
 * Returns the canonical extension (e.g. ".pdf") or null if unrecognized.
 */

interface MagicSignature {
  ext: string;
  mime: string;
  bytes: number[];
  offset?: number;
}

const SIGNATURES: MagicSignature[] = [
  // PDF
  { ext: ".pdf", mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
  // PNG
  { ext: ".png", mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // JPEG
  { ext: ".jpg", mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  // GIF87a / GIF89a
  { ext: ".gif", mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] },
  { ext: ".gif", mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] },
  // ZIP (also covers .docx, .xlsx, .pptx)
  { ext: ".zip", mime: "application/zip", bytes: [0x50, 0x4b, 0x03, 0x04] },
  // WebP
  { ext: ".webp", mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
  // BMP
  { ext: ".bmp", mime: "image/bmp", bytes: [0x42, 0x4d] },
];

// Extensions that are ZIP-based (Office Open XML)
const ZIP_BASED_EXTENSIONS = new Set([".docx", ".xlsx", ".pptx", ".odt", ".ods", ".odp", ".zip"]);

export interface DetectedFileType {
  ext: string;
  mime: string;
}

/**
 * Detect the file type by inspecting the first bytes of the buffer.
 * Returns the detected type or null if the signature is not recognized.
 */
export function detectFileType(buffer: Buffer): DetectedFileType | null {
  if (buffer.length < 2) return null;

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
    if (match) {
      return { ext: sig.ext, mime: sig.mime };
    }
  }

  return null;
}

/**
 * Validate that a file's actual content matches its claimed extension.
 * Returns an error message if mismatched, or null if valid.
 *
 * @param buffer - The file content buffer
 * @param claimedExt - The claimed file extension (e.g. ".pdf")
 * @param allowedTypes - Optional allowlist of permitted extensions
 */
export function validateFileMagic(
  buffer: Buffer,
  claimedExt: string,
  allowedTypes?: string[]
): string | null {
  const detected = detectFileType(buffer);

  // If we can't detect the type and there's an allowlist, reject unknown types
  if (!detected) {
    if (allowedTypes && allowedTypes.length > 0) {
      return `Unable to verify file type for "${claimedExt}". File may be corrupted or of an unsupported type`;
    }
    // No allowlist — let unrecognized files through (e.g. .txt, .csv, .py)
    return null;
  }

  const normalizedClaimed = claimedExt.toLowerCase();

  // Direct match
  if (detected.ext === normalizedClaimed) return null;

  // JPEG can be .jpg or .jpeg
  if (detected.ext === ".jpg" && (normalizedClaimed === ".jpeg" || normalizedClaimed === ".jpg")) {
    return null;
  }

  // ZIP-based formats (Office documents are ZIP archives)
  if (detected.ext === ".zip" && ZIP_BASED_EXTENSIONS.has(normalizedClaimed)) {
    return null;
  }

  return `File content does not match its extension "${claimedExt}". Detected type: ${detected.mime}`;
}
