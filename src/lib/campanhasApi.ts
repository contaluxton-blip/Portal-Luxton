import { supabase } from "./supabase";
import { condicoesParaRpc, type CaixaCond } from "./condicoes";

export type Ordem = "lead_asc" | "lead_desc" | "entrada_asc" | "entrada_desc";

export type Finalidade = "venda" | "locacao" | "ambos";

// Quantas linhas trazemos para MONTRAR na tabela. Os KPIs (contagem, VGV, %) vêm
// exatos de uma função de agregação no banco, independente deste teto. A lista
// completa (para copiar/exportar) é puxada sob demanda por fetchTodosLeads.
const LINHAS_EXIBICAO = 1000;

// Valor sentinela para o "sem canal definido" do filtro de canal. Usamos o
// próprio rótulo legível como valor porque ele nunca colide com um valor real.
export const SEM_CANAL = "Sem canal de aquisição definido";

// Fonte do contato (sistema de origem). Valores literais vindos do banco.
export type Sistema = "realmente" | "vista";
export const SISTEMA_LABEL: Record<string, string> = {
  realmente: "RealMate",
  vista: "Vista",
};

export type FacetsCampanha = {
  bairros: string[];
  categorias: string[];
  status_imovel: string[];
  corretores: string[]; // corretores que aparecem em negócios (Vista)
  canais: string[];
  sistemas: string[];
  status_negocio: string[]; // Em aberto / Ganho / Perdido
  fases_venda: string[]; // etapas do pipeline de venda
  fases_aluguel: string[]; // etapas do pipeline de locação
  total_contatos: number; // base com interesse de imóvel
  total_contatos_todos: number; // base inteira (todos os contatos)
};

export type FiltrosInput = {
  finalidade: Finalidade;
  bairros: string[];
  precoMin: string;
  precoMax: string;
  tipos: string[]; // categorias
  quartosMin: string;
  quartosMax: string;
  vagasMin: string;
  metragemMin: string;
  metragemMax: string;
  codigoImovel: string;
  statusImovel: string[];
  dataInicial: string;
  dataFinal: string;
  canais: string[];
  sistemas: string[]; // fonte do contato: [] = todas, ['realmente'], ['vista']
  exigirImovel: boolean; // false = traz todos os contatos, com ou sem imóvel
  condicoes: CaixaCond[]; // construtor de condições de negócio (caixas E/OU)
  ordem?: Ordem | null; // ordenação da lista (feita no banco, antes do corte de 1.000 linhas)
  busca?: string; // busca por nome/telefone: só filtra a lista EXIBIDA (não muda totais, cópia nem planilha)
};

// Linha achatada devolvida pela função campanhas_rows (já com o valor e os
// canais resolvidos no banco conforme a finalidade escolhida).
type RpcRow = {
  contact_id: string;
  nome_contato: string | null;
  telefone: string | null;
  email: string | null;
  codigo_imovel: string | null;
  em_realmate: boolean | null;
  em_vista: boolean | null;
  bairro: string | null;
  categoria: string | null;
  valor: number | null;
  status_imovel: string | null;
  dormitorios: number | null;
  vagas: number | null;
  area_privativa: number | null;
  corretor_nome: string | null;
  entrada: string | null;
  canais: string[] | null;
  status_negocio: string | null; // Ganho / Em aberto / Perdido / Sem negócio
};

type Kpi = {
  total_leads: number;
  total_linhas: number;
  vgv_total: number;
  vgv_medio: number;
  tempo_medio_dias: number;
};

export type ImovelInteresse = {
  codigo: string;
  bairro: string;
  categoria: string;
  valor: number;
  status: string;
  dormitorios: number | null;
  vagas: number | null;
  area: number | null;
  corretor: string;
};

export type LeadGrupo = {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  entrada: string | null;
  canais: string[];
  sistemas: string[]; // fontes que confirmam esse lead (RealMate/Vista)
  statusNegocio: string; // Ganho > Em aberto > Perdido > Sem negócio (do lead todo)
  imoveis: ImovelInteresse[];
};

export type ResultadoCampanha = {
  grupos: LeadGrupo[]; // apenas os leads EXIBIDOS na tabela (primeira página)
  totalLinhas: number; // exato (linhas contato x imovel que casaram)
  truncado: boolean; // true se a tabela mostra só parte dos leads
  buscaAtiva: boolean; // a tabela está filtrada por uma busca
  totalLeads: number; // exato (contatos distintos que casaram)
  vgvTotal: number; // exato
  vgvMedio: number; // exato
  tempoMedioDias: number; // exato
};

// Monta os parâmetros das funções RPC a partir dos filtros da tela, separando
// os sentinelas "sem origem"/"sem canal" das listas de valores reais.
function toParams(f: FiltrosInput) {
  return {
    p_finalidade: f.finalidade,
    p_bairros: f.bairros,
    p_categorias: f.tipos,
    p_status_imovel: f.statusImovel,
    p_sistemas: f.sistemas,
    p_canais: f.canais.filter((c) => c !== SEM_CANAL),
    p_sem_canal: f.canais.includes(SEM_CANAL),
    p_preco_min: f.precoMin ? Number(f.precoMin) : null,
    p_preco_max: f.precoMax ? Number(f.precoMax) : null,
    p_metragem_min: f.metragemMin ? Number(f.metragemMin) : null,
    p_metragem_max: f.metragemMax ? Number(f.metragemMax) : null,
    p_quartos_min: f.quartosMin ? Number(f.quartosMin) : null,
    p_quartos_max: f.quartosMax ? Number(f.quartosMax) : null,
    p_vagas_min: f.vagasMin ? Number(f.vagasMin) : null,
    p_codigo_imovel: f.codigoImovel.trim() || null,
    p_data_inicial: f.dataInicial || null,
    p_data_final: f.dataFinal || null,
    p_exigir_imovel: f.exigirImovel,
    p_condicoes: condicoesParaRpc(f.condicoes),
    p_ordem: f.ordem ?? null,
  };
}

