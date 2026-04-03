import { useState } from "react";

const PRIORITY_OPTIONS = [
  { value: 3, label: "🔴 Alta", color: "#F87171", bg: "#7f1d1d44" },
  { value: 2, label: "🟡 Média", color: "#FCD34D", bg: "#78350f44" },
  { value: 1, label: "🟢 Baixa", color: "#6EE7B7", bg: "#14532d44" },
];

const getPriority = (p) => PRIORITY_OPTIONS.find((o) => o.value === p) || PRIORITY_OPTIONS[2];

const HostSetupScreen = ({ onRoomCreated }) => {
  const [roomName, setRoomName] = useState("");
  const [categories, setCategories] = useState([
    { name: "Emergência", priority: 3, tma: 3 },
    { name: "Consulta", priority: 2, tma: 8 },
    { name: "Informação", priority: 1, tma: 5 },
  ]);
  const [newCat, setNewCat] = useState({ name: "", priority: 2, tma: 5 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  const removeCategory = (index) =>
    setCategories(categories.filter((_, i) => i !== index));

  const createRoom = async () => {
    if (!roomName.trim()) { setError("Nome da sala é obrigatório."); return; }
    if (categories.length === 0) { setError("Adicione ao menos uma categoria."); return; }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomName.trim(), categories }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar sala.");
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
        maxWidth: "600px",
        margin: "0 auto",
      }}
    >
      <div className="animate-fade">
        {/* Header */}
        <div style={{ paddingTop: "16px", marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span style={{ fontSize: "20px", fontWeight: 800 }}>
              fila<span style={{ color: "var(--accent)" }}>.io</span>
            </span>
            <span
              className="tag"
              style={{
                background: "var(--accent-glow)",
                color: "var(--accent)",
                border: "1px solid var(--accent-dim)",
              }}
            >
              HOST
            </span>
          </div>
          <h1 style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "-0.02em" }}>
            Configurar Sala
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
            Defina os serviços e seus pesos de prioridade
          </p>
        </div>

        {/* Room Name */}
        <div style={{ marginBottom: "28px" }}>
          <label className="mono" style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
            Nome da Sala
          </label>
          <input
            className="input"
            placeholder="ex: Clínica Central — Turno Manhã"
            value={roomName}
            onChange={(e) => { setRoomName(e.target.value); setError(""); }}
          />
        </div>

        {/* Category list */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <label className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Categorias de Atendimento
            </label>
            <span className="tag" style={{ background: "var(--accent-glow)", color: "var(--accent)" }}>
              {categories.length}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
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
                  <span
                    className="tag"
                    style={{ background: p.bg, color: p.color, minWidth: "76px", justifyContent: "center" }}
                  >
                    {p.label}
                  </span>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: "14px" }}>{cat.name}</span>
                  <span className="mono" style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                    ~{cat.tma}min
                  </span>
                  <button
                    className="btn"
                    onClick={() => removeCategory(i)}
                    style={{
                      background: "transparent",
                      color: "var(--danger)",
                      fontSize: "18px",
                      padding: "2px 6px",
                      borderRadius: "6px",
                      lineHeight: 1,
                    }}
                    aria-label="Remover categoria"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          {/* Add category form */}
          <div className="card" style={{ padding: "18px" }}>
            <p className="mono" style={{ fontSize: "11px", color: "var(--accent)", marginBottom: "14px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              + Nova Categoria
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 110px 80px",
                gap: "10px",
                alignItems: "end",
                marginBottom: "12px",
              }}
            >
              <div>
                <label className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                  Nome
                </label>
                <input
                  className="input"
                  placeholder="ex: Retorno"
                  value={newCat.name}
                  onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && addCategory()}
                />
              </div>
              <div>
                <label className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                  Prioridade
                </label>
                <select
                  className="input"
                  value={newCat.priority}
                  onChange={(e) => setNewCat({ ...newCat, priority: parseInt(e.target.value) })}
                >
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                  TMA (min)
                </label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={120}
                  value={newCat.tma}
                  onChange={(e) => setNewCat({ ...newCat, tma: Math.max(1, parseInt(e.target.value) || 1) })}
                />
              </div>
            </div>
            <button
              className="btn"
              onClick={addCategory}
              style={{
                width: "100%",
                padding: "10px",
                background: "var(--accent-glow)",
                color: "var(--accent)",
                border: "1px solid var(--accent-dim)",
                borderRadius: "8px",
                fontSize: "13px",
              }}
            >
              Adicionar Categoria
            </button>
          </div>
        </div>

        {/* Algorithm preview */}
        <div
          className="card"
          style={{
            padding: "16px 18px",
            marginBottom: "24px",
            background: "rgba(167,139,250,0.06)",
            border: "1px solid rgba(167,139,250,0.2)",
          }}
        >
          <p className="mono" style={{ fontSize: "11px", color: "var(--purple)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Algoritmo de Previsão
          </p>
          <p className="mono" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            T_est = Σ ( Pessoas_na_Frente × TMA_da_Categoria )
          </p>
          <p style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px" }}>
            Filas re-ordenadas por prioridade a cada evento
          </p>
        </div>

        {error && (
          <div
            style={{
              background: "#7f1d1d44",
              border: "1px solid rgba(248,113,113,0.3)",
              borderRadius: "8px",
              padding: "12px 16px",
              color: "var(--danger)",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <button
          className="btn"
          onClick={createRoom}
          disabled={loading}
          style={{
            width: "100%",
            padding: "18px",
            background: loading
              ? "var(--accent-dim)"
              : "linear-gradient(135deg, var(--accent), #34d399)",
            color: "#022c22",
            borderRadius: "12px",
            fontSize: "16px",
            fontWeight: 800,
            letterSpacing: "0.02em",
            boxShadow: loading ? "none" : "0 8px 32px var(--accent-glow)",
            transition: "all 0.3s",
          }}
        >
          {loading ? "⚡ Criando Sala..." : "🚀 Criar Sala e Abrir Fila"}
        </button>
      </div>
    </div>
  );
};

export default HostSetupScreen;
