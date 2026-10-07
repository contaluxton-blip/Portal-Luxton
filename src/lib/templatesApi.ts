import { supabase } from "./supabase";

// ---- Tipos ----------------------------------------------------------------

export type TipoTemplate = "padrao" | "nao_padrao";

// Etapa do fluxo: cadastrar → testar → aprovar → em uso.
export type Etapa = "sem_config" | "cadastrado" | "testado" | "aprovado" | "em_uso";

export type ConfigCodigo = { palavras: string[]; link: boolean; isolado: boolean };

export type ResumoTeste = {
  casaram: number;
  sem_codigo: number;
  codigo_inexistente: number;
  ok: number;
  sessoes_lidas: number;
  total_sessoes: number;
  dias: number;
};

type Base = {
  id: string;
  regex: string[];
  modo: "simples" | "especial"; // especial = regra técnica antiga, mantida como está
  config_codigo: ConfigCodigo | null;
  etapa: Etapa;
  testado_em: string | null;
  teste_resumo: ResumoTeste | null;
  aprovado_em: string | null;
  msgs: number; // mensagens deste template já guardadas no banco
  msgs_com_codigo: number;
};

export type TemplatePadrao = Base & {
  nome: string;
  nome_interno: string | null;
  status: string | null;
  categoria: string | null;
  texto: string | null;
  ativo_no_realmate: boolean | null;
  criado: string | null;
  interesse: boolean; // em uso: gera interesse por imóvel
};

export type TemplateNaoPadrao = Base & {
  nome: string;
  canal: string;
  sinais: string[]; // a mensagem precisa conter TODAS
  notas: string | null;
  ativo: boolean;
  criado: string;
};

export type LinhaTeste = {
  sessao: string;
  contato: string;
  telefone: string;
  data: string;
  trecho: string;
  codigo: string | null;
  metodo: string | null;
  imovel: { categoria: string | null; bairro: string | null; status: string | null } | null;
};

export type TesteSalvo = {
  valido: boolean; // o teste é da configuração atual
  testado_em: string | null;
  resumo: ResumoTeste | null;
  amostra: LinhaTeste[];
  aprovado: boolean;
  aprovado_em: string | null;
};

export type JobRetro = {
  id: string;
  tipo: TipoTemplate;
  template_id: string;
  template_nome: string | null;
  desde: string;
  status: "pendente" | "rodando" | "concluido" | "erro" | "cancelado";
  total_sessoes: number;
  sessoes_processadas: number;
  mensagens_gravadas: number;
  reextraidas: number | null;
  resumo: {
    mensagens: number;
    com_codigo: number;
    codigo_valido_no_vista: number;
    contatos: number;
    pares_contato_imovel: number;
  } | null;
  ultimo_erro: string | null;
  criado_por_nome: string | null;
  created_at: string;
  finalizado_em: string | null;
};

// ---- Chamadas ---------------------------------------------------------------

function msgDeErro(e: unknown): string {
  return (e as { message?: string })?.message ?? "Erro inesperado.";
}

async function rpc<T>(nome: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(nome, params);
  if (error) throw new Error(msgDeErro(error));
  return data as T;
}

export const listarPadrao = () => rpc<TemplatePadrao[]>("config_templates_padrao_listar");
export const listarNaoPadrao = () => rpc<TemplateNaoPadrao[]>("config_templates_nao_padrao_listar");

type Forma = { modo: "simples" | "especial"; palavras: string[]; link: boolean; isolado: boolean };

export const salvarPadrao = (p: { id: string } & Forma) =>
  rpc<{ pausado: boolean }>("config_template_padrao_salvar", {
    p_id: p.id,
    p_modo: p.modo,
    p_palavras: p.palavras,
    p_link: p.link,
    p_isolado: p.isolado,
  });

