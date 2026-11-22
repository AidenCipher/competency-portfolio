/**
 * Upload validation. Pure and dependency-free so it can be unit-tested and reused.
 * Authority = extension allow-list + MAGIC BYTES + size. The browser-declared MIME type
 * is only a consistency check; it is never trusted on its own.
 */

export const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_FILES = 3;

export type FileType = "pdf" | "pptx" | "docx" | "png" | "jpg";

export const MIME_BY_TYPE: Readonly<Record<FileType, string>> = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
};

const EXT_ALIAS: Readonly<Record<string, FileType>> = {
  pdf: "pdf",
  pptx: "pptx",
  docx: "docx",
  png: "png",
  jpg: "jpg",
  jpeg: "jpg",
};

export type RejectReason = "empty" | "too_large" | "bad_name" | "bad_type" | "bad_content" | "bad_mime";

export type UploadCheck =
  | { ok: true; type: FileType; mime: string; safeName: string; size: number }
  | { ok: false; reason: RejectReason };

export const REJECT_MESSAGES: Readonly<Record<RejectReason, string>> = {
  empty: "The file is empty.",
  too_large: "Files must be 10 MB or smaller.",
  bad_name: "The file name isn't valid.",
  bad_type: "Only PDF, PPTX, DOCX, PNG and JPG files are accepted.",
  bad_content: "The file's contents don't match its type.",
  bad_mime: "The file's declared type doesn't match its extension.",
};

/** Strip any path, control chars and unsafe characters; keep it short. Never returns "". */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._ -]/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.\s-]+/, "")
    .trim();
  const limited = cleaned.length > 100 ? cleaned.slice(-100) : cleaned;
  return limited || "file";
}

function startsWith(b: Uint8Array, sig: number[]): boolean {
  return b.length >= sig.length && sig.every((v, i) => b[i] === v);
}

function containsAscii(b: Uint8Array, needle: string): boolean {
  const n = new TextEncoder().encode(needle);
  outer: for (let i = 0; i <= b.length - n.length; i++) {
    for (let j = 0; j < n.length; j++) if (b[i + j] !== n[j]) continue outer;
    return true;
  }
  return false;
}

/** Detect the real type from content, or null if it is not one we accept. */
export function detectType(b: Uint8Array): FileType | null {
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04])) {
    // OOXML is a ZIP with [Content_Types].xml plus a word/ or ppt/ part.
    if (!containsAscii(b, "[Content_Types].xml")) return null;
    if (containsAscii(b, "word/")) return "docx";
    if (containsAscii(b, "ppt/")) return "pptx";
  }
  return null;
}

export function checkUpload(input: { name: string; declaredMime?: string; bytes: Uint8Array }): UploadCheck {
  const { bytes } = input;
  if (bytes.length === 0) return { ok: false, reason: "empty" };
  if (bytes.length > MAX_BYTES) return { ok: false, reason: "too_large" };

  const safeName = sanitizeFilename(input.name);
  if (safeName === "file" && !input.name.trim()) return { ok: false, reason: "bad_name" };

  const dot = safeName.lastIndexOf(".");
  const ext = dot >= 0 ? safeName.slice(dot + 1).toLowerCase() : "";
  const claimed = EXT_ALIAS[ext];
  if (!claimed) return { ok: false, reason: "bad_type" };

  const actual = detectType(bytes);
  if (!actual || actual !== claimed) return { ok: false, reason: "bad_content" };

  const mime = (input.declaredMime ?? "").toLowerCase();
  const generic = mime === "" || mime === "application/octet-stream";
  if (!generic && mime !== MIME_BY_TYPE[actual]) return { ok: false, reason: "bad_mime" };

  return { ok: true, type: actual, mime: MIME_BY_TYPE[actual], safeName, size: bytes.length };
}

/** Storage object path: `${user_id}/${experience_id}/${uuid}.${ext}` (no user-controlled segments). */
export function storagePath(userId: string, experienceId: string, objectId: string, type: FileType): string {
  return `${userId}/${experienceId}/${objectId}.${type}`;
}

/** Per-user storage budget (all evidence files together). Bounds what one account can park in the bucket. */
export const USER_STORAGE_BUDGET_BYTES = 100 * 1024 * 1024;

/**
 * Cheap pre-flight check used BEFORE a signed upload URL is minted: the file type claimed by the name, and the
 * size the browser declares. It is not trusted: the real bytes are re-checked with checkUpload() after upload.
 */
export function precheckUpload(input: { name: string; size: number }): { ok: true; type: FileType; safeName: string } | { ok: false; reason: RejectReason } {
  if (!Number.isFinite(input.size) || input.size <= 0) return { ok: false, reason: "empty" };
  if (input.size > MAX_BYTES) return { ok: false, reason: "too_large" };
  const safeName = sanitizeFilename(input.name);
  if (safeName === "file" && !input.name.trim()) return { ok: false, reason: "bad_name" };
  const dot = safeName.lastIndexOf(".");
  const claimed = EXT_ALIAS[dot >= 0 ? safeName.slice(dot + 1).toLowerCase() : ""];
  if (!claimed) return { ok: false, reason: "bad_type" };
  return { ok: true, type: claimed, safeName };
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * A storage path is accepted only if it is exactly `${userId}/${experienceId}/${uuid}.${ext}` for THIS user and
 * experience. Anything else (other users' folders, traversal, odd extensions) is rejected.
 */
export function isOwnEvidencePath(path: string, userId: string, experienceId: string): boolean {
  if (!new RegExp(`^${UUID}$`).test(userId) || !new RegExp(`^${UUID}$`).test(experienceId)) return false;
  return new RegExp(`^${userId}/${experienceId}/${UUID}\\.(pdf|pptx|docx|png|jpg)$`).test(path);
}
