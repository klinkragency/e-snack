import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock fetch before importing the module
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

// Dynamic import to ensure fetch mock is ready
const { uploadImage } = await import("@/lib/upload-client")

describe("uploadImage", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("rejects invalid file types", async () => {
    const file = new File(["data"], "test.gif", { type: "image/gif" })
    await expect(uploadImage(file, "product")).rejects.toThrow("Format accepté")
  })

  it("rejects files over 5MB", async () => {
    const data = new ArrayBuffer(6 * 1024 * 1024)
    const file = new File([data], "large.jpg", { type: "image/jpeg" })
    await expect(uploadImage(file, "product")).rejects.toThrow("Taille max")
  })

  it("returns public URL on success", async () => {
    const file = new File(["img"], "test.jpg", { type: "image/jpeg" })

    // 1. Presign response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        uploadUrl: "https://storage.example.com/upload",
        fileKey: "product-123.jpg",
        publicUrl: "https://cdn.example.com/product-123.jpg",
        expiresIn: 900,
      }),
    })
    // 2. Upload PUT
    mockFetch.mockResolvedValueOnce({ ok: true })
    // 3. Confirm
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ exists: true }),
    })

    const url = await uploadImage(file, "product")
    expect(url).toBe("https://cdn.example.com/product-123.jpg")
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it("throws on presign failure", async () => {
    const file = new File(["img"], "test.jpg", { type: "image/jpeg" })
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ message: "Non autorisé" }),
    })

    await expect(uploadImage(file, "product")).rejects.toThrow("Non autorisé")
  })

  it("throws on upload failure", async () => {
    const file = new File(["img"], "test.jpg", { type: "image/jpeg" })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        uploadUrl: "https://s3.example.com/upload",
        fileKey: "k",
        publicUrl: "https://cdn.example.com/k",
        expiresIn: 900,
      }),
    })
    mockFetch.mockResolvedValueOnce({ ok: false })

    await expect(uploadImage(file, "product")).rejects.toThrow("Échec")
  })
})
