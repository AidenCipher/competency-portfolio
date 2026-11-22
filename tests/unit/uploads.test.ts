import { describe, expect, it } from "vitest";
import { checkUpload, detectType, isOwnEvidencePath, MAX_BYTES, precheckUpload, sanitizeFilename, storagePath } from "@/lib/uploads";

const enc = (s: string) => new TextEncoder().encode(s);
const bytes = (...parts: (number[] | string)[]) =>
  Uint8Array.from(parts.flatMap((p) => (typeof p === "string" ? Array.from(enc(p)) : p)));

const PDF = bytes("%PDF-1.7\n", "x".repeat(50));
const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "x".repeat(20));
const JPG = bytes([0xff, 0xd8, 0xff, 0xe0], "x".repeat(20));
const DOCX = bytes([0x50, 0x4b, 0x03, 0x04], "[Content_Types].xml", "word/document.xml");
const PPTX = bytes([0x50, 0x4b, 0x03, 0x04], "[Content_Types].xml", "ppt/slides/slide1.xml");
const EXE = bytes([0x4d, 0x5a, 0x90, 0x00], "x".repeat(50)); // "MZ"
const PLAIN_ZIP = bytes([0x50, 0x4b, 0x03, 0x04], "hello.txt");

describe("detectType", () => {
  it("recognises allowed types by content", () => {
    expect(detectType(PDF)).toBe("pdf");
    expect(detectType(PNG)).toBe("png");
    expect(detectType(JPG)).toBe("jpg");
    expect(detectType(DOCX)).toBe("docx");
    expect(detectType(PPTX)).toBe("pptx");
  });
  it("rejects executables and generic zips", () => {
    expect(detectType(EXE)).toBeNull();
    expect(detectType(PLAIN_ZIP)).toBeNull();
    expect(detectType(bytes("<html><script>alert(1)</script>"))).toBeNull();
  });
});

describe("checkUpload", () => {
  it("accepts a real PDF", () => {
    const r = checkUpload({ name: "Report.pdf", declaredMime: "application/pdf", bytes: PDF });
    expect(r).toMatchObject({ ok: true, type: "pdf", mime: "application/pdf", safeName: "Report.pdf" });
  });
  it("accepts every allowed type, jpeg alias, and generic declared mime", () => {
    expect(checkUpload({ name: "a.docx", bytes: DOCX })).toMatchObject({ ok: true, type: "docx" });
    expect(checkUpload({ name: "a.pptx", declaredMime: "application/octet-stream", bytes: PPTX })).toMatchObject({ ok: true, type: "pptx" });
    expect(checkUpload({ name: "a.png", bytes: PNG })).toMatchObject({ ok: true, type: "png" });
    expect(checkUpload({ name: "a.jpeg", bytes: JPG })).toMatchObject({ ok: true, type: "jpg" });
  });
  it("rejects an .exe by extension", () => {
    expect(checkUpload({ name: "setup.exe", bytes: EXE })).toEqual({ ok: false, reason: "bad_type" });
  });
  it("rejects an .exe renamed to .pdf (magic bytes)", () => {
    expect(checkUpload({ name: "report.pdf", declaredMime: "application/pdf", bytes: EXE })).toEqual({ ok: false, reason: "bad_content" });
  });
  it("rejects a type/extension mismatch", () => {
    expect(checkUpload({ name: "x.png", bytes: PDF })).toEqual({ ok: false, reason: "bad_content" });
    expect(checkUpload({ name: "x.docx", bytes: PPTX })).toEqual({ ok: false, reason: "bad_content" });
  });
  it("rejects a plain zip renamed to .docx", () => {
    expect(checkUpload({ name: "x.docx", bytes: PLAIN_ZIP })).toEqual({ ok: false, reason: "bad_content" });
  });
  it("rejects a contradicting declared MIME", () => {
    expect(checkUpload({ name: "x.pdf", declaredMime: "image/png", bytes: PDF })).toEqual({ ok: false, reason: "bad_mime" });
  });
  it("rejects an 11 MB file, accepts exactly 10 MB, rejects empty", () => {
    const big = new Uint8Array(11 * 1024 * 1024);
    big.set(PDF);
    expect(checkUpload({ name: "big.pdf", bytes: big })).toEqual({ ok: false, reason: "too_large" });
    const edge = new Uint8Array(MAX_BYTES);
    edge.set(PDF);
    expect(checkUpload({ name: "edge.pdf", bytes: edge })).toMatchObject({ ok: true });
    expect(checkUpload({ name: "e.pdf", bytes: new Uint8Array(0) })).toEqual({ ok: false, reason: "empty" });
  });
  it("rejects a double extension that hides the real one", () => {
    expect(checkUpload({ name: "report.pdf.exe", bytes: PDF })).toEqual({ ok: false, reason: "bad_type" });
  });
  it("rejects a missing name", () => {
    expect(checkUpload({ name: "  ", bytes: PDF })).toEqual({ ok: false, reason: "bad_name" });
  });
});

