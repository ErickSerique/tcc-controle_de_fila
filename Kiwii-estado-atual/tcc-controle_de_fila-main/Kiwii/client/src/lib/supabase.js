/**
 * client/src/lib/supabase.js
 *
 * Cliente Supabase singleton para o frontend.
 * Usa a chave anon (pública) — nunca a service_role.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnon) {
  console.error(
    "[supabase] VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórios.\n" +
    "Copie .env.example para client/.env e preencha os valores."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    // Persiste sessão no localStorage do navegador
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // captura tokens de magic link / convite
  },
});
