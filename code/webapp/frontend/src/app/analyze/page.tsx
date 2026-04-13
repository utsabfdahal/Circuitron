"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ImageUploader } from "@/components/analysis/image-uploader";
import { AnalysisResultsEditor } from "@/components/analysis/analysis-results-editor";
import {
  uploadAndAnalyze,
  type AnalysisResult,
} from "@/services/analysis-api";
import {
  analysisToCircuit,
} from "@/services/analysis-converter";
import { ThemeProvider } from "@/context/theme-context";
import { CircuitProvider } from "@/context/circuit-context";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Zap, Pencil } from "lucide-react";
import Link from "next/link";

type Stage =
  | "idle"
  | "uploading"
  | "detecting"
  | "ocr"
  | "mapping"
  | "lines"
  | "done"
  | "error";

function AnalyzeInner() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    try {
      setError("");
      setResult(null);

      // Show uploaded image preview
      const objectUrl = URL.createObjectURL(file);
      setUploadedImageUrl(objectUrl);

      setStage("uploading");
      setProgress("Uploading image...");

      await new Promise((r) => setTimeout(r, 300));
      setStage("detecting");
      setProgress("Running YOLOv7 component detection...");

      const response = await uploadAndAnalyze(file);

      setStage("done");
      setProgress("Analysis complete!");
      setResult(response.data);
    } catch (err) {
      setStage("error");
      setError(err instanceof Error ? err.message : "Unknown error");
      setProgress("");
    }
  }, []);

  /**
   * Serialize the converted circuit + overlay data into sessionStorage,
   * then navigate to the main editor which picks it up on mount.
   */
  const handleOpenInEditor = useCallback(() => {
    if (!result) return;

    const { circuit, connections } = analysisToCircuit(result);

    // Store circuit + overlay in sessionStorage so the main page can import it
    const payload = {
      circuit,
      overlay: {
        images: result.images,
        originalImageUrl: null as string | null,  // blob URLs don't survive across pages
        imageSize: result.image_size,
        connections,
      },
    };
    sessionStorage.setItem("__circuitron_analysis_import", JSON.stringify(payload));

    router.push("/");
  }, [result, router]);

  const handleReset = useCallback(() => {
    setStage("idle");
    setProgress("");
    setError("");
    setResult(null);
    if (uploadedImageUrl) {
      URL.revokeObjectURL(uploadedImageUrl);
      setUploadedImageUrl(null);
    }
  }, [uploadedImageUrl]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background border-b border-border h-14 flex items-center justify-between px-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold text-foreground">
              Circuit Analyzer
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stage === "done" && (
            <>
              <Button variant="default" size="sm" onClick={handleOpenInEditor}>
                <Pencil className="h-4 w-4 mr-1.5" />
                Open in Editor
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                Analyze Another
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto p-4">
        {stage !== "done" && (
          <div className="mb-6">
            <ImageUploader
              onUpload={handleUpload}
              isProcessing={!["idle", "error", "done"].includes(stage)}
              progress={progress}
            />
            {error && (
              <div className="mt-4 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                <strong>Error:</strong> {error}
              </div>
            )}
          </div>
        )}

        {stage === "done" && result && (
          <>
            <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-sm flex items-center gap-2">
              <Pencil className="h-4 w-4 flex-shrink-0" />
              <span>
                Click <strong>&quot;Open in Editor&quot;</strong> above to load
                these detections into the main circuit canvas where you can
                drag, edit, wire, and simulate them.
              </span>
            </div>
            <AnalysisResultsEditor
              result={result}
              originalImageUrl={uploadedImageUrl}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <CircuitProvider>
          <AnalyzeInner />
        </CircuitProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
