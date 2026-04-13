"use client";

import React, { useState, useCallback } from "react";
import {
  type AnalysisResult,
  type AnalysisComponent,
  type TextRegion,
} from "@/services/analysis-api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pencil,
  Check,
  X,
  Trash2,
  Download,
  ZoomIn,
  ZoomOut,
  Eye,
  Network,
  Type,
  Cpu,
  Cable,
} from "lucide-react";
import { cn } from "@/utils";
import { DigitalCircuitView } from "./digital-circuit-view";

interface Props {
  result: AnalysisResult;
  originalImageUrl: string | null;
}

// ── Editable Component Row ──────────────────────────────────────────────────

function ComponentRow({
  comp,
  onUpdate,
  onDelete,
}: {
  comp: AnalysisComponent;
  onUpdate: (id: string, updates: Partial<AnalysisComponent>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editId, setEditId] = useState(comp.id);
  const [editType, setEditType] = useState(comp.name);
  const [editValue, setEditValue] = useState(comp.value);

  const save = () => {
    onUpdate(comp.id, { id: editId, name: editType, value: editValue });
    setEditing(false);
  };
  const cancel = () => {
    setEditId(comp.id);
    setEditType(comp.name);
    setEditValue(comp.value);
    setEditing(false);
  };

  return (
    <tr className="border-b border-border hover:bg-muted/50 transition-colors">
      <td className="p-2 text-sm font-mono">
        {editing ? (
          <Input
            value={editId}
            onChange={(e) => setEditId(e.target.value)}
            className="h-7 text-xs w-20"
          />
        ) : (
          comp.id
        )}
      </td>
      <td className="p-2 text-sm">
        {editing ? (
          <Input
            value={editType}
            onChange={(e) => setEditType(e.target.value)}
            className="h-7 text-xs w-40"
          />
        ) : (
          <Badge variant="secondary" className="text-xs">
            {comp.name}
          </Badge>
        )}
      </td>
      <td className="p-2 text-sm font-mono">
        {editing ? (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-7 text-xs w-28"
            placeholder="e.g. 10k"
          />
        ) : (
          comp.value || (
            <span className="text-muted-foreground italic">—</span>
          )
        )}
      </td>
      <td className="p-2 text-sm text-muted-foreground">
        {(comp.confidence * 100).toFixed(1)}%
      </td>
      <td className="p-2 text-sm text-muted-foreground font-mono text-xs">
        [{comp.bbox.join(", ")}]
      </td>
      <td className="p-2">
        <div className="flex gap-1">
          {editing ? (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={save}>
                <Check className="h-3.5 w-3.5 text-green-600" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancel}>
                <X className="h-3.5 w-3.5 text-red-500" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onDelete(comp.id)}
              >
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Editable Text Region Row ────────────────────────────────────────────────

function TextRegionRow({
  tr,
  onUpdate,
}: {
  tr: TextRegion;
  onUpdate: (id: number, updates: Partial<TextRegion>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(tr.ocr_text);

  const save = () => {
    onUpdate(tr.id, { ocr_text: editText });
    setEditing(false);
  };

  return (
    <tr className="border-b border-border hover:bg-muted/50 transition-colors">
      <td className="p-2 text-sm text-muted-foreground">{tr.id}</td>
      <td className="p-2 text-sm font-mono">
        {editing ? (
          <div className="flex gap-1">
            <Input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="h-7 text-xs flex-1"
            />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={save}>
              <Check className="h-3.5 w-3.5 text-green-600" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setEditText(tr.ocr_text);
                setEditing(false);
              }}
            >
              <X className="h-3.5 w-3.5 text-red-500" />
            </Button>
          </div>
        ) : (
          <span
            className="cursor-pointer hover:underline"
            onClick={() => setEditing(true)}
          >
            {tr.ocr_text || (
              <span className="text-muted-foreground italic">empty</span>
            )}
          </span>
        )}
      </td>
      <td className="p-2 text-sm text-muted-foreground">
        {(tr.ocr_confidence * 100).toFixed(1)}%
      </td>
      <td className="p-2 text-sm text-muted-foreground font-mono text-xs">
        [{tr.bbox.join(", ")}]
      </td>
    </tr>
  );
}

// ── Zoomable Image ──────────────────────────────────────────────────────────

function ZoomableImage({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [zoom, setZoom] = useState(1);

  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          onClick={() => setZoom(1)}
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="overflow-auto max-h-[600px] border border-border rounded-lg bg-muted/30">
        <img
          src={src}
          alt={alt}
          className="transition-transform origin-top-left"
          style={{ transform: `scale(${zoom})` }}
        />
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function AnalysisResultsEditor({ result, originalImageUrl }: Props) {
  const [components, setComponents] = useState<AnalysisComponent[]>(
    result.components
  );
  const [textRegions, setTextRegions] = useState<TextRegion[]>(
    result.text_regions
  );
  const [graph] = useState(result.graph);

  const updateComponent = useCallback(
    (id: string, updates: Partial<AnalysisComponent>) => {
      setComponents((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      );
    },
    []
  );

  const deleteComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const updateTextRegion = useCallback(
    (id: number, updates: Partial<TextRegion>) => {
      setTextRegions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
    },
    []
  );

  const handleExportJSON = useCallback(() => {
    const payload = {
      image_size: result.image_size,
      components,
      text_regions: textRegions,
      junctions: result.junctions,
      graph,
      line_detection: result.line_detection,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "circuit-analysis.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [components, textRegions, result, graph]);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
        <Badge variant="outline" className="gap-1">
          <Cpu className="h-3 w-3" /> {components.length} components
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Type className="h-3 w-3" /> {textRegions.length} text regions
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Network className="h-3 w-3" /> {graph.nodes?.length ?? 0} nodes,{" "}
          {graph.edges?.length ?? 0} edges
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Cable className="h-3 w-3" /> {graph.num_components ?? 0} connected
          components
        </Badge>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={handleExportJSON}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="digital" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="digital">Digital View</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="text">OCR Text</TabsTrigger>
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="images">Visual Output</TabsTrigger>
          <TabsTrigger value="raw">Raw JSON</TabsTrigger>
        </TabsList>

        {/* ── Digital Circuit View Tab ────────────────────────────── */}
        <TabsContent value="digital">
          <DigitalCircuitView
            result={result}
            originalImageUrl={originalImageUrl}
          />
        </TabsContent>

        {/* ── Components Tab ─────────────────────────────────────────── */}
        <TabsContent value="components">
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/60 text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="p-2 text-left font-medium">ID</th>
                    <th className="p-2 text-left font-medium">Type</th>
                    <th className="p-2 text-left font-medium">Value</th>
                    <th className="p-2 text-left font-medium">Conf.</th>
                    <th className="p-2 text-left font-medium">BBox</th>
                    <th className="p-2 text-left font-medium w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {components.map((c) => (
                    <ComponentRow
                      key={c.id}
                      comp={c}
                      onUpdate={updateComponent}
                      onDelete={deleteComponent}
                    />
                  ))}
                  {components.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-8 text-center text-muted-foreground text-sm"
                      >
                        No components detected
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ── OCR Text Tab ───────────────────────────────────────────── */}
        <TabsContent value="text">
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/60 text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="p-2 text-left font-medium w-16">#</th>
                    <th className="p-2 text-left font-medium">
                      OCR Text (click to edit)
                    </th>
                    <th className="p-2 text-left font-medium">Conf.</th>
                    <th className="p-2 text-left font-medium">BBox</th>
                  </tr>
                </thead>
                <tbody>
                  {textRegions.map((t) => (
                    <TextRegionRow
                      key={t.id}
                      tr={t}
                      onUpdate={updateTextRegion}
                    />
                  ))}
                  {textRegions.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-8 text-center text-muted-foreground text-sm"
                      >
                        No text regions detected
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ── Graph Tab ──────────────────────────────────────────────── */}
        <TabsContent value="graph">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Adjacency graph image */}
            <div className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-medium mb-3">Adjacency Graph</h3>
              {result.images.adjacency_graph_png ? (
                <ZoomableImage
                  src={result.images.adjacency_graph_png}
                  alt="Adjacency graph"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No graph generated
                </p>
              )}
            </div>

            {/* Node / edge tables */}
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-medium mb-2">
                  Nodes ({graph.nodes?.length ?? 0})
                </h3>
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="p-1 text-left">ID</th>
                        <th className="p-1 text-left">X</th>
                        <th className="p-1 text-left">Y</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(graph.nodes ?? []).map((n) => (
                        <tr
                          key={n.id}
                          className="border-t border-border/50"
                        >
                          <td className="p-1 font-mono">{n.id}</td>
                          <td className="p-1">{n.x}</td>
                          <td className="p-1">{n.y}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-medium mb-2">
                  Edges ({graph.edges?.length ?? 0})
                </h3>
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="p-1 text-left">Source</th>
                        <th className="p-1 text-left">Target</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(graph.edges ?? []).map((e, i) => (
                        <tr
                          key={i}
                          className="border-t border-border/50"
                        >
                          <td className="p-1 font-mono">{e.source}</td>
                          <td className="p-1 font-mono">{e.target}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Visual Output Tab ──────────────────────────────────────── */}
        <TabsContent value="images">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {originalImageUrl && (
              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-medium mb-3">Original Image</h3>
                <ZoomableImage src={originalImageUrl} alt="Original" />
              </div>
            )}
            {result.images.bbox_png && (
              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-medium mb-3">
                  YOLO Detections on Skeleton
                </h3>
                <ZoomableImage
                  src={result.images.bbox_png}
                  alt="Detections"
                />
              </div>
            )}
            {result.images.skeleton_png && (
              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-medium mb-3">Skeleton</h3>
                <ZoomableImage
                  src={result.images.skeleton_png}
                  alt="Skeleton"
                />
              </div>
            )}
            {result.images.overlay_png && (
              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-medium mb-3">
                  Overlay (Endpoints + Skeleton)
                </h3>
                <ZoomableImage
                  src={result.images.overlay_png}
                  alt="Overlay"
                />
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Raw JSON Tab ───────────────────────────────────────────── */}
        <TabsContent value="raw">
          <div className="rounded-lg border border-border p-4 bg-muted/30 max-h-[600px] overflow-auto">
            <pre className="text-xs font-mono whitespace-pre-wrap break-words">
              {JSON.stringify(
                {
                  image_size: result.image_size,
                  components,
                  text_regions: textRegions,
                  junctions: result.junctions,
                  graph,
                  line_detection: result.line_detection,
                },
                null,
                2
              )}
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
