import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { getAuditLog, type AuditLogEntry } from "../api/catalog";
import { timeAgo } from "../utils/formatters";

interface Props {
  entityType: string;
  entityId: string;
}

export default function VersionHistory({ entityType, entityId }: Props) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAuditLog(1, 20, entityType, entityId)
      .then((res) => setEntries(res.items))
      .finally(() => setLoading(false));
  }, [entityType, entityId]);

  if (loading) return <div className="text-sm text-gray-400">Loading history...</div>;

  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
        <History size={16} /> Version History
      </h3>
      {entries.length === 0 && <p className="text-sm text-gray-400 italic">No changes recorded.</p>}
      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.id} className="flex items-start gap-3 text-sm">
            <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-400 shrink-0" />
            <div>
              <div className="text-gray-700">
                <span className="font-medium">{e.actor_name || "System"}</span>{" "}
                <span className="text-gray-500">{e.action}d</span>{" "}
                <span className="text-gray-600">{e.entity_type}</span>
              </div>
              {e.new_data && Object.keys(e.new_data).length > 0 && (
                <div className="text-xs text-gray-400 mt-0.5">
                  Changed: {Object.keys(e.new_data).join(", ")}
                </div>
              )}
              <div className="text-xs text-gray-400">{timeAgo(e.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
