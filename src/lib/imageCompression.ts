const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;
const QUALITY = 0.7;
const MAX_FILE_SIZE_MB = 10;

export interface CompressedFile {
  file: File;
  preview: string;
  originalSize: number;
  compressedSize: number;
}

/**
 * Compress an image file using Canvas API.
 * Reduces resolution to max 1920x1920 and compresses to JPEG at 70% quality.
 * Non-image files are returned as-is.
 */
export async function compressImage(file: File): Promise<CompressedFile> {
  const originalSize = file.size;

  // Skip compression for non-image files
  if (!file.type.startsWith("image/")) {
    return {
      file,
      preview: "",
      originalSize,
      compressedSize: file.size,
    };
  }

  // Skip compression for GIFs (would lose animation)
  if (file.type === "image/gif") {
    const preview = await readFileAsDataURL(file);
    return { file, preview, originalSize, compressedSize: file.size };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Calculate new dimensions maintaining aspect ratio
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Compression failed"));
            return;
          }

          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, ".jpg"),
            { type: "image/jpeg" }
          );

          const preview = canvas.toDataURL("image/jpeg", 0.3);

          resolve({
            file: compressedFile,
            preview,
            originalSize,
            compressedSize: compressedFile.size,
          });
        },
        "image/jpeg",
        QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Format bytes to human-readable string */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Check if file is within max allowed size */
export function isFileTooLarge(file: File): boolean {
  return file.size > MAX_FILE_SIZE_MB * 1024 * 1024;
}

/** Check if file is an image */
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

/** Get file extension from filename */
export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}