describe("sanitizeFilename", () => {
  it.each([
    ["../../etc/passwd", "passwd"],
    ["C:\\evil\\a.pdf", "a.pdf"],
    ["my report (final).pdf", "my report _final_.pdf"],
    ["a\u0000b\nc.pdf", "abc.pdf"],
    ["<script>.pdf", "_script_.pdf"],
    ["...hidden.pdf", "hidden.pdf"],
    ["", "file"],
  ])("%j -> %j", (input, out) => {
    expect(sanitizeFilename(input)).toBe(out);
  });
  it("limits length and keeps the extension", () => {
    const out = sanitizeFilename("a".repeat(300) + ".pdf");
    expect(out.length).toBeLessThanOrEqual(100);
    expect(out.endsWith(".pdf")).toBe(true);
  });
});

describe("storagePath", () => {
  it("has no user-controlled segments", () => {
    expect(storagePath("u", "e", "o", "pdf")).toBe("u/e/o.pdf");
  });
});

describe("precheckUpload", () => {
  it("accepts allowed names within the size limit and reports the claimed type", () => {
    expect(precheckUpload({ name: "Report (final).PDF", size: 1234 })).toMatchObject({ ok: true, type: "pdf" });
    expect(precheckUpload({ name: "photo.jpeg", size: 10 })).toMatchObject({ ok: true, type: "jpg" });
  });
  it("rejects bad types, empty and oversized files before any URL is minted", () => {
    expect(precheckUpload({ name: "setup.exe", size: 100 })).toEqual({ ok: false, reason: "bad_type" });
    expect(precheckUpload({ name: "x.pdf", size: 0 })).toEqual({ ok: false, reason: "empty" });
    expect(precheckUpload({ name: "x.pdf", size: MAX_BYTES + 1 })).toEqual({ ok: false, reason: "too_large" });
    expect(precheckUpload({ name: "x.pdf", size: Number.NaN })).toEqual({ ok: false, reason: "empty" });
    expect(precheckUpload({ name: "noext", size: 5 })).toEqual({ ok: false, reason: "bad_type" });
  });
});

describe("isOwnEvidencePath", () => {
  const u = "11111111-1111-4111-8111-111111111111";
  const e = "22222222-2222-4222-8222-222222222222";
  const o = "33333333-3333-4333-8333-333333333333";
  it("accepts exactly uid/experience/uuid.ext for this user and experience", () => {
    for (const ext of ["pdf", "pptx", "docx", "png", "jpg"]) expect(isOwnEvidencePath(`${u}/${e}/${o}.${ext}`, u, e)).toBe(true);
  });
  it("rejects another user's folder, another experience, traversal, odd extensions and extra segments", () => {
    const other = "44444444-4444-4444-8444-444444444444";
    expect(isOwnEvidencePath(`${other}/${e}/${o}.pdf`, u, e)).toBe(false);
    expect(isOwnEvidencePath(`${u}/${other}/${o}.pdf`, u, e)).toBe(false);
    expect(isOwnEvidencePath(`${u}/${e}/../${o}.pdf`, u, e)).toBe(false);
    expect(isOwnEvidencePath(`${u}/${e}/${o}.exe`, u, e)).toBe(false);
    expect(isOwnEvidencePath(`${u}/${e}/${o}.pdf/extra`, u, e)).toBe(false);
    expect(isOwnEvidencePath(`${u}/${e}/evil.pdf`, u, e)).toBe(false);
    expect(isOwnEvidencePath(`${u}/${e}/${o}.pdf`, "not-a-uuid", e)).toBe(false);
  });
});
