/**
 * client/src/lib/api.js
 *
 * Wrapper de fetch que injeta automaticamente:
 *   - Bearer token do Supabase Auth (para rotas autenticadas)
 *   - Fallback para JWT local (sessão offline)
 *   - X-Org-Id header (para rotas que exigem contexto de org)
 */
import { supabase } from "./supabase";

const BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

const LOCAL_SESSION_KEY = "fila_io_local_session";

/**
 * Cache do access token — injetado pelo useAuth quando a sessão muda.
 * Isso evita chamar supabase.auth.getSession() em cada request,
 * que pode travar durante um TOKEN_REFRESH do Supabase.
 */
let _cachedToken = null;

export const setAuthToken = (token) => {
  _cachedToken = token;
};

// ── Sessão local (offline) ───────────────────────────────────────

export const saveLocalSession = (token) => {
  try { localStorage.setItem(LOCAL_SESSION_KEY, token); } catch {}
};

export const clearLocalSession = () => {
  try { localStorage.removeItem(LOCAL_SESSION_KEY); } catch {}
};

export const getLocalSession = () => {
  try { return localStorage.getItem(LOCAL_SESSION_KEY); } catch { return null; }
};

/**
 * Retorna o melhor token disponível:
 *   1. Token Supabase (cacheado) — se online
 *   2. JWT local — se offline
 */
const getActiveToken = () => _cachedToken || getLocalSession();

/**
 * fetch autenticado.
 *
 * @param {string} path  - ex: "/api/rooms"
 * @param {object} opts  - opções do fetch + orgId opcional
 */
export const apiFetch = async (path, { orgId, headers: extraHeaders, ...opts } = {}) => {
  const token = getActiveToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token   ? { Authorization: `Bearer ${token}` } : {}),
    ...(orgId   ? { "X-Org-Id": orgId }               : {}),
    ...extraHeaders,
  };

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
};

// ── Auth ──────────────────────────────────────────────────────────
export const syncProfile = (name) =>
  apiFetch("/api/auth/profile", { method: "POST", body: JSON.stringify({ name }) });

export const fetchMe = () => apiFetch("/api/auth/me");

export const acceptInvite = (token) =>
  apiFetch("/api/auth/accept-invite", { method: "POST", body: JSON.stringify({ token }) });

// ── Organizations ─────────────────────────────────────────────────
export const createOrg = (name) =>
  apiFetch("/api/orgs", { method: "POST", body: JSON.stringify({ name }) });

export const fetchOrgs = () => apiFetch("/api/orgs");

export const fetchOrgMembers = (orgId) =>
  apiFetch("/api/orgs/:id/members".replace(":id", orgId), { orgId });

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
  apiFetch(`/api/orgs/${orgId}/members/${userId}`, { orgId, method: "DELETE" });

export const updateOrg = (orgId, data) =>
  apiFetch(`/api/orgs/${orgId}`, { orgId, method: "PATCH", body: JSON.stringify(data) });

export const deleteOrg = (orgId) =>
  apiFetch(`/api/orgs/${orgId}`, { orgId, method: "DELETE" });

// ── Rooms ─────────────────────────────────────────────────────────
export const createRoom = (orgId, data) =>
  apiFetch("/api/rooms", { orgId, method: "POST", body: JSON.stringify(data) });

export const fetchOrgRooms = (orgId) => apiFetch("/api/rooms/org", { orgId });

export const fetchRoomPublic = (code) => apiFetch(`/api/rooms/${code}`);

export const closeDay = (orgId, code) =>
  apiFetch(`/api/rooms/${code}/close`, { orgId, method: "POST" });

export const fetchHistory = (orgId) => apiFetch("/api/rooms/history", { orgId });

// ── Queue ─────────────────────────────────────────────────────────
export const joinQueue = (roomCode, name, category) =>
  apiFetch("/api/queue/join", {
    method: "POST",
    body: JSON.stringify({ roomCode, name, category }),
  });
