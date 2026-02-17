import api from "./client";

// Comments
export interface Comment {
  id: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  user_name: string;
  body: string;
  created_at: string;
}

export const getComments = (entity_type: string, entity_id: string) =>
  api.get<Comment[]>(`/api/v1/comments/${entity_type}/${entity_id}`).then((r) => r.data);

export const addComment = (entity_type: string, entity_id: string, body: string) =>
  api.post<Comment>(`/api/v1/comments/${entity_type}/${entity_id}`, { body }).then((r) => r.data);

export const deleteComment = (id: string) =>
  api.delete(`/api/v1/comments/${id}`);

// Favorites
export interface Favorite {
  id: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

export interface FavoriteStatus {
  is_favorite: boolean;
  favorite_id?: string;
}

export const getFavoriteStatus = (entity_type: string, entity_id: string) =>
  api.get<FavoriteStatus>("/api/v1/favorites/status", { params: { entity_type, entity_id } }).then((r) => r.data);

export const toggleFavorite = (entity_type: string, entity_id: string) =>
  api.post<FavoriteStatus>("/api/v1/favorites/toggle", { entity_type, entity_id }).then((r) => r.data);

export const getMyFavorites = () =>
  api.get<Favorite[]>("/api/v1/favorites").then((r) => r.data);

// Notifications
export interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  entity_type?: string;
  entity_id?: string;
  is_read: boolean;
  created_at: string;
}

export const getNotifications = (page = 1, size = 20) =>
  api.get<{ total: number; page: number; size: number; items: Notification[] }>("/api/v1/notifications", {
    params: { page, size },
  }).then((r) => r.data);

export const getUnreadCount = () =>
  api.get<{ count: number }>("/api/v1/notifications/unread-count").then((r) => r.data);

export const markNotificationRead = (id: string) =>
  api.patch(`/api/v1/notifications/${id}/read`).then((r) => r.data);

export const markAllRead = () =>
  api.post("/api/v1/notifications/mark-all-read").then((r) => r.data);
