/**
 * screens/HostSetupScreen.jsx
 *
 * Configuração de sala — Kiwii Design System v3.0
 * Unifica Prioridades Altas (Intercalação, Guichês, Responsável/RBAC)
 * e Médias (Template persistente da instituição, Campos personalizados).
 */
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  User,
  X,
  AlertTriangle,
  Loader2,
  Plus,
  Shuffle,
  Save,
  Check,
  Clock,
  Layers,
} from "lucide-react";
import { apiFetch, fetchQueueTemplate, saveQueueTemplate } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

const PRIORITY_OPTIONS = [
  { value: 3, label: "Alta", color: "var(--danger)" },
  { value: 2, label: "Média", color: "var(--warn)" },
  { value: 1, label: "Baixa", color: "var(--success)" },
];

const ROLE_LABELS = { owner: "Dono", admin: "Admin", operator: "Operador" };

const FIELD_TYPES = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "select", label: "Seleção (lista)" },
  { value: "checkbox", label: "Sim/Não" },
];

const getPriority = (p) => PRIORITY_OPTIONS.find((o) => o.value === p) || PRIORITY_OPTIONS[2];
const genId = () => Math.random().toString(36).slice(2, 9);

const PriorityDot = ({ color }) => (
  <span
    style={{
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: color,
      display: "inline-block",
      flexShrink: 0,
    }}
  />
);

