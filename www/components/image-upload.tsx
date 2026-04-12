"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { ImagePlus, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { uploadImage, type UploadCategory } from "@/lib/upload-client"

interface Props {
  value: string
  onChange: (url: string) => void
  category: UploadCategory
  aspectRatio?: string // e.g. "aspect-square", "aspect-[2/1]"
  className?: string
}

export function ImageUpload({ value, onChange, category, aspectRatio = "aspect-square", className = "" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (file: File) => {
    setUploading(true)
    try {
      const url = await uploadImage(file, category)
      onChange(url)
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

  return (
    <div className={cn("relative overflow-hidden rounded-xl border bg-muted/30", aspectRatio, className)}>
      {value ? (
        <>
          <Image src={value} alt="Upload" fill className="object-cover" sizes="300px" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X size={14} />
          </button>
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
              <span className="text-xs font-medium">Ajouter une image</span>
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
