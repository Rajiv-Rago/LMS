import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import type { FileStorage } from "./index";

export class LocalFileStorage implements FileStorage {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || path.join(process.cwd(), "public", "uploads");
  }

  async upload(file: Buffer, key: string, _contentType: string): Promise<string> {
    const filePath = path.join(this.basePath, key);
    const dir = path.dirname(filePath);
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, file);
    return `/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    // key may be a URL path like /uploads/... or just the key
    const normalizedKey = key.startsWith("/uploads/") ? key.slice("/uploads/".length) : key;
    const filePath = path.join(this.basePath, normalizedKey);
    try {
      await unlink(filePath);
    } catch {
      // Swallow errors if file is already missing
    }
  }

  async getSignedUrl(key: string): Promise<string> {
    // Local storage doesn't need signing — just return the public URL
    const normalizedKey = key.startsWith("/uploads/") ? key : `/uploads/${key}`;
    return normalizedKey;
  }
}
