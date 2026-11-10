/**
 * client/src/hooks/useAuth.jsx
 *
 * Context + hook de autenticação com suporte offline.
 * Autenticação via Email + Senha (magic link removido conforme prioridade).
 *
 * Gerencia:
 *   - Sessão Supabase (login e cadastro com senha)
 *   - Sessão local JWT (fallback offline com sliding expiration)
 *   - Perfil do usuário (user_profiles)
 *   - Organização ativa e role do usuário
 */
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  syncProfile,
  fetchMe,
  setAuthToken,
  saveLocalSession,
  clearLocalSession,
  getLocalSession,
} from "../lib/api";
import { connectWithAuth, connectAnonymous } from "../lib/socket";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [activeOrg, setActiveOrg] = useState(null); // { id, name, role, ... }
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [isOffline, setIsOffline] = useState(false);

  // ── Carrega dados do usuário via sessão local (offline) ─────
  const loadFromLocalSession = useCallback(async () => {
    const localToken = getLocalSession();
    if (!localToken) return false;

    console.log("[auth] Tentando sessão local offline...");
    setAuthToken(null);
    try {
      const { user: userData, organizations, localSession } = await fetchMe();

      if (localSession) saveLocalSession(localSession);

      setUser(userData);
      setOrgs(organizations);
      setIsOffline(true);

      connectWithAuth(localToken);

      const savedOrgId = localStorage.getItem("kiwii_active_org");
      const restoredOrg =
        organizations.find((o) => o.id === savedOrgId) ?? organizations[0] ?? null;
      setActiveOrg(restoredOrg);

      console.log("[auth] Sessão local restaurada com sucesso. Modo OFFLINE.");
      return true;
    } catch (err) {
      console.warn("[auth] Sessão local inválida ou expirada:", err.message);
      clearLocalSession();
      return false;
    }
  }, []);

  // ── Carrega dados do usuário após autenticação ──────────────
  const loadUserData = useCallback(
    async (supabaseSession) => {
      if (!supabaseSession) {
        const offlineOk = await loadFromLocalSession();
        if (!offlineOk) {
          setAuthToken(null);
          setSession(null);
          setUser(null);
          setOrgs([]);
          setActiveOrg(null);
          setIsOffline(false);
        }
        setLoading(false);
        return;
      }

      setSession(supabaseSession);
      setAuthToken(supabaseSession.access_token);
      connectWithAuth(supabaseSession.access_token);
      setIsOffline(false);

      try {
        let { user: userData, organizations, localSession } = await fetchMe();

        if (localSession) saveLocalSession(localSession);

        if (!userData) {
          const profileName =
            supabaseSession.user.user_metadata?.full_name ||
            supabaseSession.user.email.split("@")[0];
          await syncProfile(profileName);
          const res = await fetchMe();
          userData = res.user;
          organizations = res.organizations;
        }

        setUser(userData);
        setOrgs(organizations);

        const savedOrgId = localStorage.getItem("kiwii_active_org");
        const restoredOrg =
          organizations.find((o) => o.id === savedOrgId) ?? organizations[0] ?? null;
        setActiveOrg(restoredOrg);
      } catch (err) {
        console.error("[auth] Erro ao sincronizar com backend:", err.message);
        await loadFromLocalSession();
      } finally {
        setLoading(false);
      }
    },
    [loadFromLocalSession]
  );

  // ── Inicialização ───────────────────────────────────────────
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn("[auth] Timeout de segurança atingido. Liberando tela.");
          return false;
        }
        return false;
      });
    }, 5000);

    const initAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        await loadUserData(data.session);
      } catch (err) {
        console.error("[auth] getSession falhou:", err.message);
        await loadFromLocalSession();
        setLoading(false);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      await loadUserData(newSession);
    });

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, [loadUserData, loadFromLocalSession]);

  // ── Ações de Autenticação (apenas e-mail + senha) ─────────────
  const signInWithEmail = async (email, password) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
      return false;
    }
    return true;
  };

  const signUpWithEmail = async (email, password, name) => {
    setAuthError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) {
      setAuthError(error.message);
      return false;
    }
    return true;
  };

  const signOut = async () => {
    setAuthToken(null);
    clearLocalSession();
    connectAnonymous();
    setSession(null);
    setUser(null);
    setOrgs([]);
    setActiveOrg(null);
    setIsOffline(false);
    await supabase.auth.signOut().catch(() => {});
    localStorage.removeItem("kiwii_active_org");
  };

  const switchOrg = (org) => {
    setActiveOrg(org);
    if (org?.id) {
      localStorage.setItem("kiwii_active_org", org.id);
    }
  };

  const refreshOrgs = async () => {
    try {
      const { organizations } = await fetchMe();
      setOrgs(organizations);
      if (activeOrg) {
        const updated = organizations.find((o) => o.id === activeOrg.id);
        setActiveOrg(updated ?? organizations[0] ?? null);
      } else if (organizations.length > 0) {
        setActiveOrg(organizations[0]);
      }
    } catch (err) {
      console.error("[auth] refreshOrgs:", err.message);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        orgs,
        activeOrg,
        loading,
        authError,
        isOffline,
        setAuthError,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        switchOrg,
        refreshOrgs,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  return ctx;
};