// Agrupa as linhas contato x imóvel por contato.
function agrupar(linhas: RpcRow[]): LeadGrupo[] {
  const porContato = new Map<string, LeadGrupo>();
  for (const r of linhas) {
    const fontes: string[] = [];
    if (r.em_realmate) fontes.push("realmente");
    if (r.em_vista) fontes.push("vista");
    // No modo "não exigir imóvel" as linhas vêm sem imóvel (codigo nulo).
    const temImovel = !!r.codigo_imovel;
    const imovel: ImovelInteresse | null = temImovel
      ? {
          codigo: r.codigo_imovel ?? "",
          bairro: r.bairro ?? "",
          categoria: r.categoria ?? "",
          valor: r.valor ?? 0,
          status: r.status_imovel ?? "",
          dormitorios: r.dormitorios,
          vagas: r.vagas,
          area: r.area_privativa,
          corretor: r.corretor_nome ?? "",
        }
      : null;
    const existente = porContato.get(r.contact_id);
    if (existente) {
      if (imovel) existente.imoveis.push(imovel);
      for (const c of r.canais ?? []) if (!existente.canais.includes(c)) existente.canais.push(c);
      for (const s of fontes) if (!existente.sistemas.includes(s)) existente.sistemas.push(s);
      if (r.entrada && (!existente.entrada || r.entrada < existente.entrada)) existente.entrada = r.entrada;
    } else {
      porContato.set(r.contact_id, {
        id: r.contact_id,
        nome: r.nome_contato?.trim() || "(sem nome)",
        telefone: r.telefone ?? "",
        email: r.email ?? "",
        entrada: r.entrada,
        canais: [...(r.canais ?? [])],
        sistemas: [...fontes],
        statusNegocio: r.status_negocio ?? "Sem negócio",
        imoveis: imovel ? [imovel] : [],
      });
    }
  }
  const grupos = [...porContato.values()];
  for (const g of grupos) {
    g.canais.sort();
    g.sistemas.sort();
  }
  return grupos;
}

export async function fetchFacets(): Promise<FacetsCampanha> {
  const { data, error } = await supabase.rpc("campanhas_facets");
  if (error) throw error;
  return data as FacetsCampanha;
}

export async function fetchCampanha(f: FiltrosInput): Promise<ResultadoCampanha> {
  const params = toParams(f);

  // KPIs exatos (agregados no banco) + primeira página de linhas para exibição.
  // A ordenação só vale para a lista; os totais (kpis) não recebem esse parâmetro.
  const { p_ordem: _ordem, ...paramsKpis } = params;
  void _ordem;
  const [kpiRes, linhasRes] = await Promise.all([
    supabase.rpc("campanhas_kpis", paramsKpis),
    supabase.rpc("campanhas_rows", { ...params, p_busca: f.busca?.trim() || null }).range(0, LINHAS_EXIBICAO - 1),
  ]);
  if (kpiRes.error) throw kpiRes.error;
  if (linhasRes.error) throw linhasRes.error;

  const k = kpiRes.data as Kpi;
  const grupos = agrupar((linhasRes.data ?? []) as RpcRow[]);
  const buscaAtiva = !!f.busca?.trim();

  return {
    grupos,
    totalLinhas: k.total_linhas,
    totalLeads: k.total_leads,
    truncado: buscaAtiva ? (linhasRes.data?.length ?? 0) >= LINHAS_EXIBICAO : k.total_leads > grupos.length,
    buscaAtiva,
    vgvTotal: k.vgv_total,
    vgvMedio: k.vgv_medio,
    tempoMedioDias: k.tempo_medio_dias,
  };
}

// Puxa TODOS os leads do filtro, numa única chamada, para exportar a planilha.
export async function fetchTodosLeads(f: FiltrosInput): Promise<LeadGrupo[]> {
  const { data, error } = await supabase.rpc("campanhas_lista_json", { ...toParams(f), p_modo: "completo" });
  if (error) throw error;
  return agrupar((data ?? []) as RpcRow[]);
}

// Pares [id do lead, telefone] (distintos, na ordem da lista), numa chamada leve, para "Copiar números".
export async function fetchTelefones(f: FiltrosInput): Promise<[string, string][]> {
  const { data, error } = await supabase.rpc("campanhas_lista_json", { ...toParams(f), p_modo: "telefones" });
  if (error) throw error;
  return (data ?? []) as [string, string][];
}

// ---- Gráficos do topo (imóveis/bairros com mais leads, por finalidade) ----
export type DashImovel = { codigo: string; bairro: string | null; total: number };
export type DashBairro = { bairro: string; total: number };
export type DashboardsCampanha = {
  imoveis_venda: DashImovel[];
  imoveis_locacao: DashImovel[];
  bairros_venda: DashBairro[];
  bairros_locacao: DashBairro[];
};

export async function fetchDashboards(limite = 8): Promise<DashboardsCampanha> {
  const { data, error } = await supabase.rpc("campanhas_dashboards", { p_limite: limite });
  if (error) throw error;
  const d = (data ?? {}) as Partial<DashboardsCampanha>;
  return {
    imoveis_venda: d.imoveis_venda ?? [],
    imoveis_locacao: d.imoveis_locacao ?? [],
    bairros_venda: d.bairros_venda ?? [],
    bairros_locacao: d.bairros_locacao ?? [],
  };
}
