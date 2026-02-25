import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import type { FileStorage } from "./index";

export class LocalFileStorage implements FileStorage {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || path.join(process.cwd(), "data", "uploads");
  }

  async upload(file: Buffer, key: string, _contentType: string): Promise<string> {
    const filePath = path.join(this.basePath, key);
    const dir = path.dirname(filePath);
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, file);
    return `/api/files/${key}`;
  }

  async delete(key: string): Promise<void> {
    // key may be a URL path like /api/files/... or legacy /uploads/... or just the key
    let normalizedKey = key;
    if (normalizedKey.startsWith("/api/files/")) {
      normalizedKey = normalizedKey.slice("/api/files/".length);
    } else if (normalizedKey.startsWith("/uploads/")) {
      normalizedKey = normalizedKey.slice("/uploads/".length);
    }
    const filePath = path.join(this.basePath, normalizedKey);
    try {
      await unlink(filePath);
    } catch {
      // Swallow errors if file is already missing
    }
  }

  async getSignedUrl(key: string): Promise<string> {
    // Local storage uses authenticated serving via /api/files/
    let normalizedKey = key;
    if (normalizedKey.startsWith("/api/files/")) return normalizedKey;
    if (normalizedKey.startsWith("/uploads/")) {
      normalizedKey = normalizedKey.slice("/uploads/".length);
    }
    return `/api/files/${normalizedKey}`;
  }
}
