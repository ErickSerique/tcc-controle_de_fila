/**
 * client/src/lib/api.js
 *
 * Cliente HTTP para a API REST do Kiwii.
 * Suporta modo online (Supabase Auth) e modo offline (JWT local).
 */
import { supabase } from "./supabase";

const BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

const LOCAL_SESSION_KEY = "kiwii_local_session";

let _cachedToken = null;

export const setAuthToken = (token) => {
  _cachedToken = token;
};

// ── Sessão local (offline) ───────────────────────────────────────

export const saveLocalSession = (token) => {
  try {
    localStorage.setItem(LOCAL_SESSION_KEY, token);
  } catch {}
};

export const clearLocalSession = () => {
  try {
    localStorage.removeItem(LOCAL_SESSION_KEY);
  } catch {}
};

export const getLocalSession = () => {
  try {
    return localStorage.getItem(LOCAL_SESSION_KEY);
  } catch {
    return null;
  }
};

const getActiveToken = () => _cachedToken || getLocalSession();

/**
 * Wrapper sobre fetch() com:
 *   - Injeção automática de Authorization (Supabase ou local)
 *   - Injeção automática do header X-Org-Id (quando fornecido)
 *   - Parsing de JSON e tratamento uniforme de erros
 */
export const apiFetch = async (path, { orgId, headers: extraHeaders, ...opts } = {}) => {
  const token = getActiveToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(orgId ? { "X-Org-Id": orgId } : {}),
    ...extraHeaders,
  };

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Erro HTTP ${res.status}`);
  }

  return res.json();
};

// ── Auth & Convites ────────────────────────────────────────────────
export const syncProfile = (name) =>
  apiFetch("/api/auth/profile", { method: "POST", body: JSON.stringify({ name }) });

export const fetchMe = () => apiFetch("/api/auth/me");

export const acceptInvite = (token) =>
  apiFetch("/api/auth/accept-invite", { method: "POST", body: JSON.stringify({ token }) });

export const fetchInviteInfo = (token) => apiFetch(`/api/orgs/invites/${token}`);

export const fetchMyInvites = () => apiFetch("/api/auth/my-invites");

// ── Organizations ─────────────────────────────────────────────────
export const createOrg = (name) =>
  apiFetch("/api/orgs", { method: "POST", body: JSON.stringify({ name }) });

export const fetchOrgs = () => apiFetch("/api/orgs");

export const fetchOrgMembers = (orgId) =>
  apiFetch(`/api/orgs/${orgId}/members`, { orgId });

export const inviteMember = (orgId, email, role) =>
  apiFetch(`/api/orgs/${orgId}/invites`, {
    orgId,
    method: "POST",
    body: JSON.stringify({ email, role }),
  });

export const updateMemberRole = (orgId, userId, role) =>
  apiFetch(`/api/orgs/${orgId}/members/${userId}`, {
    orgId,
    method: "PATCH",
    body: JSON.stringify({ role }),
  });

export const removeMember = (orgId, userId) =>
  apiFetch(`/api/orgs/${orgId}/members/${userId}`, {
    orgId,
    method: "DELETE",
  });

export const updateOrg = (orgId, data) =>
  apiFetch(`/api/orgs/${orgId}`, {
    orgId,
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteOrg = (orgId) =>
  apiFetch(`/api/orgs/${orgId}`, { orgId, method: "DELETE" });

// ── Modelos de Fila (M2) ───────────────────────────────────────────
export const fetchQueueTemplate = (orgId) =>
  apiFetch(`/api/orgs/${orgId}/queue-template`, { orgId });

export const saveQueueTemplate = (orgId, categories) =>
  apiFetch(`/api/orgs/${orgId}/queue-template`, {
    orgId,
    method: "PUT",
    body: JSON.stringify({ categories }),
  });

// ── Rooms ─────────────────────────────────────────────────────────
export const createRoom = (orgId, data) =>
  apiFetch("/api/rooms", { orgId, method: "POST", body: JSON.stringify(data) });

export const fetchRoomPublic = (code) => apiFetch(`/api/rooms/${code}`);

export const fetchActiveRooms = (orgId) => apiFetch("/api/rooms/org/active", { orgId });

export const closeDay = (code) => apiFetch(`/api/rooms/${code}/close`, { method: "POST" });

export const toggleRoomLock = (code, locked) =>
  apiFetch(`/api/rooms/${code}/lock`, { method: "PATCH", body: JSON.stringify({ locked }) });

export const fetchHistory = (orgId) => apiFetch("/api/rooms/meta/history", { orgId });

export const fetchSessionReport = (orgId, reportId) =>
  apiFetch(`/api/rooms/meta/history/${reportId}`, { orgId });

export const fetchHistorySession = (orgId, sessionId) =>
  apiFetch(`/api/rooms/meta/history/${sessionId}`, { orgId });

// ── Queue ─────────────────────────────────────────────────────────
export const joinQueue = (roomCode, name, category, customData = {}) =>
  apiFetch("/api/queue/join", {
    method: "POST",
    body: JSON.stringify({ roomCode, name, category, customData }),
  });

export const fetchQueue = (roomCode) => apiFetch(`/api/queue/${roomCode}`);
