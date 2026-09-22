export type Finalidade = "venda" | "locacao";

export type TipoImovel =
  | "Apartamento"
  | "Casa em condomínio"
  | "Casa de rua"
  | "Terreno"
  | "Sala comercial"
  | "Cobertura";

export type Origem =
  | "Site"
  | "Portal imobiliário"
  | "Instagram"
  | "Indicação"
  | "Agenciador"
  | "WhatsApp direto";

// Etapas do funil (por enquanto só visual — não filtram a base ainda).
export type Status =
  | "Prospecção/Qualificação"
  | "Precisa Vender para Comprar"
  | "Busca de imóveis"
  | "Em visita"
  | "Em proposta"
  | "Contrato"
  | "Fechamento";

// Status do imóvel no catálogo do Vista (exposto pela view).
export type StatusImovel = "Disponível" | "Reservado" | "Vendido" | "Locado";

export const STATUS_IMOVEL: StatusImovel[] = [
  "Disponível",
  "Reservado",
  "Vendido",
  "Locado",
];

export type Imovel = {
  codigo: string;
  bairro: string;
  tipo: TipoImovel;
  preco: number;
  quartos: number;
  vagas: number;
  metragem: number;
  statusImovel: StatusImovel;
};

export type Lead = {
  id: string;
  nome: string;
  telefone: string;
  finalidade: Finalidade;
  dataEntrada: string; // ISO yyyy-mm-dd
  origem: Origem;
  status: Status;
  corretor: string;
  negocioAtivo: boolean; // negociação em andamento (sim/não)
  ultimaAtividade: string; // ISO yyyy-mm-dd da última atividade do corretor
  imoveis: Imovel[];
};

export const BAIRROS = [
  "Moinhos de Vento",
  "Bela Vista",
  "Petrópolis",
  "Três Figueiras",
  "Auxiliadora",
  "Mont Serrat",
  "Higienópolis",
  "Menino Deus",
  "Boa Vista",
  "Rio Branco",
];

export const TIPOS: TipoImovel[] = [
  "Apartamento",
  "Casa em condomínio",
  "Casa de rua",
  "Terreno",
  "Sala comercial",
  "Cobertura",
];

export const ORIGENS: Origem[] = [
  "Site",
  "Portal imobiliário",
  "Instagram",
  "Indicação",
  "Agenciador",
  "WhatsApp direto",
];

export const STATUS: Status[] = [
  "Prospecção/Qualificação",
  "Precisa Vender para Comprar",
  "Busca de imóveis",
  "Em visita",
  "Em proposta",
  "Contrato",
  "Fechamento",
];

export const CORRETORES = [
  "Ana Beatriz Rocha",
  "Carlos Menezes",
  "Fernanda Lima",
  "Gustavo Prado",
  "Helena Vasconcelos",
  "Rafael Antunes",
];

const NOMES = [
  "Marina Oliveira", "Pedro Henrique Souza", "Juliana Castro", "Ricardo Almeida",
  "Camila Ferreira", "Bruno Tavares", "Larissa Mendes", "Thiago Barbosa",
  "Patrícia Nogueira", "Eduardo Ramos", "Beatriz Carvalho", "Rodrigo Pires",
  "Amanda Rezende", "Felipe Moraes", "Isabela Duarte", "Vinícius Cardoso",
  "Gabriela Pinto", "Marcelo Freitas", "Natália Bianchi", "André Coelho",
  "Renata Siqueira", "Leonardo Fontes", "Carolina Braga", "Diego Martins",
  "Sofia Nunes", "Alexandre Vieira", "Letícia Campos", "Fábio Guimarães",
  "Priscila Andrade", "Henrique Lopes", "Mariana Teixeira", "Otávio Bruno",
  "Débora Salvador", "Guilherme Rocha", "Vanessa Xavier", "Lucas Bittencourt",
  "Adriana Peixoto", "Matheus Dornelles", "Cristiane Machado", "Rafael Goulart",
  "Bianca Ferraz", "Daniel Sampaio", "Elisa Monteiro", "Roberto Cunha",
  "Tatiana Reis", "Igor Fagundes", "Manuela Prado", "César Aguiar",
];

// Gerador determinístico (sem dependências) para dados de demonstração.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260819);
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

const PREFIXO_CODIGO: Record<TipoImovel, string> = {
  Apartamento: "AP",
  "Casa em condomínio": "CC",
  "Casa de rua": "CA",
  Terreno: "TE",
  "Sala comercial": "SL",
  Cobertura: "CO",
};

function makeImovel(finalidade: Finalidade): Imovel {
  const tipo = pick(TIPOS);
  const codigo = `${PREFIXO_CODIGO[tipo]}${between(1000, 9999)}`;
  const quartos = tipo === "Sala comercial" || tipo === "Terreno" ? 0 : between(1, 4);
  const vagas = tipo === "Terreno" ? 0 : between(0, 3);
  const metragem =
    tipo === "Terreno" ? between(300, 900)
    : tipo === "Sala comercial" ? between(30, 180)
    : between(45, 320);

  // Preço em R$: venda na casa dos milhões/centenas de milhar; locação mensal.
  const base =
    finalidade === "venda"
      ? metragem * between(9000, 22000)
      : metragem * between(35, 95);
  const preco = Math.round(base / 1000) * 1000;

  // Status do imóvel: maioria disponível; "Locado" só faz sentido em locação.
  const r = rand();
  const statusImovel: StatusImovel =
    r < 0.68 ? "Disponível"
    : r < 0.82 ? "Reservado"
    : finalidade === "venda" ? "Vendido"
    : "Locado";

  return { codigo, bairro: pick(BAIRROS), tipo, preco, quartos, vagas, metragem, statusImovel };
}

function makeLead(i: number): Lead {
  const finalidade: Finalidade = rand() > 0.32 ? "venda" : "locacao";
  const nImoveis = rand() > 0.72 ? 2 : rand() > 0.94 ? 3 : 1;
  const imoveis = Array.from({ length: nImoveis }, () => makeImovel(finalidade));

  // Data de entrada nos últimos ~10 meses a partir de 2026-08-19.
  const daysAgo = between(2, 300);
  const d = new Date(2026, 7, 19);
  d.setDate(d.getDate() - daysAgo);
  const dataEntrada = d.toISOString().slice(0, 10);

  const ddd = pick(["51", "51", "51", "48", "11"]);
  const telefone = `(${ddd}) 9${between(4000, 9999)}-${between(1000, 9999)}`;

  // Última atividade do corretor: entre a entrada e hoje. Quanto maior o
  // intervalo até hoje, mais "frio" está o cliente.
  const semAtividade = between(0, Math.min(daysAgo, 180));
  const a = new Date(2026, 7, 19);
  a.setDate(a.getDate() - semAtividade);
  const ultimaAtividade = a.toISOString().slice(0, 10);

  const status = pick(STATUS);
  const negocioAtivo = rand() > 0.25;

  return {
    id: `LX-${String(1000 + i)}`,
    nome: NOMES[i % NOMES.length],
    telefone,
    finalidade,
    dataEntrada,
    origem: pick(ORIGENS),
    status,
    corretor: pick(CORRETORES),
    negocioAtivo,
    ultimaAtividade,
    imoveis,
  };
}

export const LEADS: Lead[] = Array.from({ length: 48 }, (_, i) => makeLead(i));
