export interface FileStorage {
  upload(file: Buffer, key: string, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}
