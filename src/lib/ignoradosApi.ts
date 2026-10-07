import { supabase } from "./supabase";

// Lista de contatos ignorados: aparecem nas campanhas já desmarcados (reconhecidos pelo telefone).
export type Ignorado = {
  id: string;
  telefone: string;
  nome: string | null;
  motivo: string | null;
  criado_por_nome: string | null;
  criado_em: string;
};

async function rpc<T>(nome: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(nome, params);
  if (error) throw new Error(error.message);
  return data as T;
}

// Chaves de telefone ignoradas (quem acessa Campanhas pode ler).
export const chavesIgnoradas = async (): Promise<Set<string>> => new Set(await rpc<string[]>("ignorados_chaves"));

export const listarIgnorados = () => rpc<Ignorado[]>("ignorados_listar");

export const adicionarIgnorados = (itens: { telefone: string; nome?: string }[], motivo?: string) =>
  rpc<{ adicionados: number; ja_existiam: number; invalidos: number }>("ignorados_adicionar", {
    p_itens: itens,
    p_motivo: motivo?.trim() || null,
  });

export const removerIgnorados = (ids: string[]) => rpc<{ removidos: number }>("ignorados_remover", { p_ids: ids });
