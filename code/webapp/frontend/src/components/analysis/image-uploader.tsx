"use client";

import React, { useCallback, useRef, useState } from "react";
import { Upload, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils";

interface ImageUploaderProps {
  onUpload: (file: File) => void;
  isProcessing: boolean;
  progress: string;
}

export function ImageUploader({
  onUpload,
  isProcessing,
  progress,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      setPreview(url);
      onUpload(file);
    },
    [onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Drop zone */}
      <div
        className={cn(
          "relative w-full max-w-2xl mx-auto border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer",
          "flex flex-col items-center justify-center gap-4 min-h-[280px]",
          dragActive
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-muted-foreground/50",
          isProcessing && "pointer-events-none opacity-70"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isProcessing && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/bmp,image/webp"
          className="hidden"
          onChange={handleInputChange}
          disabled={isProcessing}
        />

        {preview && !isProcessing ? (
          <img
            src={preview}
            alt="Preview"
            className="max-h-48 rounded-lg object-contain"
          />
        ) : isProcessing ? (
          <>
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground animate-pulse">
              {progress}
            </p>
          </>
        ) : (
          <>
            <div className="rounded-full bg-muted p-4">
              <ImageIcon className="h-10 w-10 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-base font-medium text-foreground">
                Drop a circuit image here or click to browse
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                PNG, JPG, BMP, WebP supported
              </p>
            </div>
            <Button variant="outline" size="sm" className="mt-2">
              <Upload className="h-4 w-4 mr-2" />
              Choose File
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
