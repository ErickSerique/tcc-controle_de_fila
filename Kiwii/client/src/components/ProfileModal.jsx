import { useState, useEffect } from "react";
import {
  User,
  Lock,
  Mail,
  Shield,
  Trash2,
  Check,
  AlertTriangle,
  Eye,
  EyeOff,
  Building,
  X,
} from "lucide-react";
import Modal from "./Modal";
import { useAuth } from "../hooks/useAuth";

const ROLE_LABELS = {
  owner: "Proprietário",
  admin: "Administrador",
  operator: "Operador",
};

const ProfileModal = ({ open, onClose }) => {
  const { user, activeOrg, isOffline, updateProfileName, changePassword, deleteAccount } =
    useAuth();

  const [activeTab, setActiveTab] = useState("profile"); // 'profile' | 'password' | 'danger'

  // ── Tab 1: Nome do perfil ──
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState("");

  // ── Tab 2: Troca de senha ──
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [passSuccess, setPassSuccess] = useState(false);
  const [passError, setPassError] = useState("");

  // ── Tab 3: Exclusão de conta ──
  const [deletePass, setDeletePass] = useState("");
  const [showDeletePass, setShowDeletePass] = useState(false);
  const [confirmDeleteChecked, setConfirmDeleteChecked] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    if (open && user) {
      setName(user.profile?.name ?? user.email?.split("@")[0] ?? "");
      setNameSuccess(false);
      setNameError("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPassSuccess(false);
      setPassError("");
      setDeletePass("");
      setConfirmDeleteChecked(false);
      setDeleteError("");
      setShowConfirmDialog(false);
    }
  }, [open, user]);

  const handleSaveName = async (e) => {
    e.preventDefault();
    setNameError("");
    setNameSuccess(false);

    if (!name.trim() || name.trim().length < 2) {
      setNameError("O nome deve ter no mínimo 2 caracteres.");
      return;
    }

    setSavingName(true);
    try {
      await updateProfileName(name.trim());
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 4000);
    } catch (err) {
      setNameError(err.message || "Erro ao atualizar nome.");
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassError("");
    setPassSuccess(false);

    if (!currentPassword) {
      setPassError("Informe sua senha atual.");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPassError("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError("A nova senha e a confirmação não coincidem.");
      return;
    }
    if (currentPassword === newPassword) {
      setPassError("A nova senha deve ser diferente da senha atual.");
      return;
    }

    setSavingPass(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPassSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPassSuccess(false), 5000);
    } catch (err) {
      setPassError(err.message || "Falha ao alterar senha.");
    } finally {
      setSavingPass(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError("");
    if (!confirmDeleteChecked) {
      setDeleteError("Marque a caixa confirmando que está ciente da exclusão.");
      return;
    }
    if (!isOffline && !deletePass) {
      setDeleteError("Informe sua senha atual para confirmar a exclusão da conta.");
      return;
    }

    setDeleting(true);
    try {
      await deleteAccount(deletePass);
      onClose();
    } catch (err) {
      setDeleteError(err.message || "Erro ao excluir conta.");
      setShowConfirmDialog(false);
    } finally {
      setDeleting(false);
    }
  };

  const initialLetter = (user?.profile?.name || user?.email || "U")
    .trim()[0]
    .toUpperCase();

  return (
    <Modal open={open} onClose={onClose} maxWidth="560px">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%)",
              color: "#03171F",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              fontWeight: 800,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            {initialLetter}
          </div>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>
              {user?.profile?.name || user?.email}
            </h2>
            <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
              Configurações e Perfil da Conta
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="btn btn-secondary"
          style={{ padding: "6px 8px", borderRadius: "50%" }}
          aria-label="Fechar modal"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Navegação por Abas ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "6px",
          background: "var(--surface)",
          padding: "4px",
          borderRadius: "10px",
          marginBottom: "24px",
          border: "1px solid var(--border)",
        }}
      >
        <button
          onClick={() => setActiveTab("profile")}
          style={{
            padding: "8px 12px",
            fontSize: "13px",
            fontWeight: 600,
            borderRadius: "7px",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            background: activeTab === "profile" ? "var(--surface-hover)" : "transparent",
            color: activeTab === "profile" ? "var(--text)" : "var(--text-muted)",
            boxShadow: activeTab === "profile" ? "0 2px 6px rgba(0,0,0,0.1)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          <User size={15} /> Dados
        </button>
        <button
          onClick={() => setActiveTab("password")}
          style={{
            padding: "8px 12px",
            fontSize: "13px",
            fontWeight: 600,
            borderRadius: "7px",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            background: activeTab === "password" ? "var(--surface-hover)" : "transparent",
            color: activeTab === "password" ? "var(--text)" : "var(--text-muted)",
            boxShadow: activeTab === "password" ? "0 2px 6px rgba(0,0,0,0.1)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          <Lock size={15} /> Senha
        </button>
        <button
          onClick={() => setActiveTab("danger")}
          style={{
            padding: "8px 12px",
            fontSize: "13px",
            fontWeight: 600,
            borderRadius: "7px",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            background: activeTab === "danger" ? "rgba(239, 68, 68, 0.15)" : "transparent",
            color: activeTab === "danger" ? "var(--danger)" : "var(--text-muted)",
            boxShadow: activeTab === "danger" ? "0 2px 6px rgba(0,0,0,0.1)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          <Trash2 size={15} /> Excluir
        </button>
      </div>

      {/* ── ABA 1: DADOS DO PERFIL ── */}
      {activeTab === "profile" && (
        <form onSubmit={handleSaveName} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 600 }}>
              E-mail da Conta (Não editável)
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 14px",
                background: "var(--surface)",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
                fontSize: "14px",
              }}
            >
              <Mail size={16} />
              <span className="mono" style={{ fontSize: "13px" }}>{user?.email}</span>
            </div>
          </div>

          <div>
            <label htmlFor="profile-name" style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 600 }}>
              Nome Completo
            </label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Carlos Oliveira"
              className="input"
              style={{ width: "100%", padding: "10px 14px", fontSize: "14px" }}
              disabled={savingName}
              required
            />
          </div>

          {activeOrg && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                borderRadius: "8px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                fontSize: "13px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text)" }}>
                <Building size={16} color="var(--accent)" />
                <span>{activeOrg.name}</span>
              </div>
              <span className="tag" style={{ background: "var(--accent-glow)", color: "var(--accent)", fontSize: "11px" }}>
                <Shield size={11} style={{ marginRight: "4px" }} />
                {ROLE_LABELS[activeOrg.role] || activeOrg.role}
              </span>
            </div>
          )}

          {nameSuccess && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: "var(--success-glow, rgba(16, 185, 129, 0.15))",
                border: "1px solid var(--success)",
                color: "var(--success)",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Check size={16} /> Nome atualizado com sucesso!
            </div>
          )}

          {nameError && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: "var(--danger-glow, rgba(239, 68, 68, 0.15))",
                border: "1px solid var(--danger)",
                color: "var(--danger)",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertTriangle size={16} /> {nameError}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={savingName || !name.trim()}
            style={{ width: "100%", padding: "12px", marginTop: "8px", fontSize: "14px", fontWeight: 700 }}
          >
            {savingName ? "Salvando..." : "Salvar Nome"}
          </button>
        </form>
      )}

      {/* ── ABA 2: SEGURANÇA & SENHA ── */}
      {activeTab === "password" && (
        <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
            Para alterar sua senha, informe sua senha atual e digite a nova senha desejada.
          </p>

          <div>
            <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 600 }}>
              Senha Atual
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showCurrentPass ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Digite sua senha atual"
                className="input"
                style={{ width: "100%", padding: "10px 40px 10px 14px", fontSize: "14px" }}
                disabled={savingPass}
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPass(!showCurrentPass)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                }}
              >
                {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 600 }}>
              Nova Senha (Mínimo de 6 caracteres)
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showNewPass ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite sua nova senha"
                className="input"
                style={{ width: "100%", padding: "10px 40px 10px 14px", fontSize: "14px" }}
                disabled={savingPass}
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                }}
              >
                {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 600 }}>
              Confirmar Nova Senha
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showConfirmPass ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="input"
                style={{ width: "100%", padding: "10px 40px 10px 14px", fontSize: "14px" }}
                disabled={savingPass}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                }}
              >
                {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {passSuccess && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: "var(--success-glow, rgba(16, 185, 129, 0.15))",
                border: "1px solid var(--success)",
                color: "var(--success)",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Check size={16} /> Senha alterada com sucesso!
            </div>
          )}

          {passError && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: "var(--danger-glow, rgba(239, 68, 68, 0.15))",
                border: "1px solid var(--danger)",
                color: "var(--danger)",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertTriangle size={16} /> {passError}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={savingPass || !currentPassword || !newPassword || !confirmPassword}
            style={{ width: "100%", padding: "12px", marginTop: "8px", fontSize: "14px", fontWeight: 700 }}
          >
            {savingPass ? "Atualizando Senha..." : "Trocar Senha"}
          </button>
        </form>
      )}

      {/* ── ABA 3: ZONA DE PERIGO (EXCLUIR CONTA) ── */}
      {activeTab === "danger" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              padding: "16px",
              borderRadius: "10px",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--danger)", fontWeight: 700, fontSize: "14px" }}>
              <AlertTriangle size={18} />
              Atenção: Ação Irreversível
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
              Ao excluir sua conta, seu perfil, configurações pessoais e acessos às instituições serão removidos permanentemente.
            </p>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 600 }}>
              Digite sua senha atual para autorizar a exclusão:
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showDeletePass ? "text" : "password"}
                value={deletePass}
                onChange={(e) => setDeletePass(e.target.value)}
                placeholder="Sua senha atual"
                className="input"
                style={{ width: "100%", padding: "10px 40px 10px 14px", fontSize: "14px" }}
                disabled={deleting}
              />
              <button
                type="button"
                onClick={() => setShowDeletePass(!showDeletePass)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                }}
              >
                {showDeletePass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              fontSize: "13px",
              color: "var(--text)",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={confirmDeleteChecked}
              onChange={(e) => setConfirmDeleteChecked(e.target.checked)}
              style={{ marginTop: "3px" }}
            />
            <span>Estou ciente de que todos os meus dados serão permanentemente excluídos e não poderão ser recuperados.</span>
          </label>

          {deleteError && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: "var(--danger-glow, rgba(239, 68, 68, 0.15))",
                border: "1px solid var(--danger)",
                color: "var(--danger)",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertTriangle size={16} /> {deleteError}
            </div>
          )}

          {!showConfirmDialog ? (
            <button
              type="button"
              onClick={() => {
                if (!confirmDeleteChecked) {
                  setDeleteError("Marque a caixa de confirmação antes de prosseguir.");
                  return;
                }
                if (!isOffline && !deletePass) {
                  setDeleteError("Informe sua senha atual para continuar.");
                  return;
                }
                setDeleteError("");
                setShowConfirmDialog(true);
              }}
              className="btn"
              disabled={deleting || !confirmDeleteChecked || (!isOffline && !deletePass)}
              style={{
                width: "100%",
                padding: "12px",
                background: "var(--danger)",
                color: "#ffffff",
                borderColor: "var(--danger)",
                fontSize: "14px",
                fontWeight: 700,
                marginTop: "8px",
              }}
            >
              Excluir Minha Conta Permanentemente
            </button>
          ) : (
            <div
              style={{
                padding: "16px",
                borderRadius: "8px",
                background: "var(--surface)",
                border: "2px solid var(--danger)",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                marginTop: "8px",
              }}
            >
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--danger)" }}>
                Confirmação Final: Tem certeza absoluta?
              </div>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
                Não haverá como reverter esta ação. Sua conta será cancelada imediatamente.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowConfirmDialog(false)}
                  className="btn btn-secondary"
                  disabled={deleting}
                  style={{ padding: "10px" }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  className="btn"
                  disabled={deleting}
                  style={{
                    padding: "10px",
                    background: "var(--danger)",
                    color: "#fff",
                    fontWeight: 700,
                  }}
                >
                  {deleting ? "Excluindo..." : "Sim, Excluir Conta"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default ProfileModal;
