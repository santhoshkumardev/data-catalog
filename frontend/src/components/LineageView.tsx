import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Loader2, Search, X, ChevronRight, ChevronLeft, ArrowRight } from "lucide-react";
import {
  getTableLineage,
  deleteLineageEdge,
  createLineageEdge,
  searchTablesForLineage,
  expandLineageNode,
  getEdgeAnnotation,
  updateEdgeAnnotation,
  type LineageGraph,
  type LineageNode,
  type LineageTableSearchResult,
  type EdgeAnnotation,
  type EdgeAnnotationUpdate,
} from "../api/catalog";
import { useAuth } from "../auth/AuthContext";

// ─── Graph data model ──────────────────────────────────────────────────────

interface FlatNode {
  key: string;
  db_name: string;
  table_name: string;
  is_catalog_table: boolean;
  table_id?: string;
  has_more_upstream: boolean;
  has_more_downstream: boolean;
}

interface FlatEdge {
  source_key: string;
  target_key: string;
  edge_id?: string;
  has_annotation?: boolean;
}

function nodeKey(db: string, table: string) {
  return `${db}::${table}`;
}

function flattenTree(
  nodes: LineageNode[],
  parentKey: string,
  direction: "upstream" | "downstream",
  outNodes: Map<string, FlatNode>,
  outEdges: FlatEdge[]
) {
  for (const n of nodes) {
    const key = nodeKey(n.db_name, n.table_name);
    if (!outNodes.has(key)) {
      outNodes.set(key, {
        key,
        db_name: n.db_name,
        table_name: n.table_name,
        is_catalog_table: n.is_catalog_table,
        table_id: n.table_id ?? undefined,
        has_more_upstream: n.has_more_upstream,
        has_more_downstream: n.has_more_downstream,
      });
    } else {
      const existing = outNodes.get(key)!;
      existing.has_more_upstream = existing.has_more_upstream || n.has_more_upstream;
      existing.has_more_downstream = existing.has_more_downstream || n.has_more_downstream;
    }
    const edge: FlatEdge =
      direction === "upstream"
        ? { source_key: key, target_key: parentKey, edge_id: n.edge_id ?? undefined, has_annotation: n.has_annotation ?? false }
        : { source_key: parentKey, target_key: key, edge_id: n.edge_id ?? undefined, has_annotation: n.has_annotation ?? false };
    if (!outEdges.some((e) => e.source_key === edge.source_key && e.target_key === edge.target_key)) {
      outEdges.push(edge);
    }
    if (n.children.length > 0) {
      flattenTree(n.children, key, direction, outNodes, outEdges);
    }
  }
}

function assignDepths(
  currentKey: string,
  _nodes: Map<string, FlatNode>,
  edges: FlatEdge[]
): Map<string, number> {
  const depths = new Map<string, number>();
  depths.set(currentKey, 0);

  const upstreamAdj = new Map<string, string[]>();
  const downstreamAdj = new Map<string, string[]>();

  for (const e of edges) {
    if (!downstreamAdj.has(e.source_key)) downstreamAdj.set(e.source_key, []);
    downstreamAdj.get(e.source_key)!.push(e.target_key);
    if (!upstreamAdj.has(e.target_key)) upstreamAdj.set(e.target_key, []);
    upstreamAdj.get(e.target_key)!.push(e.source_key);
  }

  const upQueue: string[] = [currentKey];
  while (upQueue.length > 0) {
    const cur = upQueue.shift()!;
    const curDepth = depths.get(cur)!;
    for (const src of upstreamAdj.get(cur) ?? []) {
      if (!depths.has(src)) {
        depths.set(src, curDepth - 1);
        upQueue.push(src);
      }
    }
  }

  const downQueue: string[] = [currentKey];
  while (downQueue.length > 0) {
    const cur = downQueue.shift()!;
    const curDepth = depths.get(cur)!;
    for (const tgt of downstreamAdj.get(cur) ?? []) {
      if (!depths.has(tgt)) {
        depths.set(tgt, curDepth + 1);
        downQueue.push(tgt);
      }
    }
  }

  return depths;
}

