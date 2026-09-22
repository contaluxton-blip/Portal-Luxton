import { createClient } from "@supabase/supabase-js";

// Chave PUBLICÁVEL (publishable) do Supabase: pode ficar no frontend.
// Com o login (Supabase Auth), a leitura da base passa a exigir sessão
// autenticada — a chave sozinha não abre mais os dados de campanhas.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://gzntapbjnqrvpodqgymg.supabase.co";
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_KEY ?? "sb_publishable_3Pnb6HzHC_s2JMc8u20yNA_Mdoy5M-J";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // captura o token dos links de convite/recuperação
  },
});