const HostSetupScreen = ({ onRoomCreated, onBack }) => {
  const { user, activeOrg } = useAuth();
  const operatorName = user?.profile?.name ?? user?.email ?? "";

  const [roomName, setRoomName] = useState("");
  const [priorityBatchSize, setPriorityBatchSize] = useState(3);

  const [categories, setCategories] = useState(() => {
    try {
      if (activeOrg?.id) {
        const saved = localStorage.getItem(`kiwii_org_template_${activeOrg.id}`);
        if (saved) return JSON.parse(saved);
      }
    } catch {}
    return [
      { name: "Atendimento Geral", priority: 1, tma: 10 },
      { name: "Prioritário", priority: 3, tma: 5 },
    ];
  });
  const [newCat, setNewCat] = useState({ name: "", priority: 2, tma: 5 });

  const [counters, setCounters] = useState([{ id: genId(), name: "Guichê 1" }]);
  const [newCounterName, setNewCounterName] = useState("");

  const [customFields, setCustomFields] = useState([]);
  const [newField, setNewField] = useState({
    label: "",
    type: "text",
    required: false,
    options: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedTemplateMsg, setSavedTemplateMsg] = useState(false);

  // Carrega modelo persistente da instituição (Média 2)
  useEffect(() => {
    if (!activeOrg?.id) return;
    let isMounted = true;
    fetchQueueTemplate(activeOrg.id)
      .then((data) => {
        if (!isMounted) return;
        const cats = data?.categories || data;
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
  };

  const removeCategory = (index) => {
    setCategories(categories.filter((_, i) => i !== index));
  };

  const addCounter = () => {
    if (!newCounterName.trim()) return;
    setCounters([...counters, { id: genId(), name: newCounterName.trim() }]);
    setNewCounterName("");
  };

  const removeCounter = (id) => {
    setCounters(counters.filter((c) => c.id !== id));
  };

  const addField = () => {
    if (!newField.label.trim()) return;
    setCustomFields([
      ...customFields,
      {
        id: genId(),
        label: newField.label.trim(),
        type: newField.type,
        required: newField.required,
        options:
          newField.type === "select"
            ? newField.options.split(",").map((o) => o.trim()).filter(Boolean)
            : undefined,
      },
    ]);
    setNewField({ label: "", type: "text", required: false, options: "" });
  };

  const removeField = (id) => {
    setCustomFields(customFields.filter((f) => f.id !== id));
  };

  const createRoom = async () => {
    if (!activeOrg) {
      setError("Selecione uma organização antes de criar uma sala.");
      return;
    }
    if (!roomName.trim()) {
      setError("Nome da sala é obrigatório.");
      return;
    }
    if (categories.length === 0) {
      setError("Adicione ao menos uma categoria.");
      return;
    }
    if (counters.length === 0) {
      setError("Adicione ao menos um guichê.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      // Salva template no banco e localmente em segundo plano
      saveQueueTemplate(activeOrg.id, categories).catch(() => {});
      try {
        localStorage.setItem(
          `kiwii_org_template_${activeOrg.id}`,
          JSON.stringify(categories)
        );
      } catch {}

      const data = await apiFetch("/api/rooms", {
        method: "POST",
        orgId: activeOrg.id,
        body: JSON.stringify({
          name: roomName.trim(),
          categories,
          counters,
          customFields,
          priorityBatchSize: Math.max(0, parseInt(priorityBatchSize, 10) || 0),
        }),
      });

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
        padding: "24px",
        maxWidth: "640px",
        margin: "0 auto",
      }}
    >
      <div className="animate-fade">
        {/* Header */}
        <div style={{ paddingTop: "16px", marginBottom: "28px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="display" style={{ fontSize: "18px", fontWeight: 800 }}>
                Kiwi<span style={{ color: "var(--accent)" }}>i</span>
              </span>
              <span className="tag">Host</span>
            </div>
            <button className="btn" onClick={onBack} style={{ padding: "7px 14px", fontSize: "13px" }}>
              <ArrowLeft size={14} /> Voltar
            </button>
          </div>
          <h1 style={{ fontSize: "1.5rem" }}>Configurar Sala</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
            Defina guichês, categorias, prioridades e dados exigidos dos clientes
          </p>
        </div>

        {/* Quem está operando — vem da conta logada (Alta 4) */}
        <div className="card" style={{ padding: "18px", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <User size={15} color="var(--text-muted)" />
            <p
              className="mono"
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Responsável pela Sala
            </p>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: "14px" }}>{operatorName}</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {activeOrg?.name || "Nenhuma organização selecionada"}
              </div>
            </div>
            {activeOrg && (
              <span className="tag" style={{ fontSize: "11px" }}>
                {ROLE_LABELS[activeOrg.role] || activeOrg.role}
              </span>
            )}
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "10px" }}>
            Suas ações ficam registradas nos logs de auditoria (visíveis para Dono e Admin).
          </p>
        </div>

        {/* Nome da sala */}
        <div style={{ marginBottom: "24px" }}>
          <label
            className="mono"
            style={{
              display: "block",
              fontSize: "11px",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: "8px",
            }}
          >
            Nome da Sala
          </label>
          <input
            className="input"
            placeholder="ex: Clínica Central — Turno Manhã"
            value={roomName}
            onChange={(e) => {
              setRoomName(e.target.value);
              setError("");
            }}
          />
        </div>

        {/* Regra de intercalação de prioridade (Alta 1) */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <Shuffle size={15} color="var(--text-muted)" />
            <label
              className="mono"
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Regra de Prioridade Intercalada
            </label>
          </div>
          <div
            className="card"
            style={{ padding: "16px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}
          >
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>A cada</span>
            <input
              className="input"
              type="number"
              min={0}
              max={50}
              value={priorityBatchSize}
              onChange={(e) => setPriorityBatchSize(e.target.value)}
              style={{ width: "72px", textAlign: "center" }}
            />
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              atendidos de prioridade <strong style={{ color: "var(--danger)" }}>alta</strong>, chamar 1
              de prioridade <strong style={{ color: "var(--warn)" }}>normal / média</strong> antes de
              voltar.
            </span>
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "8px" }}>
            Evita que a fila normal fique indefinidamente bloqueada por chegadas contínuas de alta prioridade. Use{" "}
            <strong>0</strong> para prioridade estrita tradicional.
          </p>
        </div>

        {/* Categorias (Alta 1 & Média 2) */}
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <label
              className="mono"
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Categorias de Atendimento
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {savedTemplateMsg && (
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--success)",
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
                title="Salvar categorias atuais como modelo padrão da instituição"
              >
                <Save size={12} /> Salvar como Padrão
              </button>
              <span className="tag">{categories.length}</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
            {categories.map((cat, i) => {
              const p = getPriority(cat.priority);
              return (
                <div
                  key={i}
                  className="card animate-slide"
                  style={{
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    animationDelay: `${i * 0.04}s`,
                  }}
                >
                  <PriorityDot color={p.color} />
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", minWidth: "42px" }}>
                    {p.label}
                  </span>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: "14px" }}>{cat.name}</span>
                  <span className="mono" style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                    ~{cat.tma}min
                  </span>
                  <button
                    className="btn"
                    onClick={() => removeCategory(i)}
                    style={{ padding: "6px", color: "var(--danger)", background: "transparent", border: "none" }}
                    aria-label="Remover categoria"
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="card" style={{ padding: "16px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 110px 80px",
                gap: "10px",
                alignItems: "end",
                marginBottom: "10px",
              }}
            >
              <div>
                <label
                  className="mono"
                  style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}
                >
                  Nome
                </label>
                <input
                  className="input"
                  placeholder="ex: Retorno, Consulta..."
                  value={newCat.name}
                  onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && addCategory()}
                />
              </div>
              <div>
                <label
                  className="mono"
                  style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}
                >
                  Prioridade
                </label>
                <select
                  className="input"
                  value={newCat.priority}
                  onChange={(e) => setNewCat({ ...newCat, priority: parseInt(e.target.value, 10) })}
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
                  className="mono"
                  style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}
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
                    setNewCat({ ...newCat, tma: Math.max(1, parseInt(e.target.value, 10) || 1) })
                  }
                />
              </div>
            </div>
            <button
              className="btn"
              onClick={addCategory}
              style={{ width: "100%", padding: "10px", fontSize: "13px" }}
            >
              <Plus size={15} /> Adicionar Categoria
            </button>
          </div>
        </div>

        {/* Guichês / Balcões (Alta 5) */}
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <label
              className="mono"
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Guichês / Balcões de Atendimento
            </label>
            <span className="tag">{counters.length}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
            {counters.map((c) => (
              <div
                key={c.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  padding: "8px 12px",
                  borderRadius: "999px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontWeight: 600,
                  fontSize: "13px",
                }}
              >
                {c.name}
                {counters.length > 1 && (
                  <button
                    onClick={() => removeCounter(c.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--danger)",
                      cursor: "pointer",
                      display: "flex",
                      padding: 0,
                    }}
                    aria-label="Remover guichê"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              className="input"
              placeholder="ex: Balcão 2, Guichê Preferencial..."
              value={newCounterName}
              onChange={(e) => setNewCounterName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCounter()}
            />
            <button
              className="btn"
              onClick={addCounter}
              style={{ padding: "0 20px", fontSize: "13px", whiteSpace: "nowrap" }}
            >
              <Plus size={15} /> Adicionar
            </button>
          </div>
        </div>

        {/* Campos personalizados no Check-in (Média 5) */}
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <label
              className="mono"
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Campos Personalizados no Check-in
            </label>
            <span className="tag">{customFields.length}</span>
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-dim)", marginBottom: "12px" }}>
            Além do nome, você pode solicitar dados complementares (idade, CPF, tipo de exame...) no check-in do cliente.
          </p>

          {customFields.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
              {customFields.map((f) => (
                <div
                  key={f.id}
                  className="card"
                  style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <span className="tag" style={{ minWidth: "84px", justifyContent: "center" }}>
                    {FIELD_TYPES.find((t) => t.value === f.type)?.label}
                  </span>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: "13px" }}>{f.label}</span>
                  {f.required && (
                    <span
                      className="tag"
                      style={{
                        background: "var(--danger-glow)",
                        color: "var(--danger)",
                        borderColor: "var(--danger-glow)",
                        fontSize: "10px",
                      }}
                    >
                      Obrigatório
                    </span>
                  )}
                  <button
                    className="btn"
                    onClick={() => removeField(f.id)}
                    style={{ padding: "6px", color: "var(--danger)", background: "transparent", border: "none" }}
                    aria-label="Remover campo"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="card" style={{ padding: "16px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 130px",
                gap: "10px",
                marginBottom: "10px",
              }}
            >
              <div>
                <label
                  className="mono"
                  style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}
                >
                  Rótulo do Campo
                </label>
                <input
                  className="input"
                  placeholder="ex: Idade, CPF, Documento..."
                  value={newField.label}
                  onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                />
              </div>
              <div>
                <label
                  className="mono"
                  style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}
                >
                  Tipo
                </label>
                <select
                  className="input"
                  value={newField.type}
                  onChange={(e) => setNewField({ ...newField, type: e.target.value })}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {newField.type === "select" && (
              <div style={{ marginBottom: "10px" }}>
                <label
                  className="mono"
                  style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}
                >
                  Opções (separadas por vírgula)
                </label>
                <input
                  className="input"
                  placeholder="ex: Sim, Não, Não sei"
                  value={newField.options}
                  onChange={(e) => setNewField({ ...newField, options: e.target.value })}
                />
              </div>
            )}

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "12px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={newField.required}
                onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
              />
              <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Obrigatório</span>
            </label>

            <button
              className="btn"
              onClick={addField}
              style={{ width: "100%", padding: "10px", fontSize: "13px" }}
            >
              <Plus size={15} /> Adicionar Campo
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--danger-glow)",
              border: "1px solid var(--danger-glow)",
              borderRadius: "8px",
              padding: "12px 16px",
              color: "var(--danger)",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            <AlertTriangle size={15} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={createRoom}
          disabled={loading}
          style={{ width: "100%", padding: "16px", fontSize: "15px" }}
        >
          {loading ? (
            <>
              <Loader2 size={17} className="spin" /> Criando Sala...
            </>
          ) : (
            <>
              <Layers size={17} /> Criar Sala e Abrir Fila
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default HostSetupScreen;
