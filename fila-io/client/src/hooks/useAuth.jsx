/**
 * client/src/hooks/useAuth.jsx
 *
 * Context + hook de autenticação com suporte offline.
 *
 * Gerencia:
 *   - Sessão Supabase (login, logout, magic link)
 *   - Sessão local JWT (fallback offline com sliding expiration)
 *   - Perfil do usuário (user_profiles)
 *   - Organização ativa e role do usuário
 *   - Sincronização de perfil após primeiro login
 */
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { syncProfile, fetchMe, setAuthToken, saveLocalSession, clearLocalSession, getLocalSession } from "../lib/api";
import { connectWithAuth, connectAnonymous } from "../lib/socket";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session,     setSession]     = useState(null);
  const [user,        setUser]        = useState(null);      // { id, email, profile }
  const [orgs,        setOrgs]        = useState([]);
  const [activeOrg,   setActiveOrg]   = useState(null);      // { id, name, role, ... }
  const [loading,     setLoading]     = useState(true);
  const [authError,   setAuthError]   = useState(null);
  const [isOffline,   setIsOffline]   = useState(false);     // indica se está operando offline

  // ── Carrega dados do usuário via sessão local (offline) ─────
  const loadFromLocalSession = useCallback(async () => {
    const localToken = getLocalSession();
    if (!localToken) return false;

    console.log("[auth] Tentando sessão local offline...");
    setAuthToken(null); // Sem token Supabase
    // O apiFetch vai usar getLocalSession() como fallback
    try {
      const { user: userData, organizations, localSession } = await fetchMe();

      // Sliding expiration: atualiza o token local
      if (localSession) saveLocalSession(localSession);

      setUser(userData);
      setOrgs(organizations);
      setIsOffline(true);

      // Conecta socket com token local
      connectWithAuth(localToken);

      // Restaura org ativa
      const savedOrgId = localStorage.getItem("fila_io_active_org");
      const restoredOrg = organizations.find((o) => o.id === savedOrgId) ?? organizations[0] ?? null;
      setActiveOrg(restoredOrg);

      console.log("[auth] Sessão local restaurada com sucesso. Modo OFFLINE.");
      return true;
    } catch (err) {
      console.warn("[auth] Sessão local falhou:", err.message);
      clearLocalSession();
      return false;
    }
  }, []);

  // ── Carrega dados do usuário após autenticação ──────────────
  const loadingRef = { current: false }; // guard contra chamadas concorrentes

  const loadUserData = useCallback(async (supabaseSession) => {
    console.log("[auth] loadUserData chamado, sessão:", supabaseSession ? "SIM" : "NÃO");

    if (!supabaseSession) {
      // Sem sessão Supabase — tentar sessão local (offline)
      const offlineOk = await loadFromLocalSession();
      if (!offlineOk) {
        console.log("[auth] Sem sessão — exibindo landing.");
        setAuthToken(null);
        setSession(null); setUser(null); setOrgs([]); setActiveOrg(null);
        setIsOffline(false);
      }
      setLoading(false);
      return;
    }

    // Guard: se já está carregando, não rodar de novo
    if (loadingRef.current) {
      console.log("[auth] loadUserData já em execução, ignorando chamada duplicada.");
      return;
    }
    loadingRef.current = true;

    setSession(supabaseSession);
    setAuthToken(supabaseSession.access_token);
    connectWithAuth(supabaseSession.access_token);
    setIsOffline(false);

    try {
      console.log("[auth] Chamando fetchMe()...");
      let { user: userData, organizations, localSession } = await fetchMe();
      console.log("[auth] fetchMe() retornou. Perfil:", userData.profile ? "SIM" : "NÃO");

      // Salva JWT local para uso offline futuro (sliding expiration)
      if (localSession) {
        saveLocalSession(localSession);
        console.log("[auth] Sessão local salva para uso offline.");
      }

      // Perfil não existe ainda (primeiro login) — cria via metadata do Supabase
      if (!userData.profile) {
        const name = supabaseSession.user.user_metadata?.full_name
                  || supabaseSession.user.email?.split("@")[0]
                  || "Usuário";
        
        console.log("[auth] Criando perfil para:", name);
        await syncProfile(name);
        
        // Busca novamente para pegar o perfil recém-criado
        const refreshed = await fetchMe();
        userData = refreshed.user;
        organizations = refreshed.organizations;
        if (refreshed.localSession) saveLocalSession(refreshed.localSession);
      }

      setUser(userData);
      setOrgs(organizations);

      // Restaura org ativa do localStorage
      const savedOrgId = localStorage.getItem("fila_io_active_org");
      const restoredOrg = organizations.find((o) => o.id === savedOrgId) ?? organizations[0] ?? null;
      setActiveOrg(restoredOrg);
      console.log("[auth] Dados carregados com sucesso. Orgs:", organizations.length);
    } catch (err) {
      console.error("[auth] Erro ao carregar sessão:", err.message);
      // Se o token expirou ou está inválido, faz logout limpo
      if (err.message?.includes("401") || err.message?.includes("Token") || err.message?.includes("expirado")) {
        console.warn("[auth] Token inválido — fazendo logout limpo.");
        setAuthToken(null);
        await supabase.auth.signOut().catch(() => {});
        setSession(null); setUser(null); setOrgs([]); setActiveOrg(null);
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [loadFromLocalSession]);

  // ── Listener do Supabase Auth ───────────────────────────────
  useEffect(() => {
    // Timeout de segurança: se após 8s ainda estiver loading, forçar saída
    const safetyTimeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn("[auth] Timeout de segurança atingido — forçando loading=false.");
          return false;
        }
        return prev;
      });
    }, 8000);

    supabase.auth.getSession().then(({ data }) => {
      console.log("[auth] getSession resolveu, sessão:", data.session ? "SIM" : "NÃO");
      loadUserData(data.session);
    }).catch((err) => {
      console.error("[auth] getSession falhou:", err.message);
      // Supabase inacessível — tentar sessão local
      loadFromLocalSession().then((ok) => {
        if (!ok) setLoading(false);
        else setLoading(false);
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        console.log("[auth] onAuthStateChange:", _event);
        await loadUserData(newSession);
      }
    );

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, [loadUserData, loadFromLocalSession]);

  // ── Ações ───────────────────────────────────────────────────
  const signInWithEmail = async (email, password) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setAuthError(error.message); return false; }
    return true;
  };

  const signUpWithEmail = async (email, password, name) => {
    setAuthError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) { setAuthError(error.message); return false; }
    return true;
  };

  const signInWithMagicLink = async (email) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) { setAuthError(error.message); return false; }
    return true;
  };

  const signOut = async () => {
    setAuthToken(null);
    clearLocalSession();
    connectAnonymous();
    setSession(null); setUser(null); setOrgs([]); setActiveOrg(null);
    setIsOffline(false);
    await supabase.auth.signOut().catch(() => {});
    localStorage.removeItem("fila_io_active_org");
  };

  const switchOrg = (org) => {
    setActiveOrg(org);
    localStorage.setItem("fila_io_active_org", org.id);
  };

  const refreshOrgs = async () => {
    try {
      const { user: userData, organizations, localSession } = await fetchMe();
      if (localSession) saveLocalSession(localSession);
      setUser(userData);
      setOrgs(organizations);
      if (activeOrg) {
        const updated = organizations.find((o) => o.id === activeOrg.id);
        setActiveOrg(updated ?? organizations[0] ?? null);
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
        signInWithMagicLink,
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
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
};
