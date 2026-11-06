/**
 * screens/HostSetupScreen.jsx
 *
 * Configuração de sala — Design System v3.0
 * Vinculada à organização ativa com ícones Lucide e zero emojis.
 */
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { createRoom, fetchQueueTemplate, saveQueueTemplate } from "../lib/api";
import {
  ArrowLeft,
  Plus,
  Trash2,
  AlertCircle,
  Clock,
  Sparkles,
  Layers,
  Save,
  Check,
} from "lucide-react";

const PRIORITY_OPTIONS = [
  { value: 3, label: "Alta", color: "var(--priority-high)", bg: "var(--priority-high-bg)", border: "rgba(248,113,113,0.3)" },
  { value: 2, label: "Média", color: "var(--priority-med)", bg: "var(--priority-med-bg)", border: "rgba(251,191,36,0.3)" },
  { value: 1, label: "Baixa", color: "var(--priority-low)", bg: "var(--priority-low-bg)", border: "rgba(52,211,153,0.3)" },
];

const getPriority = (p) => PRIORITY_OPTIONS.find((o) => o.value === p) || PRIORITY_OPTIONS[2];

const HostSetupScreen = ({ onRoomCreated, onBack }) => {
  const { activeOrg } = useAuth();

  const [roomName, setRoomName] = useState("");
  const [categories, setCategories] = useState(() => {
    try {
      if (activeOrg?.id) {
        const saved = localStorage.getItem(`kiwii_org_template_${activeOrg.id}`);
        if (saved) return JSON.parse(saved);
      }
    } catch {}
    return [
      { name: "Emergência", priority: 3, tma: 3 },
      { name: "Consulta", priority: 2, tma: 8 },
      { name: "Informação", priority: 1, tma: 5 },
    ];
  });
  const [newCat, setNewCat] = useState({ name: "", priority: 2, tma: 5 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedTemplateMsg, setSavedTemplateMsg] = useState(false);

  // Carrega modelo persistente da instituição (M2)
  useEffect(() => {
    if (!activeOrg?.id) return;
    let isMounted = true;
    fetchQueueTemplate(activeOrg.id)
      .then((data) => {
        if (!isMounted) return;
        const cats = data.categories || data;
        if (Array.isArray(cats) && cats.length > 0) {
          setCategories(cats);
          try {
            localStorage.setItem(
              `kiwii_org_template_${activeOrg.id}`,
              JSON.stringify(cats)
            );
          } catch {}
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [activeOrg?.id]);

  const handleSaveAsDefault = async () => {
    if (!activeOrg?.id || categories.length === 0) return;
    try {
      await saveQueueTemplate(activeOrg.id, categories);
      localStorage.setItem(
        `kiwii_org_template_${activeOrg.id}`,
        JSON.stringify(categories)
      );
      setSavedTemplateMsg(true);
      setTimeout(() => setSavedTemplateMsg(false), 2500);
    } catch (err) {
      setError("Erro ao salvar padrão: " + err.message);
    }
  };

  const addCategory = () => {
    if (!newCat.name.trim()) return;
    if (categories.find((c) => c.name.toLowerCase() === newCat.name.toLowerCase())) {
      setError("Já existe uma categoria com esse nome.");
      return;
    }
    const updated = [...categories, { ...newCat, name: newCat.name.trim() }];
    setCategories(updated);
    setNewCat({ name: "", priority: 2, tma: 5 });
    setError("");
    if (activeOrg?.id) {
      try {
        localStorage.setItem(`kiwii_org_template_${activeOrg.id}`, JSON.stringify(updated));
      } catch {}
    }
  };

  const removeCategory = (index) => {
    const updated = categories.filter((_, i) => i !== index);
    setCategories(updated);
    if (activeOrg?.id) {
      try {
        localStorage.setItem(`kiwii_org_template_${activeOrg.id}`, JSON.stringify(updated));
      } catch {}
    }
  };

  const handleCreate = async () => {
    if (!roomName.trim()) {
      setError("Nome da sala é obrigatório.");
      return;
    }
    if (categories.length === 0) {
      setError("Adicione ao menos uma categoria.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      // Salva template no banco e localmente para uso futuro nesta instituição
      saveQueueTemplate(activeOrg.id, categories).catch(() => {});
      try {
        localStorage.setItem(
          `kiwii_org_template_${activeOrg.id}`,
          JSON.stringify(categories)
        );
      } catch {}

      const data = await createRoom(activeOrg.id, { name: roomName.trim(), categories });
      onRoomCreated(data.code, data.room);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        padding: "32px 24px",
        maxWidth: "640px",
        margin: "0 auto",
      }}
    >
      <div className="animate-fade">
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "18px", fontWeight: 800 }}>
                fila<span style={{ color: "var(--primary)" }}>.io</span>
              </span>
              <span className="tag" style={{ textTransform: "uppercase" }}>
                {activeOrg?.name}
              </span>
            </div>
            <button
              className="btn btn-secondary"
              onClick={onBack}
              style={{ fontSize: "12px", padding: "6px 12px", gap: "6px" }}
            >
              <ArrowLeft size={14} /> Voltar
            </button>
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, margin: "0 0 6px" }}>
            Configurar Sala
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: 0 }}>
            Defina o nome da sala, categorias de atendimento e tempos médios estimados.
          </p>
        </div>

        {/* Nome da sala */}
        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "8px",
            }}
          >
            Nome da Sala
          </label>
          <input
            className="input"
            placeholder="Ex: Clínica Central — Triagem Geral"
            value={roomName}
            onChange={(e) => {
              setRoomName(e.target.value);
              setError("");
            }}
          />
        </div>

        {/* Lista de categorias */}
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "10px",
            }}
          >
            <label
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Categorias de Atendimento
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {savedTemplateMsg && (
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--priority-low)",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontWeight: 600,
                  }}
                >
                  <Check size={14} /> Padrão salvo!
                </span>
              )}
              <button
                type="button"
                onClick={handleSaveAsDefault}
                className="btn btn-secondary"
                style={{ fontSize: "11px", padding: "4px 10px", gap: "5px" }}
                title="Salvar modelo atual como padrão desta instituição"
              >
                <Save size={12} /> Salvar como Padrão
              </button>
              <span className="tag">{categories.length} configuradas</span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginBottom: "16px",
            }}
          >
            {categories.map((cat, i) => {
              const p = getPriority(cat.priority);
              return (
                <div
                  key={i}
                  className="card"
                  style={{
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    background: "var(--surface)",
                  }}
                >
                  <span
                    style={{
                      background: p.bg,
                      color: p.color,
                      border: `1px solid ${p.border}`,
                      borderRadius: "6px",
                      padding: "3px 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      minWidth: "64px",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: p.color,
                      }}
                    />
                    {p.label}
                  </span>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: "14px", color: "var(--text)" }}>
                    {cat.name}
                  </span>
                  <span
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Clock size={13} style={{ color: "var(--text-dim)" }} /> ~{cat.tma} min
                  </span>
                  <button
                    onClick={() => removeCategory(i)}
                    style={{
                      background: "transparent",
                      color: "var(--text-dim)",
                      border: "none",
                      padding: "6px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      display: "flex",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--danger)";
                      e.currentTarget.style.background = "var(--danger-muted)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--text-dim)";
                      e.currentTarget.style.background = "transparent";
                    }}
                    title="Remover categoria"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Adicionar categoria */}
          <div
            className="card"
            style={{
              padding: "18px",
              background: "var(--surface-alt)",
              border: "1px dashed var(--border)",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--primary)",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <Plus size={14} /> Nova Categoria
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 120px 90px",
                gap: "10px",
                alignItems: "end",
                marginBottom: "12px",
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: "11px",
                    color: "var(--text-secondary)",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Nome
                </label>
                <input
                  className="input"
                  placeholder="Ex: Retorno"
                  value={newCat.name}
                  onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && addCategory()}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: "11px",
                    color: "var(--text-secondary)",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Prioridade
                </label>
                <select
                  className="input"
                  value={newCat.priority}
                  onChange={(e) => setNewCat({ ...newCat, priority: parseInt(e.target.value) })}
                >
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: "11px",
                    color: "var(--text-secondary)",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  TMA (min)
                </label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={120}
                  value={newCat.tma}
                  onChange={(e) =>
                    setNewCat({
                      ...newCat,
                      tma: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                />
              </div>
            </div>
            <button
              className="btn btn-secondary"
              onClick={addCategory}
              style={{ width: "100%", padding: "10px", gap: "6px" }}
            >
              <Plus size={14} /> Adicionar Categoria
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: "var(--danger-muted)",
              border: "1px solid var(--danger-border)",
              borderRadius: "8px",
              padding: "12px 16px",
              color: "var(--danger)",
              fontSize: "13px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={handleCreate}
          disabled={loading}
          style={{
            width: "100%",
            padding: "16px",
            fontSize: "15px",
            fontWeight: 700,
            gap: "8px",
          }}
        >
          {loading ? (
            <>Criando Sala...</>
          ) : (
            <>
              <Layers size={18} /> Criar Sala e Abrir Fila
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default HostSetupScreen;
