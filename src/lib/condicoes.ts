// Construtor de condições de negócio (caixas E/OU, estilo "parênteses").
//
// Cada linha é: campo + é / não é + valor. Dentro de uma CAIXA as linhas se ligam por E/OU
// (E resolve antes de OU) e valem para UM MESMO negócio do lead:
//   "é"     → existe um negócio do lead que casa
//   "não é" → o lead NÃO TEM nenhum negócio que case (vale para o lead todo)
// "Sem negócio" é um valor do status: "status é Sem negócio" = lead sem negócio algum;
// "status não é Ganho" = nenhum negócio ganho (quem não tem negócio também entra).
// As caixas se ligam entre si, no nível do lead, também por E/OU.

export type CampoCond = "status" | "corretor" | "fase" | "parado";
export type OpCond = "e" | "nao_e" | "gt" | "lt" | "eq";
export type Conector = "E" | "OU";

export type LinhaCond = {
  id: string;
  conector: Conector; // ligação com a linha anterior (ignorado na primeira)
  campo: CampoCond;
  op: OpCond;
  valores: string[]; // status / corretor / fase
  numero: string; // dias (parado)
};

export type CaixaCond = {
  id: string;
  conector: Conector; // ligação com a caixa anterior (ignorado na primeira)
  linhas: LinhaCond[];
};

export const SEM_NEGOCIO = "Sem negócio";

const uid = () => Math.random().toString(36).slice(2, 9);

export const CAMPO_LABEL: Record<CampoCond, string> = {
  status: "Status do negócio",
  corretor: "Corretor do negócio",
  fase: "Fase do negócio",
  parado: "Negócio parado há (dias)",
};

export const OP_LABEL: Record<OpCond, string> = {
  e: "é",
  nao_e: "não é",
  gt: "mais de",
  lt: "menos de",
  eq: "igual a",
};

export const opsDoCampo = (campo: CampoCond): OpCond[] =>
  campo === "parado" ? ["gt", "lt", "eq"] : ["e", "nao_e"];

export const novaLinha = (campo: CampoCond = "status", conector: Conector = "E"): LinhaCond => ({
  id: uid(),
  conector,
  campo,
  op: opsDoCampo(campo)[0],
  valores: [],
  numero: "",
});

export const novaCaixa = (conector: Conector = "E"): CaixaCond => ({
  id: uid(),
  conector,
  linhas: [novaLinha()],
});

export const linhaCompleta = (l: LinhaCond) =>
  l.campo === "parado" ? /^\d+$/.test(l.numero) : l.valores.length > 0;

// Caixa sem nenhuma linha preenchida é ignorada (não filtra nada).
export const caixaAtiva = (c: CaixaCond) => c.linhas.some(linhaCompleta);

// Tira as linhas de fase (as etapas dependem do pipeline: venda x locação).
export const semFase = (caixas: CaixaCond[]): CaixaCond[] =>
  caixas.map((c) => ({ ...c, linhas: c.linhas.filter((l) => l.campo !== "fase") }));

// Formato que o banco espera (campanhas_rows / campanhas_kpis → p_condicoes).
export function condicoesParaRpc(caixas: CaixaCond[]) {
  return caixas.filter(caixaAtiva).map((c) => ({
    conector: c.conector,
    linhas: c.linhas.filter(linhaCompleta).map((l) => ({
      conector: l.conector,
      campo: l.campo,
      op: l.op,
      valores: l.valores,
      numero: l.campo === "parado" ? l.numero : null,
    })),
  }));
}

function descreverLinha(l: LinhaCond): string {
  if (l.campo === "parado") {
    const quando = l.op === "gt" ? "mais de" : l.op === "lt" ? "menos de" : "exatamente";
    return `negócio parado há ${quando} ${l.numero} dia(s)`;
  }
  const v = l.valores.join(" ou ");
  if (l.campo === "status") {
    if (l.valores.length === 1 && l.valores[0] === SEM_NEGOCIO)
      return l.op === "e" ? "o lead não tem negócio algum" : "o lead tem algum negócio";
    return l.op === "e" ? `status do negócio é ${v}` : `nenhum negócio tem status ${v}`;
  }
  if (l.campo === "corretor")
    return l.op === "e" ? `corretor do negócio é ${v}` : `nenhum negócio tem corretor ${v}`;
  return l.op === "e" ? `fase do negócio é ${v}` : `nenhum negócio está na fase ${v}`;
}

function descreverCaixa(c: CaixaCond): string {
  return c.linhas
    .filter(linhaCompleta)
    .map((l, i) => (i === 0 ? "" : l.conector === "OU" ? " ou " : " e ") + descreverLinha(l))
    .join("");
}

// Frase única, para o resumo na tela e para o log. Ex.:
// "(status é Em aberto e corretor é Ana) ou (não tem negócio algum)"
export function descreverCondicoes(todas: CaixaCond[]): string {
  const caixas = todas.filter(caixaAtiva);
  if (caixas.length === 0) return "";
  const partes = caixas.map((c, i) => {
    const t = descreverCaixa(c);
    const ligacao = i === 0 ? "" : c.conector === "OU" ? " ou " : " e ";
    return `${ligacao}${caixas.length > 1 ? `(${t})` : t}`;
  });
  return partes.join("");
}

type Legado = {
  condicoes?: CaixaCond[];
  statusNegocio?: string[];
  fases?: string[];
  corretores?: string[];
  diasSemAtividade?: string;
};

// Perfis salvos antes do construtor guardam status/fase/corretor/parado soltos
// (todos valendo no MESMO negócio): viram uma única caixa.
export function migrarLegado(f: Legado): CaixaCond[] {
  if (f.condicoes && f.condicoes.length > 0) return f.condicoes;
  const linhas: LinhaCond[] = [];
  const add = (campo: CampoCond, extra: Partial<LinhaCond>) =>
    linhas.push({ ...novaLinha(campo, "E"), ...extra });
  if (f.statusNegocio?.length) add("status", { valores: f.statusNegocio });
  if (f.corretores?.length) add("corretor", { valores: f.corretores });
  if (f.fases?.length) add("fase", { valores: f.fases });
  if (f.diasSemAtividade) add("parado", { op: "gt", numero: f.diasSemAtividade });
  if (linhas.length === 0) return [];
  return [{ id: uid(), conector: "E", linhas }];
}
