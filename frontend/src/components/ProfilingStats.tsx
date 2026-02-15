import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { getColumnProfile, type ColumnProfile } from "../api/governance";

interface Props {
  columnId: string;
}

export default function ProfilingStats({ columnId }: Props) {
  const [profile, setProfile] = useState<ColumnProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getColumnProfile(columnId)
      .then(setProfile)
      .finally(() => setLoading(false));
  }, [columnId]);

  if (loading) return null;
  if (!profile) return null;

  return (
    <div className="bg-gray-50 rounded p-3 text-xs">
      <div className="flex items-center gap-1 text-gray-600 font-medium mb-2">
        <BarChart3 size={12} /> Profile Stats
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {profile.null_percentage != null && (
          <>
            <span className="text-gray-500">Null %</span>
            <span>{profile.null_percentage.toFixed(1)}%</span>
          </>
        )}
        {profile.distinct_count != null && (
          <>
            <span className="text-gray-500">Distinct</span>
            <span>{profile.distinct_count.toLocaleString()}</span>
          </>
        )}
        {profile.min_value != null && (
          <>
            <span className="text-gray-500">Min</span>
            <span className="truncate">{profile.min_value}</span>
          </>
        )}
        {profile.max_value != null && (
          <>
            <span className="text-gray-500">Max</span>
            <span className="truncate">{profile.max_value}</span>
          </>
        )}
        {profile.avg_length != null && (
          <>
            <span className="text-gray-500">Avg Length</span>
            <span>{profile.avg_length.toFixed(1)}</span>
          </>
        )}
      </div>
      {profile.sample_values && profile.sample_values.length > 0 && (
        <div className="mt-2">
          <span className="text-gray-500">Samples: </span>
          <span className="text-gray-700">{profile.sample_values.slice(0, 5).join(", ")}</span>
        </div>
      )}
    </div>
  );
}
