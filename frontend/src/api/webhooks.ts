import api from "./client";

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_by: string;
  creator_name?: string;
  created_at: string;
}

export interface WebhookEvent {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status_code?: number;
  response_body?: string;
  created_at: string;
}

export const getWebhooks = () =>
  api.get<Webhook[]>("/api/v1/webhooks").then((r) => r.data);

export const createWebhook = (data: { name: string; url: string; secret?: string; events: string[]; is_active?: boolean }) =>
  api.post<Webhook>("/api/v1/webhooks", data).then((r) => r.data);

export const updateWebhook = (id: string, data: Partial<{ name: string; url: string; events: string[]; is_active: boolean }>) =>
  api.patch<Webhook>(`/api/v1/webhooks/${id}`, data).then((r) => r.data);

export const deleteWebhook = (id: string) =>
  api.delete(`/api/v1/webhooks/${id}`);

export const getWebhookEvents = (webhookId: string, page = 1, size = 20) =>
  api.get<{ total: number; page: number; size: number; items: WebhookEvent[] }>(
    `/api/v1/webhooks/${webhookId}/events`,
    { params: { page, size } }
  ).then((r) => r.data);
