import createError from "http-errors";

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export function validateFile(
  buffer: Buffer,
  mimetype: string,
  maxSize: number,
  allowedTypes?: readonly string[],
): FileValidationResult {
  const types = allowedTypes ?? ALLOWED_MIME_TYPES;

  if (buffer.length === 0) {
    return { valid: false, error: "Empty file" };
  }

  if (buffer.length > maxSize) {
    const sizeMB = (maxSize / (1024 * 1024)).toFixed(0);
    return { valid: false, error: `File size exceeds ${sizeMB}MB limit` };
  }

  if (!types.includes(mimetype as typeof types[number])) {
    return { valid: false, error: `File type "${mimetype}" is not allowed` };
  }

  return { valid: true };
}
