import api from "./client";

export interface GlossaryTerm {
  id: string;
  name: string;
  definition: string;
  tags?: string[];
  status: "draft" | "approved";
  owner_id?: string;
  owner_name?: string;
  created_by?: string;
  creator_name?: string;
  created_at: string;
  updated_at: string;
}

export interface TermLink {
  id: string;
  term_id: string;
  entity_type: string;
  entity_id: string;
  created_by?: string;
  created_at: string;
}

export interface PaginatedGlossary {
  total: number;
  page: number;
  size: number;
  items: GlossaryTerm[];
}

export const getGlossaryTerms = (page = 1, size = 20, q?: string) =>
  api.get<PaginatedGlossary>("/api/v1/glossary", { params: { page, size, ...(q ? { q } : {}) } }).then((r) => r.data);

export const getGlossaryTerm = (id: string) =>
  api.get<GlossaryTerm>(`/api/v1/glossary/${id}`).then((r) => r.data);

export const createGlossaryTerm = (data: { name: string; definition: string; tags?: string[]; status?: string }) =>
  api.post<GlossaryTerm>("/api/v1/glossary", data).then((r) => r.data);

export const patchGlossaryTerm = (id: string, data: Partial<{ name: string; definition: string; tags: string[]; status: string }>) =>
  api.patch<GlossaryTerm>(`/api/v1/glossary/${id}`, data).then((r) => r.data);

export const deleteGlossaryTerm = (id: string) =>
  api.delete(`/api/v1/glossary/${id}`);

export const getTermLinks = (termId: string) =>
  api.get<TermLink[]>(`/api/v1/glossary/${termId}/links`).then((r) => r.data);

export const linkTerm = (termId: string, entity_type: string, entity_id: string) =>
  api.post<TermLink>(`/api/v1/glossary/${termId}/links`, { entity_type, entity_id }).then((r) => r.data);

export const unlinkTerm = (termId: string, linkId: string) =>
  api.delete(`/api/v1/glossary/${termId}/links/${linkId}`);