export const salvarNaoPadrao = (p: { id: string | null; nome: string; canal: string; sinais: string[]; notas: string } & Forma) =>
  rpc<{ id: string; pausado: boolean }>("config_template_nao_padrao_salvar", {
    p_id: p.id,
    p_nome: p.nome,
    p_canal: p.canal,
    p_sinais: p.sinais,
    p_modo: p.modo,
    p_palavras: p.palavras,
    p_link: p.link,
    p_isolado: p.isolado,
    p_notas: p.notas,
  });

export const excluirNaoPadrao = (id: string, apagarMensagens: boolean) =>
  rpc<{ mensagens_apagadas: number }>("config_template_nao_padrao_excluir", {
    p_id: id,
    p_apagar_mensagens: apagarMensagens,
  });

export const obterTeste = (tipo: TipoTemplate, id: string) =>
  rpc<TesteSalvo>("config_template_teste_obter", { p_tipo: tipo, p_id: id });

export const aprovarTemplate = (tipo: TipoTemplate, id: string) =>
  rpc<void>("config_template_aprovar", { p_tipo: tipo, p_id: id });

// Edge Function (API do RealMate, retroativo, atualização dos snapshots).
async function chamarFuncao<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("config-templates-realmate", { body });
  if (error) {
    let msg = msgDeErro(error);
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const j = await ctx.json();
        if (j?.error) msg = j.error;
      }
    } catch {
      /* mantém a mensagem padrão */
    }
    throw new Error(msg);
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

// Testa a configuração SALVA do template (o resultado fica guardado para conferência).
export const testarTemplate = (p: { tipo: TipoTemplate; templateId: string; dias: number; offset: number }) =>
  chamarFuncao<{ sessoesLidas: number; totalSessoes: number; proximoOffset: number; filtradoPorAnuncio: boolean }>({
    action: "testar",
    tipo: p.tipo,
    template_id: p.templateId,
    dias: p.dias,
    offset: p.offset,
  });

export const ligarTemplate = (tipo: TipoTemplate, id: string, ligar: boolean) =>
  chamarFuncao<{ ok: boolean }>({ action: "ligar", tipo, template_id: id, ligar });

export const estimarRetroativo = (tipo: TipoTemplate, id: string, desde: string) =>
  chamarFuncao<{ sessoes: number; minutos: number; soAnuncios: boolean }>({ action: "estimar", tipo, template_id: id, desde });

export const iniciarRetroativo = (p: { tipo: TipoTemplate; templateId: string; desde: string }) =>
  chamarFuncao<{ job: JobRetro }>({ action: "retro_iniciar", tipo: p.tipo, template_id: p.templateId, desde: p.desde });

export const cancelarRetroativo = (jobId: string) =>
  chamarFuncao<{ job: JobRetro }>({ action: "retro_cancelar", job_id: jobId });

// Pede o refresh dos snapshots de Campanhas (quem executa é o banco, em até ~1 min) e espera terminar.
export async function atualizarCampanhas(): Promise<void> {
  await chamarFuncao<{ ok: boolean }>({ action: "atualizar_campanhas" });
  const limite = Date.now() + 4 * 60000;
  while (Date.now() < limite) {
    await new Promise((r) => setTimeout(r, 5000));
    const s = await chamarFuncao<{ estado: string; erro: string | null }>({ action: "atualizar_status" });
    if (s.estado === "done") return;
    if (s.estado === "error") throw new Error(s.erro ?? "Falha ao atualizar os dados de Campanhas.");
  }
  throw new Error("A atualização continua em segundo plano; confira em Campanhas em alguns minutos.");
}

export async function ultimoRetroativo(tipo: TipoTemplate, templateId: string): Promise<JobRetro | null> {
  const { data, error } = await supabase
    .from("config_templates_retro_jobs")
    .select("*")
    .eq("tipo", tipo)
    .eq("template_id", templateId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(msgDeErro(error));
  return ((data ?? [])[0] as JobRetro) ?? null;
}
