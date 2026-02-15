import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Loader2, Search, X, ChevronRight, ChevronLeft, ArrowRight } from "lucide-react";
import {
  getTableLineage,
  deleteLineageEdge,
  createLineageEdge,
  searchTablesForLineage,
  expandLineageNode,
  type LineageGraph,
  type LineageNode,
  type LineageTableSearchResult,
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
        ? { source_key: key, target_key: parentKey, edge_id: n.edge_id ?? undefined }
        : { source_key: parentKey, target_key: key, edge_id: n.edge_id ?? undefined };
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

function ColumnConnector({
  leftColKeys,
  rightColKeys,
  edges,
  nodeRefs,
  layoutVersion,
}: {
  leftColKeys: string[];
  rightColKeys: string[];
  edges: FlatEdge[];
  nodeRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  layoutVersion: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [paths, setPaths] = useState<{ d: string; key: string }[]>([]);
  const [svgHeight, setSvgHeight] = useState(60);

  useEffect(() => {
    // Wait a frame so node refs are measured
    const rafId = requestAnimationFrame(() => {
      const svg = svgRef.current;
      if (!svg) return;
      const svgRect = svg.getBoundingClientRect();

      const relevantEdges = edges.filter(
        (e) => leftColKeys.includes(e.source_key) && rightColKeys.includes(e.target_key)
      );

      let maxY = 60;
      const newPaths: { d: string; key: string }[] = [];

      for (const edge of relevantEdges) {
        const sourceEl = nodeRefs.current.get(edge.source_key);
        const targetEl = nodeRefs.current.get(edge.target_key);
        if (!sourceEl || !targetEl) continue;

        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        // Y positions relative to the SVG element
        const y1 = sourceRect.top + sourceRect.height / 2 - svgRect.top;
        const y2 = targetRect.top + targetRect.height / 2 - svgRect.top;

        maxY = Math.max(maxY, y1 + 10, y2 + 10);

        const cx = CONNECTOR_WIDTH * 0.45;
        const d = `M 0 ${y1} C ${cx} ${y1}, ${CONNECTOR_WIDTH - cx} ${y2}, ${CONNECTOR_WIDTH} ${y2}`;
        newPaths.push({ d, key: `${edge.source_key}->${edge.target_key}` });
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
        <path
          key={p.key}
          d={p.d}
          fill="none"
          stroke="#64748b"
          strokeWidth={2}
          markerEnd="url(#conn-arrow)"
        />
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
    </div>
  );
}
