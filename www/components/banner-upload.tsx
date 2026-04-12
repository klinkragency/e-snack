"use client"

import { useRef, useState, useCallback } from "react"
import Image from "next/image"
import { ImagePlus, Loader2, X, Move } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { uploadImage, type UploadCategory } from "@/lib/upload-client"

interface Props {
  value: string
  onChange: (url: string) => void
  position: { x: number; y: number } // 0-100 for object-position
  onPositionChange: (position: { x: number; y: number }) => void
  category: UploadCategory
  aspectRatio?: string
  className?: string
}

export function BannerUpload({
  value,
  onChange,
  position,
  onPositionChange,
  category,
  aspectRatio = "aspect-[2/1]",
  className = "",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showPositioner, setShowPositioner] = useState(false)

  const handleFile = async (file: File) => {
    setUploading(true)
    try {
      const url = await uploadImage(file, category)
      onChange(url)
      // Reset position to center when new image is uploaded
      onPositionChange({ x: 50, y: 50 })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur upload")
    } finally {
      setUploading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ""
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!showPositioner) return
    e.preventDefault()
    setIsDragging(true)
  }, [showPositioner])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
    onPositionChange({ x, y })
  }, [isDragging, onPositionChange])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!showPositioner) return
    setIsDragging(true)
  }, [showPositioner])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || !containerRef.current) return

    const touch = e.touches[0]
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((touch.clientY - rect.top) / rect.height) * 100))
    onPositionChange({ x, y })
  }, [isDragging, onPositionChange])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  return (
    <div className={cn("relative overflow-hidden rounded-xl border bg-muted/30", aspectRatio, className)}>
      {value ? (
        <>
          <div
            ref={containerRef}
            className={cn("absolute inset-0", showPositioner && "cursor-move")}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <Image
              src={value}
              alt="Banner"
              fill
              className="object-cover transition-all"
              style={{ objectPosition: `${position.x}% ${position.y}%` }}
              sizes="600px"
              draggable={false}
            />

            {/* Position indicator when in edit mode */}
            {showPositioner && (
              <div
                className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: `${position.x}%`, top: `${position.y}%` }}
              >
                <div className="w-full h-full rounded-full border-2 border-white bg-black/30 flex items-center justify-center shadow-lg">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              </div>
            )}
          </div>

          {/* Overlay when positioning */}
          {showPositioner && (
            <div className="absolute inset-0 bg-black/20 pointer-events-none">
              <div className="absolute inset-x-0 top-2 text-center">
                <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full">
                  Glissez pour repositionner
                </span>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="absolute right-2 top-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => setShowPositioner(!showPositioner)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                showPositioner ? "bg-white text-black" : "bg-black/50 text-white hover:bg-black/70"
              )}
              title="Repositionner l'image"
            >
              <Move size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                onChange("")
                setShowPositioner(false)
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              title="Supprimer l'image"
            >
              <X size={14} />
            </button>
          </div>

          {/* Position values (shown when editing) */}
          {showPositioner && (
            <div className="absolute left-2 bottom-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
              {Math.round(position.x)}%, {Math.round(position.y)}%
            </div>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {uploading ? (
            <Loader2 size={24} className="animate-spin" />
          ) : (
            <>
              <ImagePlus size={24} />
              <span className="text-xs font-medium">Ajouter une banniere</span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  )
}
