/**
 * API client for the unified circuit analysis pipeline.
 * POST /api/v1/analyze/upload
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface AnalysisComponent {
  id: string;
  cls: number;
  type: string;
  name: string;
  confidence: number;
  bbox: [number, number, number, number];
  position: [number, number];
  value: string;
  value_confidence: number;
  mapped_text_bbox: [number, number, number, number] | null;
}

export interface TextRegion {
  id: number;
  bbox: [number, number, number, number];
  ocr_text: string;
  ocr_confidence: number;
}

export interface Junction {
  id: number;
  type: string;
  bbox: [number, number, number, number];
  confidence: number;
  position: [number, number];
}

export interface GraphNode {
  id: number;
  x: number;
  y: number;
}

export interface GraphEdge {
  source: number;
  target: number;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  num_components: number;
}

export interface AnalysisImages {
  skeleton_png: string | null;
  overlay_png: string | null;
  bbox_png: string | null;
  adjacency_graph_png: string | null;
}

export interface LineDetection {
  detections: Array<{
    cls: number;
    name: string;
    conf: number | null;
    bbox: number[];
  }>;
  results: Array<{
    cls: number;
    name: string;
    conf: number | null;
    bbox: number[];
    method: string;
    endpoint?: number[] | null;
    endpoints?: number[][];
  }>;
}

export interface AnalysisResult {
  image_size: { width: number; height: number };
  components: AnalysisComponent[];
  text_regions: TextRegion[];
  junctions: Junction[];
  graph: Graph;
  line_detection: LineDetection;
  images: AnalysisImages;
}

export interface AnalysisResponse {
  status: string;
  filename: string;
  data: AnalysisResult;
}

export async function uploadAndAnalyze(
  file: File,
  proximityMaxDist: number = 250
): Promise<AnalysisResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("proximity_max_dist", String(proximityMaxDist));

  const res = await fetch(`${API_BASE}/api/v1/analyze/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errBody.detail || `HTTP ${res.status}`);
  }

  return res.json();
}
