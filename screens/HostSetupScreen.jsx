import { useState } from "react";

const PRIORITY_OPTIONS = [
  { value: 3, label: "🔴 Alta", color: "var(--danger)", bg: "rgba(239, 68, 68, 0.1)" },
  { value: 2, label: "🟡 Média", color: "var(--warn)", bg: "rgba(245, 158, 11, 0.1)" },
  { value: 1, label: "🟢 Baixa", color: "var(--success)", bg: "rgba(16, 185, 129, 0.1)" },
];

const getPriority = (p) => PRIORITY_OPTIONS.find((o) => o.value === p) || PRIORITY_OPTIONS[2];

const HostSetupScreen = ({ onRoomCreated, onBack }) => {
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
    <div className="screen-container container-md">
      <div className="animate-fade flex-col gap-lg">
        
        {/* Header */}
        <div>
          <div className="flex-row justify-between" style={{ marginBottom: "var(--space-md)" }}>
            <button
              className="btn btn-secondary"
              onClick={onBack}
              style={{ minHeight: "36px", padding: "var(--space-xs) var(--space-md)", fontSize: "var(--text-sm)" }}
            >
              <span aria-hidden="true">←</span> Voltar
            </button>
            <div className="flex-row gap-sm">
              <span style={{ fontSize: "var(--text-xl)", fontWeight: 800 }}>
                fila<span className="text-accent">.io</span>
              </span>
              <span className="tag">HOST</span>
            </div>
          </div>
          <h1>Configurar Sala</h1>
          <p>Defina os serviços e seus pesos de prioridade</p>
        </div>

        {/* Room Name */}
        <div>
          <label htmlFor="room-name" className="label">
            Nome da Sala
          </label>
          <input
            id="room-name"
            className="input"
            placeholder="ex: Clínica Central — Turno Manhã"
            value={roomName}
            onChange={(e) => { setRoomName(e.target.value); setError(""); }}
          />
        </div>

        {/* Category list */}
        <div>
          <div className="flex-row justify-between" style={{ marginBottom: "var(--space-md)" }}>
            <span className="label" style={{ marginBottom: 0 }}>
              Categorias de Atendimento
            </span>
            <span className="tag">{categories.length}</span>
          </div>

          <div className="flex-col gap-sm" style={{ marginBottom: "var(--space-lg)" }}>
            {categories.map((cat, i) => {
              const p = getPriority(cat.priority);
              return (
                <div
                  key={i}
                  className="card animate-slide flex-row gap-md"
                  style={{
                    padding: "var(--space-md) var(--space-lg)",
                    animationDelay: `${i * 0.04}s`,
                  }}
                >
                  <span
                    className="tag"
                    style={{ background: p.bg, color: p.color, minWidth: "80px" }}
                  >
                    {p.label}
                  </span>
                  <span style={{ flex: 1, fontWeight: 600 }}>{cat.name}</span>
                  <span className="text-muted" style={{ fontSize: "var(--text-sm)" }}>
                    ~{cat.tma} min
                  </span>
                  <button
                    className="btn btn-ghost btn-icon text-danger"
                    onClick={() => removeCategory(i)}
                    aria-label={`Remover categoria ${cat.name}`}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Add category form */}
          <div className="card">
            <h3 className="text-accent" style={{ fontSize: "var(--text-sm)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-md)" }}>
              + Nova Categoria
            </h3>
            <div className="grid responsive-grid-3 gap-md" style={{ alignItems: "end", marginBottom: "var(--space-lg)" }}>
              <div>
                <label htmlFor="cat-name" className="label">Nome</label>
                <input
                  id="cat-name"
                  className="input"
                  placeholder="ex: Retorno"
                  value={newCat.name}
                  onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && addCategory()}
                />
              </div>
              <div>
                <label htmlFor="cat-priority" className="label">Prioridade</label>
                <select
                  id="cat-priority"
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
                <label htmlFor="cat-tma" className="label">Tempo Médio (min)</label>
                <input
                  id="cat-tma"
                  className="input"
                  type="number"
                  min={1}
                  max={120}
                  value={newCat.tma}
                  onChange={(e) => setNewCat({ ...newCat, tma: Math.max(1, parseInt(e.target.value) || 1) })}
                />
              </div>
            </div>
            <button className="btn btn-secondary" onClick={addCategory} style={{ width: "100%" }}>
              Adicionar Categoria
            </button>
          </div>
        </div>

        {/* Algorithm preview */}
        <div
          className="card"
          style={{
            background: "rgba(167, 139, 250, 0.05)",
            borderColor: "rgba(167, 139, 250, 0.2)",
          }}
        >
          <div className="text-purple mono" style={{ fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-xs)" }}>
            Informação do Sistema
          </div>
          <p className="text-muted" style={{ fontSize: "var(--text-sm)", marginBottom: "var(--space-xs)" }}>
            O tempo de espera estimado é calculado baseando-se nas pessoas na fila multiplicadas pelo tempo médio de atendimento da categoria.
          </p>
          <p className="text-dim" style={{ fontSize: "var(--text-xs)", margin: 0 }}>
            As filas são reordenadas dinamicamente conforme a prioridade selecionada.
          </p>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert">
            <span aria-hidden="true">⚠️</span> {error}
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={createRoom}
          disabled={loading}
          style={{ width: "100%", minHeight: "56px", fontSize: "var(--text-lg)" }}
        >
          {loading ? "Criando Sala..." : "🚀 Criar Sala e Abrir Fila"}
        </button>
      </div>
    </div>
  );
};

export default HostSetupScreen;