import { env } from "@/lib/env";
import type { FileStorage } from "./index";

let instance: FileStorage | null = null;

export function getStorage(): FileStorage {
  if (instance) return instance;

  if (env.STORAGE_PROVIDER === "s3") {
    // Dynamic import to avoid loading S3 SDK when not needed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3FileStorage } = require("./s3");
    instance = new S3FileStorage();
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LocalFileStorage } = require("./local");
    instance = new LocalFileStorage();
  }

  return instance!;
}