function getLeafKeys(edges: FlatEdge[], currentKey: string): { upstreamLeaves: Set<string>; downstreamLeaves: Set<string> } {
  const hasDownstreamEdge = new Set<string>();
  const hasUpstreamEdge = new Set<string>();

  for (const e of edges) {
    hasDownstreamEdge.add(e.source_key);
    hasUpstreamEdge.add(e.target_key);
  }

  const upstreamLeaves = new Set<string>();
  const downstreamLeaves = new Set<string>();
  const allKeys = new Set<string>();
  for (const e of edges) {
    allKeys.add(e.source_key);
    allKeys.add(e.target_key);
  }
  for (const key of allKeys) {
    if (key === currentKey) continue;
    if (!hasUpstreamEdge.has(key)) upstreamLeaves.add(key);
    if (!hasDownstreamEdge.has(key)) downstreamLeaves.add(key);
  }

  return { upstreamLeaves, downstreamLeaves };
}

// ─── Inline Connector between two columns ──────────────────────────────────

const CONNECTOR_WIDTH = 60;

interface ConnectorPath {
  d: string;
  key: string;
  mx: number;
  my: number;
  edge_id?: string;
  has_annotation?: boolean;
}

function ColumnConnector({
  leftColKeys,
  rightColKeys,
  edges,
  nodeRefs,
  layoutVersion,
  onEdgeClick,
}: {
  leftColKeys: string[];
  rightColKeys: string[];
  edges: FlatEdge[];
  nodeRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  layoutVersion: number;
  onEdgeClick?: (edgeId: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [paths, setPaths] = useState<ConnectorPath[]>([]);
  const [svgHeight, setSvgHeight] = useState(60);

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      const svg = svgRef.current;
      if (!svg) return;
      const svgRect = svg.getBoundingClientRect();

      const relevantEdges = edges.filter(
        (e) => leftColKeys.includes(e.source_key) && rightColKeys.includes(e.target_key)
      );

      let maxY = 60;
      const newPaths: ConnectorPath[] = [];

      for (const edge of relevantEdges) {
        const sourceEl = nodeRefs.current.get(edge.source_key);
        const targetEl = nodeRefs.current.get(edge.target_key);
        if (!sourceEl || !targetEl) continue;

        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        const y1 = sourceRect.top + sourceRect.height / 2 - svgRect.top;
        const y2 = targetRect.top + targetRect.height / 2 - svgRect.top;

        maxY = Math.max(maxY, y1 + 10, y2 + 10);

        const cx = CONNECTOR_WIDTH * 0.45;
        const d = `M 0 ${y1} C ${cx} ${y1}, ${CONNECTOR_WIDTH - cx} ${y2}, ${CONNECTOR_WIDTH} ${y2}`;
        const mx = CONNECTOR_WIDTH / 2;
        const my = (y1 + y2) / 2;
        newPaths.push({ d, key: `${edge.source_key}->${edge.target_key}`, mx, my, edge_id: edge.edge_id, has_annotation: edge.has_annotation });
      }

      setSvgHeight(maxY);
      setPaths(newPaths);
    });
    return () => cancelAnimationFrame(rafId);
  }, [leftColKeys, rightColKeys, edges, layoutVersion]);

  return (
    <svg
      ref={svgRef}
      width={CONNECTOR_WIDTH}
      height={svgHeight}
      className="shrink-0 self-start"
      style={{ minHeight: svgHeight }}
    >
      <defs>
        <marker id="conn-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
        </marker>
      </defs>
      {paths.map((p) => (
        <g key={p.key}>
          <path
            d={p.d}
            fill="none"
            stroke="#64748b"
            strokeWidth={2}
            markerEnd="url(#conn-arrow)"
          />
          {p.edge_id && (
            <g
              style={{ cursor: "pointer" }}
              onClick={() => onEdgeClick?.(p.edge_id!)}
            >
              <circle
                cx={p.mx}
                cy={p.my}
                r={8}
                fill={p.has_annotation ? "#3b82f6" : "white"}
                stroke={p.has_annotation ? "#2563eb" : "#9ca3af"}
                strokeWidth={1.5}
              />
              <text
                x={p.mx}
                y={p.my}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={9}
                fontWeight="bold"
                fill={p.has_annotation ? "white" : "#6b7280"}
                style={{ pointerEvents: "none" }}
              >
                i
              </text>
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}

// ─── Add Lineage Popover ───────────────────────────────────────────────────

function AddLineagePopover({
  direction,
  onAdd,
  onClose,
}: {
  direction: "upstream" | "downstream";
  onAdd: (result: LineageTableSearchResult) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LineageTableSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setSearching(true);
      searchTablesForLineage(query)
        .then(setResults)
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  return (
    <div ref={ref} className="bg-white border rounded-lg shadow-lg w-72 p-3">
      <div className="flex items-center gap-2 mb-2 border-b pb-2">
        <Search size={14} className="text-gray-400 shrink-0" />
        <input
          autoFocus
          className="flex-1 text-sm border-none outline-none bg-transparent"
          placeholder={`Search ${direction} table...`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0">
          <X size={14} />
        </button>
      </div>
      <div className="max-h-48 overflow-auto">
        {searching && <div className="text-xs text-gray-400 py-2 text-center">Searching...</div>}
        {!searching && query && results.length === 0 && (
          <div className="text-xs text-gray-400 py-2 text-center">No tables found</div>
        )}
        {!query && <div className="text-xs text-gray-400 py-2 text-center">Type to search tables</div>}
        {results.map((r) => (
          <button
            key={r.table_id}
            onClick={() => onAdd(r)}
            className="w-full text-left px-2 py-1.5 text-sm hover:bg-blue-50 rounded flex flex-col"
          >
            <span className="font-medium truncate">{r.table_name}</span>
            <span className="text-xs text-gray-400">{r.db_name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Lineage Node Card ─────────────────────────────────────────────────────

function LineageNodeCard({
  node,
  isCurrent,
  isSteward,
  onDelete,
  onExpandUpstream,
  onExpandDownstream,
  nodeRef,
}: {
  node: FlatNode;
  isCurrent: boolean;
  isSteward: boolean;
  onDelete?: (nodeKey: string) => void;
  onExpandUpstream?: () => void;
  onExpandDownstream?: () => void;
  nodeRef: (el: HTMLDivElement | null) => void;
}) {
  const cardBg = isCurrent
    ? "bg-blue-50 border-2 border-blue-300"
    : node.is_catalog_table
      ? "bg-white border border-gray-200"
      : "bg-gray-50 border border-dashed border-gray-300";

  return (
    <div className="group relative flex items-center">
      {onExpandUpstream && (
        <button
          onClick={onExpandUpstream}
          className="absolute -left-7 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border border-gray-300 bg-white text-gray-500 flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-colors shadow-sm"
          title="Load more upstream"
        >
          <ChevronLeft size={12} />
        </button>
      )}

      <div ref={nodeRef} className={`${cardBg} rounded-lg px-4 py-2.5 shadow-sm w-[200px] relative`}>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            {node.is_catalog_table && node.table_id ? (
              <Link
                to={`/tables/${node.table_id}`}
                className={`text-sm font-semibold truncate block ${isCurrent ? "text-blue-800" : "text-blue-600 hover:underline"}`}
              >
                {node.table_name}
              </Link>
            ) : (
              <span className={`text-sm font-semibold truncate block ${isCurrent ? "text-blue-800" : "text-gray-700"}`}>
                {node.table_name}
              </span>
            )}
            <div className={`text-xs truncate ${isCurrent ? "text-blue-500" : "text-gray-400"}`}>
              {node.db_name}
            </div>
          </div>
          {isSteward && !isCurrent && onDelete && (
            <button
              onClick={() => onDelete(node.key)}
              className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              title="Remove from lineage"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {onExpandDownstream && (
        <button
          onClick={onExpandDownstream}
          className="absolute -right-7 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border border-gray-300 bg-white text-gray-500 flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-colors shadow-sm"
          title="Load more downstream"
        >
          <ChevronRight size={12} />
        </button>
      )}
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────

function DashedPlaceholder({
  label,
  isSteward,
  onClick,
}: {
  label: string;
  isSteward: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={`border-2 border-dashed rounded-lg px-4 py-3 min-w-[160px] flex items-center justify-center gap-2 transition-colors ${
        isSteward ? "border-blue-300 text-blue-500 cursor-pointer hover:bg-blue-50 hover:border-blue-400" : "border-gray-200 text-gray-400"
      }`}
      onClick={isSteward ? onClick : undefined}
    >
      {isSteward && <Plus size={14} />}
      <span className="text-sm">{label}</span>
    </div>
  );
}

function StaticArrow() {
  return (
    <div className="flex items-center px-1 text-gray-300">
      <ArrowRight size={20} />
    </div>
  );
}

// ─── Edge Annotation Display (read-only) ───────────────────────────────────

function EdgeAnnotationDisplay({ annotation }: { annotation: EdgeAnnotation }) {
  const hasAny =
    annotation.integration_description ||
    annotation.integration_method ||
    annotation.integration_schedule ||
    annotation.integration_notes;

  if (!hasAny) {
    return <p className="text-sm text-gray-400 italic">No integration details documented yet.</p>;
  }

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      {annotation.integration_method && (
        <>
          <dt className="font-medium text-gray-500">Method</dt>
          <dd className="text-gray-800">{annotation.integration_method}</dd>
        </>
      )}
      {annotation.integration_schedule && (
        <>
          <dt className="font-medium text-gray-500">Schedule</dt>
          <dd className="text-gray-800">{annotation.integration_schedule}</dd>
        </>
      )}
      {annotation.integration_description && (
        <>
          <dt className="font-medium text-gray-500">Description</dt>
          <dd className="text-gray-800 whitespace-pre-wrap">{annotation.integration_description}</dd>
        </>
      )}
      {annotation.integration_notes && (
        <>
          <dt className="font-medium text-gray-500">Notes</dt>
          <dd className="text-gray-800 whitespace-pre-wrap">{annotation.integration_notes}</dd>
        </>
      )}
    </dl>
  );
}

// ─── Edge Annotation Form ──────────────────────────────────────────────────

const METHOD_OPTIONS = ["ETL", "Kafka", "API", "Manual", "Custom"];

function EdgeAnnotationForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: EdgeAnnotation;
  onSave: (data: EdgeAnnotationUpdate) => Promise<void>;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState(initial.integration_description ?? "");
  const [method, setMethod] = useState(initial.integration_method ?? "");
  const [customMethod, setCustomMethod] = useState("");
  const [schedule, setSchedule] = useState(initial.integration_schedule ?? "");
  const [notes, setNotes] = useState(initial.integration_notes ?? "");
  const [saving, setSaving] = useState(false);

  const isCustom = method === "Custom";
  const effectiveMethod = isCustom ? customMethod : method;

  // Initialize custom method if the initial value isn't in the preset list
  useEffect(() => {
    if (initial.integration_method && !METHOD_OPTIONS.includes(initial.integration_method)) {
      setMethod("Custom");
      setCustomMethod(initial.integration_method);
    }
  }, [initial.integration_method]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        integration_description: description || null,
        integration_method: effectiveMethod || null,
        integration_schedule: schedule || null,
        integration_notes: notes || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">Method</label>
        <div className="flex gap-2">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm bg-white flex-1"
          >
            <option value="">— Select —</option>
            {METHOD_OPTIONS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {isCustom && (
            <input
              type="text"
              value={customMethod}
              onChange={(e) => setCustomMethod(e.target.value)}
              placeholder="Enter method..."
              className="border rounded px-2 py-1.5 text-sm flex-1"
            />
          )}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">Schedule</label>
        <input
          type="text"
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
          placeholder='e.g. "Daily 2am", "Real-time"'
          className="border rounded px-2 py-1.5 text-sm w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="border rounded px-2 py-1.5 text-sm w-full resize-y"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="border rounded px-2 py-1.5 text-sm w-full resize-y"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Main LineageView ──────────────────────────────────────────────────────

export default function LineageView({ tableId }: { tableId: string }) {
  const { isSteward } = useAuth();
  const [nodes, setNodes] = useState<Map<string, FlatNode>>(new Map());
  const [edges, setEdges] = useState<FlatEdge[]>([]);
  const [currentKey, setCurrentKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [layoutVersion, setLayoutVersion] = useState(0);

  const [popover, setPopover] = useState<{
    anchorKey: string;
    direction: "upstream" | "downstream";
  } | null>(null);

  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [annotation, setAnnotation] = useState<EdgeAnnotation | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState(false);

  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const load = useCallback(() => {
    setLoading(true);
    getTableLineage(tableId, 1)
      .then((graph: LineageGraph) => {
        const cKey = nodeKey(graph.current_db, graph.current_table);
        const flatNodes = new Map<string, FlatNode>();
        const flatEdges: FlatEdge[] = [];

        flatNodes.set(cKey, {
          key: cKey,
          db_name: graph.current_db,
          table_name: graph.current_table,
          is_catalog_table: true,
          table_id: tableId,
          has_more_upstream: false,
          has_more_downstream: false,
        });

        flattenTree(graph.upstream, cKey, "upstream", flatNodes, flatEdges);
        flattenTree(graph.downstream, cKey, "downstream", flatNodes, flatEdges);

        setNodes(flatNodes);
        setEdges(flatEdges);
        setCurrentKey(cKey);
      })
      .finally(() => setLoading(false));
  }, [tableId]);

  useEffect(() => {
    load();
  }, [load]);

  // Bump layout version after nodes/edges change so connectors re-measure
  useEffect(() => {
    const id = requestAnimationFrame(() => setLayoutVersion((v) => v + 1));
    return () => cancelAnimationFrame(id);
  }, [nodes, edges]);

  const handleDelete = async (nKey: string) => {
    const edgesToDelete = edges.filter(
      (e) => e.source_key === nKey || e.target_key === nKey
    );
    for (const e of edgesToDelete) {
      if (e.edge_id) await deleteLineageEdge(e.edge_id);
    }
    load();
  };

  const handleExpand = async (nKey: string, direction: "upstream" | "downstream") => {
    const node = nodes.get(nKey);
    if (!node) return;

    try {
      let treeNodes: LineageNode[];
      if (node.table_id) {
        const graph = await getTableLineage(node.table_id, 1);
        treeNodes = direction === "upstream" ? graph.upstream : graph.downstream;
      } else {
        treeNodes = await expandLineageNode(node.db_name, node.table_name, direction, 1);
      }

      const newNodes = new Map(nodes);
      const newEdges = [...edges];
      flattenTree(treeNodes, nKey, direction, newNodes, newEdges);

      const updated = { ...newNodes.get(nKey)! };
      if (direction === "upstream") updated.has_more_upstream = false;
      else updated.has_more_downstream = false;
      newNodes.set(nKey, updated);

      setNodes(newNodes);
      setEdges(newEdges);
    } catch {
      // silently handle
    }
  };

  const handleAddEdge = async (
    anchorKey: string,
    direction: "upstream" | "downstream",
    selected: LineageTableSearchResult
  ) => {
    const anchor = nodes.get(anchorKey);
    if (!anchor) return;

    const data =
      direction === "upstream"
        ? {
            source_db_name: selected.db_name,
            source_table_name: selected.table_name,
            target_db_name: anchor.db_name,
            target_table_name: anchor.table_name,
          }
        : {
            source_db_name: anchor.db_name,
            source_table_name: anchor.table_name,
            target_db_name: selected.db_name,
            target_table_name: selected.table_name,
          };

    try {
      await createLineageEdge(data);
      setPopover(null);
      load();
    } catch {
      // handle error
    }
  };

  const handleEdgeClick = async (edgeId: string) => {
    setSelectedEdgeId(edgeId);
    setEditingAnnotation(false);
    try {
      const ann = await getEdgeAnnotation(edgeId);
      setAnnotation(ann);
    } catch {
      setAnnotation(null);
    }
  };

  const handleSaveAnnotation = async (data: EdgeAnnotationUpdate) => {
    if (!selectedEdgeId) return;
    const updated = await updateEdgeAnnotation(selectedEdgeId, data);
    setAnnotation(updated);
    setEditingAnnotation(false);
    const hasAnn = !!(data.integration_description || data.integration_method || data.integration_schedule || data.integration_notes);
    setEdges((prev) =>
      prev.map((e) => (e.edge_id === selectedEdgeId ? { ...e, has_annotation: hasAnn } : e))
    );
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 py-8">
        <Loader2 size={16} className="animate-spin" /> Loading lineage...
      </div>
    );
  }

  const hasUpstream = edges.some((e) => e.target_key === currentKey);
  const hasDownstream = edges.some((e) => e.source_key === currentKey);
  const isEmpty = !hasUpstream && !hasDownstream;

  // ─── Empty state ──────────────────────────────────────────────────────────
  if (isEmpty) {
    const currentNode = nodes.get(currentKey);
    return (
      <div className="flex items-center justify-center gap-3 py-10 relative">
        <div className="relative">
          <DashedPlaceholder
            label={isSteward ? "Add upstream" : "No upstream"}
            isSteward={isSteward}
            onClick={() => setPopover({ anchorKey: currentKey, direction: "upstream" })}
          />
          {popover?.direction === "upstream" && (
            <div className="absolute z-50 mt-2" style={{ top: "100%", right: 0 }}>
              <AddLineagePopover
                direction="upstream"
                onAdd={(r) => handleAddEdge(popover.anchorKey, "upstream", r)}
                onClose={() => setPopover(null)}
              />
            </div>
          )}
        </div>

        <StaticArrow />

        {currentNode && (
          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg px-4 py-2.5 shadow-sm w-[200px] text-center">
            <div className="text-sm font-bold text-blue-800">{currentNode.table_name}</div>
            <div className="text-xs text-blue-500">{currentNode.db_name}</div>
          </div>
        )}

        <StaticArrow />

        <div className="relative">
          <DashedPlaceholder
            label={isSteward ? "Add downstream" : "No downstream"}
            isSteward={isSteward}
            onClick={() => setPopover({ anchorKey: currentKey, direction: "downstream" })}
          />
          {popover?.direction === "downstream" && (
            <div className="absolute z-50 mt-2" style={{ top: "100%", left: 0 }}>
              <AddLineagePopover
                direction="downstream"
                onAdd={(r) => handleAddEdge(popover.anchorKey, "downstream", r)}
                onClose={() => setPopover(null)}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Build column layout ─────────────────────────────────────────────────
  const depths = assignDepths(currentKey, nodes, edges);
  const columns = new Map<number, FlatNode[]>();

  for (const [key, depth] of depths) {
    const node = nodes.get(key);
    if (!node) continue;
    if (!columns.has(depth)) columns.set(depth, []);
    columns.get(depth)!.push(node);
  }

  const sortedDepths = [...columns.keys()].sort((a, b) => a - b);
  const minDepth = sortedDepths[0] ?? 0;
  const maxDepth = sortedDepths[sortedDepths.length - 1] ?? 0;
  const { upstreamLeaves, downstreamLeaves } = getLeafKeys(edges, currentKey);

  // Build interleaved list: [column, connector, column, connector, column]
  const interleaved: React.ReactNode[] = [];

  for (let i = 0; i < sortedDepths.length; i++) {
    const depth = sortedDepths[i];
    const colNodes = columns.get(depth)!;

    // Render column
    interleaved.push(
      <div key={`col-${depth}`} className="flex flex-col items-center gap-3 shrink-0">
        {colNodes.map((node) => {
          const isCurrent = node.key === currentKey;
          const isUpLeaf = upstreamLeaves.has(node.key);
          const isDownLeaf = downstreamLeaves.has(node.key);
          const showExpandUp = !isCurrent && isUpLeaf && node.has_more_upstream;
          const showExpandDown = !isCurrent && isDownLeaf && node.has_more_downstream;

          return (
            <LineageNodeCard
              key={node.key}
              node={node}
              isCurrent={isCurrent}
              isSteward={isSteward}
              onDelete={isSteward ? handleDelete : undefined}
              onExpandUpstream={showExpandUp ? () => handleExpand(node.key, "upstream") : undefined}
              onExpandDownstream={showExpandDown ? () => handleExpand(node.key, "downstream") : undefined}
              nodeRef={(el) => {
                if (el) nodeRefs.current.set(node.key, el);
                else nodeRefs.current.delete(node.key);
              }}
            />
          );
        })}
      </div>
    );

    // Render connector SVG between this column and the next
    if (i < sortedDepths.length - 1) {
      const nextDepth = sortedDepths[i + 1];
      const leftKeys = colNodes.map((n) => n.key);
      const rightKeys = columns.get(nextDepth)!.map((n) => n.key);

      interleaved.push(
        <ColumnConnector
          key={`conn-${depth}-${nextDepth}`}
          leftColKeys={leftKeys}
          rightColKeys={rightKeys}
          edges={edges}
          nodeRefs={nodeRefs}
          layoutVersion={layoutVersion}
          onEdgeClick={handleEdgeClick}
        />
      );
    }
  }

  return (
    <div className="space-y-3">
      {/* Flow direction header */}
      <div className="flex items-center gap-2 text-xs text-gray-400 px-2">
        {minDepth < 0 && <span>Upstream Sources</span>}
        {minDepth < 0 && <ArrowRight size={12} />}
        <span className="font-medium text-gray-500">Current Table</span>
        {maxDepth > 0 && <ArrowRight size={12} />}
        {maxDepth > 0 && <span>Downstream Targets</span>}
        {isSteward && (
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setPopover({ anchorKey: currentKey, direction: "upstream" })}
              className="text-blue-500 hover:text-blue-700 flex items-center gap-1"
            >
              <Plus size={11} /> Add upstream
            </button>
            <button
              onClick={() => setPopover({ anchorKey: currentKey, direction: "downstream" })}
              className="text-blue-500 hover:text-blue-700 flex items-center gap-1"
            >
              <Plus size={11} /> Add downstream
            </button>
          </div>
        )}
      </div>

      {/* Popover for header add buttons */}
      {popover?.anchorKey === currentKey && (
        <div className="relative">
          <div
            className="absolute z-50"
            style={{
              ...(popover.direction === "downstream" ? { right: 8 } : { right: 140 }),
              top: 0,
            }}
          >
            <AddLineagePopover
              direction={popover.direction}
              onAdd={(r) => handleAddEdge(popover.anchorKey, popover.direction, r)}
              onClose={() => setPopover(null)}
            />
          </div>
        </div>
      )}

      {/* Graph canvas */}
      <div className="overflow-x-auto border rounded-lg bg-gray-50/50 p-6">
        <div className="flex items-start min-w-fit py-2">
          {interleaved}
        </div>
      </div>

      {/* Annotation panel */}
      {selectedEdgeId && annotation !== null && (
        <div className="border rounded-lg bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Integration Details</h3>
            <div className="flex items-center gap-2">
              {isSteward && !editingAnnotation && (
                <button
                  onClick={() => setEditingAnnotation(true)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Edit
                </button>
              )}
              <button
                onClick={() => { setSelectedEdgeId(null); setAnnotation(null); setEditingAnnotation(false); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          {editingAnnotation ? (
            <EdgeAnnotationForm
              initial={annotation}
              onSave={handleSaveAnnotation}
              onCancel={() => setEditingAnnotation(false)}
            />
          ) : (
            <EdgeAnnotationDisplay annotation={annotation} />
          )}
        </div>
      )}
    </div>
  );
}
