"use client";

import { useState, useRef, useCallback } from "react";

interface FileUploaderProps {
  courseId: string;
  assignmentId: string;
  maxFiles: number;
  maxFileSize: number;
  allowedFileTypes?: string[];
  currentFileCount: number;
  onUploadComplete: () => void;
  disabled?: boolean;
}

export default function FileUploader({
  courseId,
  assignmentId,
  maxFiles,
  maxFileSize,
  allowedFileTypes,
  currentFileCount,
  onUploadComplete,
  disabled = false,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remainingSlots = maxFiles - currentFileCount;
  const maxFileSizeMB = Math.round(maxFileSize / (1024 * 1024));

  const validateFiles = useCallback(
    (files: File[]): string | null => {
      if (files.length > remainingSlots) {
        return `You can only upload ${remainingSlots} more file(s)`;
      }

      for (const file of files) {
        if (file.size > maxFileSize) {
          return `File "${file.name}" is too large. Maximum size is ${maxFileSizeMB}MB`;
        }

        if (allowedFileTypes && allowedFileTypes.length > 0) {
          const ext = "." + file.name.split(".").pop()?.toLowerCase();
          if (!allowedFileTypes.includes(ext)) {
            return `File type "${ext}" is not allowed. Allowed types: ${allowedFileTypes.join(", ")}`;
          }
        }
      }

      return null;
    },
    [remainingSlots, maxFileSize, maxFileSizeMB, allowedFileTypes]
  );

  const uploadFiles = async (files: File[]) => {
    const validationError = validateFiles(files);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const xhr = new XMLHttpRequest();

      // Track progress
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setProgress(percentComplete);
        }
      });

      // Handle completion
      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            try {
              const response = JSON.parse(xhr.responseText);
              reject(new Error(response.error || "Upload failed"));
            } catch {
              reject(new Error("Upload failed"));
            }
          }
        };
        xhr.onerror = () => reject(new Error("Network error"));

        xhr.open("POST", `/api/courses/${courseId}/assignments/${assignmentId}/files`);
        xhr.send(formData);
      });

      onUploadComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !uploading) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || uploading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      uploadFiles(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      uploadFiles(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isDisabled = disabled || uploading || remainingSlots <= 0;

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !isDisabled && fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
          ${isDragging
            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
            : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          disabled={isDisabled}
          accept={allowedFileTypes?.join(",")}
          className="hidden"
        />

        {uploading ? (
          <div className="space-y-3">
            <div className="w-12 h-12 mx-auto">
              <svg
                className="animate-spin text-indigo-600"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Uploading... {progress}%
            </p>
            <div className="w-48 mx-auto h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <svg
              className="w-12 h-12 mx-auto text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="mt-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {isDragging ? "Drop files here" : "Drag and drop files here"}
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              or click to browse
            </p>
          </>
        )}
      </div>

      {/* File constraints info */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
        <p>
          {remainingSlots > 0
            ? `You can upload ${remainingSlots} more file(s) (max ${maxFiles} total)`
            : "Maximum file limit reached"}
        </p>
        <p>Maximum file size: {maxFileSizeMB}MB</p>
        {allowedFileTypes && allowedFileTypes.length > 0 && (
          <p>Allowed types: {allowedFileTypes.join(", ")}</p>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
