import { useState, useRef, useEffect } from "react";
import { setEndorsement, removeEndorsement } from "../api/governance";
import { useAuth } from "../auth/AuthContext";
import { formatDateTime } from "../utils/formatters";
import { useEndorsement } from "../hooks/useEndorsement";

interface Props {
  entityType: string;
  entityId: string;
}

const STATUS_CONFIG = {
  endorsed: { dot: "bg-green-500", label: "Endorsed", bgHover: "hover:bg-green-50" },
  warned: { dot: "bg-yellow-500", label: "Warning", bgHover: "hover:bg-yellow-50" },
  deprecated: { dot: "bg-red-500", label: "Deprecated", bgHover: "hover:bg-red-50" },
} as const;

export default function EndorsementBadge({ entityType, entityId }: Props) {
  const { isEditor } = useAuth();
  const { data: endorsement, invalidate } = useEndorsement(entityType, entityId);
  const [showPopover, setShowPopover] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
        setPendingStatus(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSet = async (status: string) => {
    if (status === "endorsed") {
      await setEndorsement({ entity_type: entityType, entity_id: entityId, status });
      invalidate();
      setPendingStatus(null);
    } else {
      setPendingStatus(status);
      setCommentInput("");
    }
  };

  const handleConfirm = async () => {
    if (!pendingStatus) return;
    await setEndorsement({ entity_type: entityType, entity_id: entityId, status: pendingStatus, comment: commentInput });
    invalidate();
    setPendingStatus(null);
    setCommentInput("");
  };

  const handleClear = async () => {
    await removeEndorsement(entityType, entityId);
    invalidate();
    setShowPopover(false);
  };

  const config = endorsement ? STATUS_CONFIG[endorsement.status as keyof typeof STATUS_CONFIG] : null;

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button
        onClick={() => setShowPopover(!showPopover)}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${config?.bgHover || "hover:bg-gray-100"}`}
        title={config?.label || "No endorsement"}
      >
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${config?.dot || "bg-gray-300"}`} />
        {config && <span className="text-gray-600">{config.label}</span>}
      </button>

      {showPopover && (
        <div className="absolute z-50 top-full left-0 mt-1 w-72 bg-white border rounded-lg shadow-lg p-3">
          {endorsement ? (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${config?.dot}`} />
                <span className="text-sm font-medium">{config?.label}</span>
              </div>
              {endorsement.comment && <p className="text-xs text-gray-600 mb-1">{endorsement.comment}</p>}
              <div className="text-xs text-gray-400">
                By {endorsement.endorser_name || "Unknown"} on {formatDateTime(endorsement.updated_at)}
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-400 mb-3">No endorsement set</div>
          )}

          {isEditor && !pendingStatus && (
            <div className="border-t pt-2">
              <div className="text-xs text-gray-500 mb-1.5">Set endorsement:</div>
              <div className="flex gap-1.5">
                <button onClick={() => handleSet("endorsed")} className="px-2 py-1 text-xs rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100">Endorse</button>
                <button onClick={() => handleSet("warned")} className="px-2 py-1 text-xs rounded bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100">Warn</button>
                <button onClick={() => handleSet("deprecated")} className="px-2 py-1 text-xs rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">Deprecate</button>
                {endorsement && <button onClick={handleClear} className="px-2 py-1 text-xs rounded bg-gray-50 text-gray-600 border hover:bg-gray-100">Clear</button>}
              </div>
            </div>
          )}

          {pendingStatus && (
            <div className="border-t pt-2 mt-2">
              <div className="text-xs text-gray-500 mb-1">Comment (required):</div>
              <textarea
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                className="w-full border rounded px-2 py-1 text-xs h-16 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder={`Why is this ${pendingStatus}?`}
              />
              <div className="flex gap-2 mt-1.5">
                <button onClick={handleConfirm} disabled={!commentInput.trim()} className="px-2 py-1 bg-blue-600 text-white text-xs rounded disabled:opacity-50">Confirm</button>
                <button onClick={() => setPendingStatus(null)} className="px-2 py-1 text-xs text-gray-500">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
