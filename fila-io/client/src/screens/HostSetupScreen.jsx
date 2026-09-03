import { useState } from "react";

const PRIORITY_OPTIONS = [
  { value: 3, label: "🔴 Alta", color: "#F87171", bg: "#7f1d1d44" },
  { value: 2, label: "🟡 Média", color: "#FCD34D", bg: "#78350f44" },
  { value: 1, label: "🟢 Baixa", color: "#6EE7B7", bg: "#14532d44" },
];

const STAFF_ROLES = [
  { value: "owner", label: "Owner (Dono)" },
  { value: "admin", label: "Admin" },
  { value: "operator", label: "Operador" },
];

const FIELD_TYPES = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "select", label: "Seleção (lista)" },
  { value: "checkbox", label: "Sim/Não" },
];

const getPriority = (p) => PRIORITY_OPTIONS.find((o) => o.value === p) || PRIORITY_OPTIONS[2];
const genId = () => Math.random().toString(36).slice(2, 9);

const HostSetupScreen = ({ onRoomCreated, onBack }) => {
  // Identificação do operador — base para logs de auditoria e controle de acesso
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState("owner");

  const [roomName, setRoomName] = useState("");

  const [categories, setCategories] = useState([
    { name: "Emergência", priority: 3, tma: 3 },
    { name: "Consulta", priority: 2, tma: 8 },
    { name: "Informação", priority: 1, tma: 5 },
  ]);
  const [newCat, setNewCat] = useState({ name: "", priority: 2, tma: 5 });

  // Guichês / balcões
  const [counters, setCounters] = useState([{ id: genId(), name: "Guichê 1" }]);
  const [newCounterName, setNewCounterName] = useState("");

  // Campos personalizados de check-in
  const [customFields, setCustomFields] = useState([]);
  const [newField, setNewField] = useState({ label: "", type: "text", required: false, options: "" });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Categorias ──────────────────────────────────────────────
  const addCategory = () => {
    if (!newCat.name.trim()) return;
    if (categories.find((c) => c.name.toLowerCase() === newCat.name.toLowerCase())) {
      setError("Já existe uma categoria com esse nome.");
      return;
    }
    setCategories([...categories, { ...newCat, name: newCat.name.trim() }]);
    setNewCat({ name: "", priority: 2, tma: 5 });
    setError("");
  };
  const removeCategory = (index) => setCategories(categories.filter((_, i) => i !== index));

  // ── Guichês ─────────────────────────────────────────────────
  const addCounter = () => {
    if (!newCounterName.trim()) return;
    setCounters([...counters, { id: genId(), name: newCounterName.trim() }]);
    setNewCounterName("");
  };
  const removeCounter = (id) => setCounters(counters.filter((c) => c.id !== id));

  // ── Campos personalizados ───────────────────────────────────
  const addField = () => {
    if (!newField.label.trim()) return;
    setCustomFields([
      ...customFields,
      {
        id: genId(),
        label: newField.label.trim(),
        type: newField.type,
        required: newField.required,
        options: newField.type === "select"
          ? newField.options.split(",").map((o) => o.trim()).filter(Boolean)
          : undefined,
      },
    ]);
    setNewField({ label: "", type: "text", required: false, options: "" });
  };
  const removeField = (id) => setCustomFields(customFields.filter((f) => f.id !== id));

  // ── Criar sala ──────────────────────────────────────────────
  const createRoom = async () => {
    if (!staffName.trim()) { setError("Informe seu nome (operador responsável)."); return; }
    if (!roomName.trim()) { setError("Nome da sala é obrigatório."); return; }
    if (categories.length === 0) { setError("Adicione ao menos uma categoria."); return; }
    if (counters.length === 0) { setError("Adicione ao menos um guichê."); return; }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Actor-Name": staffName.trim(),
          "X-Actor-Role": staffRole,
        },
        body: JSON.stringify({ name: roomName.trim(), categories, counters, customFields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar sala.");

      // Persiste identidade do operador para uso no painel (logs, socket join)
      sessionStorage.setItem("staff_identity", JSON.stringify({ name: staffName.trim(), role: staffRole }));

      onRoomCreated(data.code, data.room);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "24px", maxWidth: "620px", margin: "0 auto" }}>
      <div className="animate-fade">
        {/* Header */}
        <div style={{ paddingTop: "16px", marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "20px", fontWeight: 800 }}>
                fila<span style={{ color: "var(--accent)" }}>.io</span>
              </span>
              <span className="tag" style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--accent-dim)" }}>HOST</span>
            </div>
            <button className="btn" onClick={onBack} style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", padding: "7px 14px", borderRadius: "8px", fontSize: "13px" }}>
              ← Voltar
            </button>
          </div>
          <h1 style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "-0.02em" }}>Configurar Sala</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
            Defina identidade, guichês, categorias e dados exigidos dos clientes
          </p>
        </div>

        {/* Identificação do operador */}
        <div className="card" style={{ padding: "18px", marginBottom: "24px", background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.2)" }}>
          <p className="mono" style={{ fontSize: "11px", color: "var(--purple)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            👤 Identificação do Operador
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: "10px" }}>
            <div>
              <label className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Seu Nome</label>
              <input className="input" placeholder="ex: Maria Silva" value={staffName} onChange={(e) => { setStaffName(e.target.value); setError(""); }} />
            </div>
            <div>
              <label className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Cargo</label>
              <select className="input" value={staffRole} onChange={(e) => setStaffRole(e.target.value)}>
                {STAFF_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "10px" }}>
            Usado nos logs de auditoria — apenas Owner/Admin podem visualizá-los depois.
          </p>
        </div>

        {/* Nome da sala */}
        <div style={{ marginBottom: "24px" }}>
          <label className="mono" style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
            Nome da Sala
          </label>
          <input className="input" placeholder="ex: Clínica Central — Turno Manhã" value={roomName} onChange={(e) => { setRoomName(e.target.value); setError(""); }} />
        </div>

        {/* Categorias */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <label className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Categorias de Atendimento</label>
            <span className="tag" style={{ background: "var(--accent-glow)", color: "var(--accent)" }}>{categories.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
            {categories.map((cat, i) => {
              const p = getPriority(cat.priority);
              return (
                <div key={i} className="card animate-slide" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px", animationDelay: `${i * 0.04}s` }}>
                  <span className="tag" style={{ background: p.bg, color: p.color, minWidth: "76px", justifyContent: "center" }}>{p.label}</span>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: "14px" }}>{cat.name}</span>
                  <span className="mono" style={{ color: "var(--text-muted)", fontSize: "12px" }}>~{cat.tma}min</span>
                  <button className="btn" onClick={() => removeCategory(i)} style={{ background: "transparent", color: "var(--danger)", fontSize: "18px", padding: "2px 6px", borderRadius: "6px", lineHeight: 1 }}>×</button>
                </div>
              );
            })}
          </div>
          <div className="card" style={{ padding: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 80px", gap: "10px", alignItems: "end", marginBottom: "10px" }}>
              <div>
                <label className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Nome</label>
                <input className="input" placeholder="ex: Retorno" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addCategory()} />
              </div>
              <div>
                <label className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Prioridade</label>
                <select className="input" value={newCat.priority} onChange={(e) => setNewCat({ ...newCat, priority: parseInt(e.target.value) })}>
                  {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>TMA (min)</label>
                <input className="input" type="number" min={1} max={120} value={newCat.tma} onChange={(e) => setNewCat({ ...newCat, tma: Math.max(1, parseInt(e.target.value) || 1) })} />
              </div>
            </div>
            <button className="btn" onClick={addCategory} style={{ width: "100%", padding: "10px", background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--accent-dim)", borderRadius: "8px", fontSize: "13px" }}>
              Adicionar Categoria
            </button>
          </div>
        </div>

        {/* Guichês */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <label className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Guichês / Balcões</label>
            <span className="tag" style={{ background: "var(--accent-glow)", color: "var(--accent)" }}>{counters.length}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
            {counters.map((c) => (
              <div key={c.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 12px", borderRadius: "999px", display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "13px" }}>
                {c.name}
                <button onClick={() => removeCounter(c.id)} style={{ background: "transparent", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "14px", lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input className="input" placeholder="ex: Balcão 3, Guichê Preferencial..." value={newCounterName} onChange={(e) => setNewCounterName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCounter()} />
            <button className="btn" onClick={addCounter} style={{ padding: "0 20px", background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--accent-dim)", borderRadius: "8px", fontSize: "13px", whiteSpace: "nowrap" }}>
              + Adicionar
            </button>
          </div>
        </div>

        {/* Campos personalizados */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <label className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Campos Personalizados no Check-in</label>
            <span className="tag" style={{ background: "var(--accent-glow)", color: "var(--accent)" }}>{customFields.length}</span>
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-dim)", marginBottom: "12px" }}>
            Além do nome, você pode exigir dados extras (CPF, alergias, telefone...) antes do cliente entrar na fila.
          </p>

          {customFields.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
              {customFields.map((f) => (
                <div key={f.id} className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="tag" style={{ background: "rgba(96,165,250,0.1)", color: "var(--info)", minWidth: "84px", justifyContent: "center" }}>
                    {FIELD_TYPES.find((t) => t.value === f.type)?.label}
                  </span>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: "13px" }}>{f.label}</span>
                  {f.required && <span className="tag" style={{ background: "#7f1d1d33", color: "var(--danger)", fontSize: "10px" }}>Obrigatório</span>}
                  <button className="btn" onClick={() => removeField(f.id)} style={{ background: "transparent", color: "var(--danger)", fontSize: "18px", padding: "2px 6px" }}>×</button>
                </div>
              ))}
            </div>
          )}

          <div className="card" style={{ padding: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: "10px", marginBottom: "10px" }}>
              <div>
                <label className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Rótulo do Campo</label>
                <input className="input" placeholder="ex: CPF, Alergias..." value={newField.label} onChange={(e) => setNewField({ ...newField, label: e.target.value })} />
              </div>
              <div>
                <label className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Tipo</label>
                <select className="input" value={newField.type} onChange={(e) => setNewField({ ...newField, type: e.target.value })}>
                  {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            {newField.type === "select" && (
              <div style={{ marginBottom: "10px" }}>
                <label className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Opções (separadas por vírgula)</label>
                <input className="input" placeholder="ex: Sim, Não, Não sei" value={newField.options} onChange={(e) => setNewField({ ...newField, options: e.target.value })} />
              </div>
            )}

            <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", cursor: "pointer" }}>
              <input type="checkbox" checked={newField.required} onChange={(e) => setNewField({ ...newField, required: e.target.checked })} />
              <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Obrigatório</span>
            </label>

            <button className="btn" onClick={addField} style={{ width: "100%", padding: "10px", background: "rgba(96,165,250,0.1)", color: "var(--info)", border: "1px solid rgba(96,165,250,0.3)", borderRadius: "8px", fontSize: "13px" }}>
              Adicionar Campo
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: "#7f1d1d44", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "8px", padding: "12px 16px", color: "var(--danger)", fontSize: "13px", marginBottom: "16px" }}>
            ⚠️ {error}
          </div>
        )}

        <button className="btn" onClick={createRoom} disabled={loading}
          style={{ width: "100%", padding: "18px", background: loading ? "var(--accent-dim)" : "linear-gradient(135deg, var(--accent), #34d399)", color: "#022c22", borderRadius: "12px", fontSize: "16px", fontWeight: 800, letterSpacing: "0.02em", boxShadow: loading ? "none" : "0 8px 32px var(--accent-glow)", transition: "all 0.3s" }}>
          {loading ? "⚡ Criando Sala..." : "🚀 Criar Sala e Abrir Fila"}
        </button>
      </div>
    </div>
  );
};

export default HostSetupScreen;
