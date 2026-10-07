import { supabase } from "./supabase";

// Andamento e última atualização geral dos dados (Vista + RealMate), mostrados no topo de Campanhas.
export type StatusAtualizacao = {
  agora: string; // relógio do servidor
  rodando: boolean;
  origem: "agenda" | "manual" | null;
  iniciada_em: string | null;
  iniciada_por: string | null;
  etapas_total: number;
  etapas_feitas: number;
  etapa_atual: string | null;
  etapa_detalhe: { feitas: number; total: number } | null;
  dados_atualizados_em: string | null; // quando as telas de Campanhas foram atualizadas pela última vez
  ultima_concluida_em: string | null; // fim da última atualização geral
  ultima_origem: "agenda" | "manual" | null;
  ultima_status: "concluida" | "erro" | null;
  ultima_erro: string | null;
  media_min: number;
  liberada_em: string | null; // só dá para pedir outra a partir daqui
  proxima_agenda: string | null;
  pode_rodar: boolean;
};

export async function statusAtualizacao(): Promise<StatusAtualizacao> {
  const { data, error } = await supabase.rpc("atualizacao_geral_status");
  if (error) throw new Error(error.message);
  return data as StatusAtualizacao;
}

export async function iniciarAtualizacao(): Promise<void> {
  const { error } = await supabase.rpc("atualizacao_geral_iniciar");
  if (error) throw new Error(error.message);
}
