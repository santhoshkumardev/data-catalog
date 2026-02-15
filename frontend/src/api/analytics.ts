import api from "./client";

export const trackView = (entity_type: string, entity_id: string) =>
  api.post("/api/v1/analytics/view", null, { params: { entity_type, entity_id } });

export interface PopularEntity {
  entity_type: string;
  entity_id: string;
  view_count: number;
}

export const getPopularEntities = (entity_type?: string, limit = 10) =>
  api.get<PopularEntity[]>("/api/v1/analytics/popular", {
    params: { ...(entity_type ? { entity_type } : {}), limit },
  }).then((r) => r.data);

export const getTrendingEntities = (limit = 10) =>
  api.get<PopularEntity[]>("/api/v1/analytics/trending", { params: { limit } }).then((r) => r.data);
