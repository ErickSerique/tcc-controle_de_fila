/**
 * CustomFieldInput — renderiza um campo dinâmico de check-in
 * (texto, número, seleção ou sim/não) definido pelo host em
 * HostSetupScreen. Usado no check-in do cliente e no modal de
 * adição manual (host).
 */
const CustomFieldInput = ({ field, value, onChange }) => {
  return (
    <div>
      <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
        {field.label} {field.required && <span style={{ color: "var(--danger)" }}>*</span>}
      </label>

      {field.type === "text" && (
        <input className="input" value={value || ""} onChange={(e) => onChange(e.target.value)} />
      )}

      {field.type === "number" && (
        <input className="input" type="number" value={value || ""} onChange={(e) => onChange(e.target.value)} />
      )}

      {field.type === "select" && (
        <select className="input" value={value || ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Selecione...</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}

      {field.type === "checkbox" && (
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Sim</span>
        </label>
      )}
    </div>
  );
};

/**
 * Valida um conjunto de valores contra a configuração de campos.
 * Retorna a mensagem de erro do primeiro campo obrigatório vazio, ou null.
 */
export const validateCustomFields = (fields, values) => {
  for (const field of fields || []) {
    if (!field.required) continue;
    const val = values[field.id];
    const empty = field.type === "checkbox" ? !val : !val?.toString().trim();
    if (empty) return `Campo obrigatório: ${field.label}`;
  }
  return null;
};

export default CustomFieldInput;
