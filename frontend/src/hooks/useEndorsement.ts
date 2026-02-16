import { useQuery, useQueryClient } from "@tanstack/react-query";
import { batchEndorsements, type EndorsementDoc } from "../api/governance";
import { queryClient } from "../lib/queryClient";

// Microtask batching: collect all useEndorsement calls in a single tick, then fire one batch POST.
let pendingKeys: { entity_type: string; entity_id: string }[] = [];
let batchScheduled = false;

function scheduleBatch() {
  if (batchScheduled) return;
  batchScheduled = true;
  queueMicrotask(async () => {
    const keys = [...pendingKeys];
    pendingKeys = [];
    batchScheduled = false;
    if (keys.length === 0) return;
    try {
      const { results } = await batchEndorsements(keys);
      for (const key of keys) {
        const cacheKey = `${key.entity_type}:${key.entity_id}`;
        queryClient.setQueryData<EndorsementDoc | null>(
          ["endorsement", key.entity_type, key.entity_id],
          results[cacheKey] ?? null
        );
      }
    } catch {
      // individual queries will retry on their own
    }
  });
}

function fetchEndorsementBatched(entityType: string, entityId: string): Promise<EndorsementDoc | null> {
  pendingKeys.push({ entity_type: entityType, entity_id: entityId });
  scheduleBatch();
  // Return a promise that resolves once the batch completes and data is in the cache
  return new Promise((resolve) => {
    const check = () => {
      const data = queryClient.getQueryData<EndorsementDoc | null>(["endorsement", entityType, entityId]);
      if (data !== undefined) {
        resolve(data);
      } else {
        // Wait for the batch to populate the cache
        setTimeout(check, 10);
      }
    };
    // Give the microtask time to run
    setTimeout(check, 0);
  });
}

export function useEndorsement(entityType: string, entityId: string) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<EndorsementDoc | null>({
    queryKey: ["endorsement", entityType, entityId],
    queryFn: () => fetchEndorsementBatched(entityType, entityId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["endorsement", entityType, entityId] });
  };

  return { data: data ?? null, isLoading, invalidate };
}
