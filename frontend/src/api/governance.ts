import api from "./client";

// Classifications
export interface Classification {
  id: string;
  entity_type: string;
  entity_id: string;
  level: "public" | "internal" | "confidential" | "restricted";
  reason?: string;
  classified_by?: string;
  classifier_name?: string;
  created_at: string;
}

export const getClassification = (entity_type: string, entity_id: string) =>
  api.get<Classification | null>(`/api/v1/governance/classifications/${entity_type}/${entity_id}`).then((r) => r.data);

export const setClassification = (data: { entity_type: string; entity_id: string; level: string; reason?: string }) =>
  api.put<Classification>("/api/v1/governance/classifications", data).then((r) => r.data);

// Approvals
export interface Approval {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  requested_by: string;
  requester_name?: string;
  reviewer_id?: string;
  reviewer_name?: string;
  status: "pending" | "approved" | "rejected";
  proposed_changes?: Record<string, unknown>;
  review_comment?: string;
  created_at: string;
  reviewed_at?: string;
}

export const getApprovals = (page = 1, size = 20, status?: string) =>
  api.get<{ total: number; page: number; size: number; items: Approval[] }>("/api/v1/governance/approvals", {
    params: { page, size, ...(status ? { status } : {}) },
  }).then((r) => r.data);

export const createApproval = (data: { entity_type: string; entity_id: string; action: string; proposed_changes?: Record<string, unknown> }) =>
  api.post<Approval>("/api/v1/governance/approvals", data).then((r) => r.data);

export const reviewApproval = (id: string, data: { status: "approved" | "rejected"; review_comment?: string }) =>
  api.post<Approval>(`/api/v1/governance/approvals/${id}/review`, data).then((r) => r.data);

// Permissions
export interface ResourcePermission {
  id: string;
  user_id: string;
  user_name?: string;
  entity_type: string;
  entity_id: string;
  role: string;
  granted_by: string;
  created_at: string;
}

export const getPermissions = (entity_type: string, entity_id: string) =>
  api.get<ResourcePermission[]>(`/api/v1/governance/permissions/${entity_type}/${entity_id}`).then((r) => r.data);

export const grantPermission = (data: { user_id: string; entity_type: string; entity_id: string; role: string }) =>
  api.post<ResourcePermission>("/api/v1/governance/permissions", data).then((r) => r.data);

export const revokePermission = (id: string) =>
  api.delete(`/api/v1/governance/permissions/${id}`);

// User Lookup (for assignment dropdowns)
export const getUsersForAssignment = () =>
  api.get<{ id: string; name: string; email: string }[]>("/api/v1/governance/users").then((r) => r.data);

// Stewardship
export interface Steward {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

export const getStewards = (entityType: string, entityId: string) =>
  api.get<Steward[]>(`/api/v1/governance/stewards/${entityType}/${entityId}`).then((r) => r.data);

export const assignSteward = (data: { user_id: string; entity_type: string; entity_id: string }) =>
  api.post<Steward>("/api/v1/governance/stewards", data).then((r) => r.data);

export const removeSteward = (entityType: string, entityId: string, userId: string) =>
  api.delete(`/api/v1/governance/stewards/${entityType}/${entityId}/${userId}`);

// Endorsements
export interface EndorsementDoc {
  id: string;
  entity_type: string;
  entity_id: string;
  status: "endorsed" | "warned" | "deprecated";
  comment?: string;
  endorsed_by?: string;
  endorser_name?: string;
  created_at: string;
  updated_at: string;
}

export const getEndorsement = (entityType: string, entityId: string) =>
  api.get<EndorsementDoc | null>(`/api/v1/governance/endorsements/${entityType}/${entityId}`).then((r) => r.data);

export const setEndorsement = (data: { entity_type: string; entity_id: string; status: string; comment?: string }) =>
  api.put<EndorsementDoc>("/api/v1/governance/endorsements", data).then((r) => r.data);

export const removeEndorsement = (entityType: string, entityId: string) =>
  api.delete(`/api/v1/governance/endorsements/${entityType}/${entityId}`);

export interface EndorsementBatchResult {
  results: Record<string, EndorsementDoc | null>;
}

export const batchEndorsements = (keys: { entity_type: string; entity_id: string }[]) =>
  api.post<EndorsementBatchResult>("/api/v1/governance/endorsements/batch", { keys }).then((r) => r.data);

// Column Profiling
export interface ColumnProfile {
  id: string;
  column_id: string;
  null_percentage?: number;
  distinct_count?: number;
  min_value?: string;
  max_value?: string;
  avg_length?: number;
  sample_values?: string[];
  profiled_at: string;
  profiled_by?: string;
}

export const getColumnProfile = (columnId: string) =>
  api.get<ColumnProfile | null>(`/api/v1/profiling/columns/${columnId}`).then((r) => r.data);
