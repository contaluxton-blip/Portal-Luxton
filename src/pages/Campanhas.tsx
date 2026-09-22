import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Filter,
  RotateCcw,
  Users2,
  CalendarClock,
  Coins,
  Landmark,
  PieChart,
  Copy,
  Check,
  Bookmark,
  BookmarkPlus,
  Trash2,
  X,
  Lock,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { LuxtonMark } from "../components/Logo";
import { MultiSelect, Chips, FonteFlags } from "../components/MultiSelect";
import { brl, num, dataBR } from "../lib/format";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import {
  fetchCampanha,
  fetchFacets,
  fetchTodosLeads,
  SEM_CANAL,
  SISTEMA_LABEL,
  type Finalidade,
  type FacetsCampanha,
  type LeadGrupo,
  type ResultadoCampanha,
} from "../lib/campanhasApi";

type Filtros = {
  finalidade: Finalidade;
  bairros: string[];
  precoMin: string;
  precoMax: string;
  tipos: string[];
  quartosMin: string;
  vagasMin: string;
  metragemMin: string;
  metragemMax: string;
  codigoImovel: string;
  statusImovel: string[];
  dataInicial: string;
  dataFinal: string;
  canais: string[];
  sistemas: string[];
  exigirImovel: boolean;
  statusNegocio: string[]; // status do negócio (Vista) — filtra de verdade
  fases: string[]; // fase do negócio (etapa, por pipeline) — filtra de verdade
  corretores: string[]; // corretor do negócio (Vista) — filtra de verdade
  diasSemAtividade: string;
};

const VAZIO: Filtros = {
  finalidade: "ambos",
  bairros: [],
  precoMin: "",
  precoMax: "",
  tipos: [],
  quartosMin: "",
  vagasMin: "",
  metragemMin: "",
  metragemMax: "",
  codigoImovel: "",
  statusImovel: [],
  dataInicial: "",
  dataFinal: "",
  canais: [],
  sistemas: [],
  exigirImovel: true,
  statusNegocio: [],
  fases: [],
  corretores: [],
  diasSemAtividade: "",
};

// Perfis de filtro salvos (segmentos reutilizáveis).
type PerfilFiltro = {
  id: string;
  nome: string;
  padrao?: boolean;
  filtros: Filtros;
  criadoPorId?: string | null;
  criadoPorNome?: string;
  criadoEm?: string;
};

const comFiltros = (parcial: Partial<Filtros>): Filtros => ({ ...VAZIO, ...parcial });

const PERFIS_PADRAO: PerfilFiltro[] = [
  {
    id: "pad-alto-padrao",
    nome: "Alto padrão · acima de R$ 3 mi",
    padrao: true,
    filtros: comFiltros({ finalidade: "venda", precoMin: "3000000" }),
  },
  {
    id: "pad-apartamentos",
    nome: "Apartamentos à venda",
    padrao: true,
    filtros: comFiltros({ finalidade: "venda", tipos: ["Apartamento"] }),
  },
  {
    id: "pad-disponiveis",
    nome: "Disponíveis para venda",
    padrao: true,
    filtros: comFiltros({ finalidade: "venda", statusImovel: ["VENDA", "VENDA E ALUGUEL"] }),
  },
];

// Estilo dos campos de filtro. Preenchido = borda/fundo mais fortes (verde) para
// destacar o que já foi escolhido; vazio = clarinho, para não confundir.
const inputBase =
  "w-full border px-3 py-2 text-sm transition placeholder:text-neutral-400 focus:border-green-accent focus:outline-none";
const inputEmptyCls = "border-line bg-white text-neutral-700 hover:border-forest-900";
const inputFilledCls = "border-forest-900 bg-green-soft text-neutral-900 font-medium";
const campoCls = (filled: boolean) => `${inputBase} ${filled ? inputFilledCls : inputEmptyCls}`;
const inputCls = campoCls(false);

const dataEntradaBR = (iso: string | null) => (iso ? dataBR(iso.slice(0, 10)) : "");

export default function Campanhas() {
  const [rascunho, setRascunho] = useState<Filtros>(VAZIO);
  const [aplicado, setAplicado] = useState<Filtros | null>(null);
  const jaAplicou = aplicado !== null;

  // Dados vindos do Supabase ao vivo.
  const [facets, setFacets] = useState<FacetsCampanha | null>(null);
  const [resultado, setResultado] = useState<ResultadoCampanha | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Usuário logado (para atribuir e autorizar exclusão de perfis salvos).
  const { perfil: usuarioLogado, ehAdmin } = useAuth();

  // Perfis salvos (agora no banco, compartilhados pela equipe).
  const [perfisUsuario, setPerfisUsuario] = useState<PerfilFiltro[]>([]);
  const [modalPerfil, setModalPerfil] = useState(false);
  const [nomePerfil, setNomePerfil] = useState("");
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [confirmarPerfil, setConfirmarPerfil] = useState<PerfilFiltro | null>(null);
  const [perfilAtivo, setPerfilAtivo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [baixando, setBaixando] = useState<null | "csv" | "copia">(null);
  const perfis = [...PERFIS_PADRAO, ...perfisUsuario];

  // Carrega os valores dos filtros (bairros, categorias, status, origens).
  useEffect(() => {
    fetchFacets()
      .then(setFacets)
      .catch((e) => setErro(e?.message ?? "Falha ao carregar os filtros."));
  }, []);

  // Busca no Supabase sempre que os filtros aplicados mudam.
  useEffect(() => {
    if (!aplicado) {
      setResultado(null);
      setErro(null);
      return;
    }
    let ativo = true;
    setCarregando(true);
    setErro(null);
    fetchCampanha(aplicado)
      .then((r) => ativo && setResultado(r))
      .catch((e) => {
        if (!ativo) return;
        setErro(e?.message ?? "Erro ao consultar a base.");
        setResultado(null);
      })
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [aplicado]);

  // Carrega os perfis salvos do banco.
  useEffect(() => {
    let ativo = true;
    supabase
      .from("campanhas_perfis")
      .select("id, nome, filtros, criado_por, criado_por_nome, criado_em")
      .order("criado_em", { ascending: true })
      .then(({ data }) => {
        if (!ativo || !data) return;
        setPerfisUsuario(
          data.map((d) => ({
            id: d.id as string,
            nome: d.nome as string,
            filtros: comFiltros(d.filtros as Partial<Filtros>),
            criadoPorId: d.criado_por as string | null,
            criadoPorNome: (d.criado_por_nome as string) || "",
            criadoEm: d.criado_em as string,
          }))
        );
      });
    return () => {
      ativo = false;
    };
  }, []);

  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => {
    setPerfilAtivo(null);
    setRascunho((r) => ({ ...r, [k]: v }));
    // Mudou um filtro: esconde a lista até reaplicar, para nunca copiar/exportar
    // números de um filtro que ainda não foi aplicado.
    setAplicado(null);
  };

  const carregarPerfil = (p: PerfilFiltro) => {
    const f = comFiltros(p.filtros);
    setRascunho(f);
    // Só preenche os filtros; a lista do segmento só aparece ao "Aplicar filtros".
    setAplicado(null);
    setPerfilAtivo(p.id);
  };

  const salvarPerfil = async () => {
    const nome = nomePerfil.trim();
    if (!nome || !usuarioLogado) return;
    setSalvandoPerfil(true);
    try {
      const { data, error } = await supabase
        .from("campanhas_perfis")
        .insert({
          nome,
          filtros: rascunho,
          criado_por: usuarioLogado.id,
          criado_por_nome: usuarioLogado.nome || usuarioLogado.email,
        })
        .select("id, nome, filtros, criado_por, criado_por_nome, criado_em")
        .single();
      if (error) throw error;
      const novo: PerfilFiltro = {
        id: data.id,
        nome: data.nome,
        filtros: comFiltros(data.filtros as Partial<Filtros>),
        criadoPorId: data.criado_por,
        criadoPorNome: data.criado_por_nome || "",
        criadoEm: data.criado_em,
      };
      setPerfisUsuario((lista) => [...lista, novo]);
      setPerfilAtivo(novo.id);
      setNomePerfil("");
      setModalPerfil(false);
    } catch (e) {
      setErro((e as Error)?.message ?? "Falha ao salvar o perfil.");
    } finally {
      setSalvandoPerfil(false);
    }
  };

  // Só o criador ou um admin pode excluir um perfil salvo.
  const podeExcluirPerfil = (p: PerfilFiltro) =>
    !p.padrao && (ehAdmin || p.criadoPorId === usuarioLogado?.id);

  const excluirPerfil = async () => {
    const p = confirmarPerfil;
    if (!p) return;
    setConfirmarPerfil(null);
    try {
      const { error } = await supabase.from("campanhas_perfis").delete().eq("id", p.id);
      if (error) throw error;
      setPerfisUsuario((lista) => lista.filter((x) => x.id !== p.id));
      setPerfilAtivo((atual) => (atual === p.id ? null : atual));
    } catch (e) {
      setErro((e as Error)?.message ?? "Falha ao excluir o perfil.");
    }
  };

  const aplicar = () => setAplicado(rascunho);
  const limpar = () => {
    setRascunho(VAZIO);
    setAplicado(null);
    setPerfilAtivo(null);
  };

  // No modo "não exigir imóvel" o denominador do % é a base inteira de contatos.
  const semImovel = aplicado ? !aplicado.exigirImovel : false;

  const resumo = useMemo(() => {
    if (!resultado) {
      return { totalLeads: 0, tempoMedio: 0, vgvMedio: 0, vgvTotal: 0, percentualBase: 0 };
    }
    const base = (semImovel ? facets?.total_contatos_todos : facets?.total_contatos) ?? 0;
    return {
      totalLeads: resultado.totalLeads,
      tempoMedio: resultado.tempoMedioDias,
      vgvMedio: resultado.vgvMedio,
      vgvTotal: resultado.vgvTotal,
      percentualBase: base ? (resultado.totalLeads / base) * 100 : 0,
    };
  }, [resultado, facets, semImovel]);

  const grupos = resultado?.grupos ?? [];
  const temResultado = grupos.length > 0;

  // Exportar/copiar puxam a lista COMPLETA do filtro (não só o que está na
  // tela), por isso vão ao banco de novo em vez de usar `grupos`.
  const exportar = async () => {
    if (!aplicado) return;
    setBaixando("csv");
    setErro(null);
    try {
      const todos = await fetchTodosLeads(aplicado);
      exportarCSV(todos, aplicado.finalidade);
    } catch (e) {
      setErro((e as Error)?.message ?? "Falha ao exportar a lista.");
    } finally {
      setBaixando(null);
    }
  };

  const copiarNumeros = async () => {
    if (!aplicado) return;
    setBaixando("copia");
    setErro(null);
    try {
      const todos = await fetchTodosLeads(aplicado);
      const numeros = todos.map((g) => g.telefone).filter(Boolean).join("\n");
      try {
        await navigator.clipboard.writeText(numeros);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = numeros;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (e) {
      setErro((e as Error)?.message ?? "Falha ao copiar os números.");
    } finally {
      setBaixando(null);
    }
  };

  const bairrosOpt = facets?.bairros ?? [];
  const tiposOpt = facets?.categorias ?? [];
  const statusImovelOpt = facets?.status_imovel ?? [];
  const corretoresOpt = facets?.corretores ?? [];
  const canaisOpt = [...(facets?.canais ?? []), SEM_CANAL];

  // Fonte selecionada em cima → define quais bandeirinhas cada filtro mostra e
  // quais filtros exclusivos de uma fonte somem.
  const fonteSel = rascunho.sistemas.length ? rascunho.sistemas[0] : "todas";
  const flagsAmbos = fonteSel === "todas" ? ["realmente", "vista"] : [fonteSel];
  const vistaVisivel = fonteSel !== "realmente"; // filtros só-Vista somem se fonte=RealMate

  // Filtros de negócio (Vista). Fase depende do pipeline (finalidade).
  const statusNegocioOpt = facets?.status_negocio ?? [];
  const fasesOpt =
    rascunho.finalidade === "venda"
      ? facets?.fases_venda ?? []
      : rascunho.finalidade === "locacao"
      ? facets?.fases_aluguel ?? []
      : [];
  // Fase só faz sentido com um pipeline definido (finalidade venda OU locação,
  // exigindo imóvel) e com o Vista visível.
  const faseVisivel = vistaVisivel && rascunho.exigirImovel && rascunho.finalidade !== "ambos";

  // Trocar a finalidade limpa as fases (as etapas mudam de pipeline).
  const setFinalidade = (fin: Finalidade) => {
    setPerfilAtivo(null);
    setAplicado(null);
    setRascunho((r) => ({ ...r, finalidade: fin, fases: [] }));
  };

  return (
    <div className="min-h-full bg-sand">
      {/* Barra superior */}
      <div className="border-b border-line-strong bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3 transition hover:opacity-80" title="Voltar ao portal">
            <LuxtonMark size={36} />
            <div>
              <div className="text-xs uppercase tracking-widest text-neutral-500">
                Portal Luxton
              </div>
              <h1 className="font-title text-xl font-semibold text-forest-900">
                Campanhas de Leads
              </h1>
            </div>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-800"
          >
            <ArrowLeft size={16} /> Voltar ao portal
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Perfis salvos */}
        <section className="mb-6 border border-line-strong bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              <Bookmark size={14} /> Perfis salvos
            </div>
            <button
              onClick={() => {
                setNomePerfil("");
                setModalPerfil(true);
              }}
              className="inline-flex items-center gap-1.5 border border-line-strong px-3 py-1.5 text-sm font-medium text-forest-900 transition hover:border-forest-900 hover:bg-green-soft"
            >
              <BookmarkPlus size={15} /> Salvar filtros atuais
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {perfis.map((p) => {
              const ativo = perfilAtivo === p.id;
              const legenda = [
                p.criadoPorNome ? `por ${p.criadoPorNome}` : "",
                p.criadoEm ? dataBR(p.criadoEm.slice(0, 10)) : "",
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <span
                  key={p.id}
                  className={`inline-flex items-center gap-2 border px-3 py-1.5 text-sm transition ${
                    ativo
                      ? "border-forest-900 bg-forest-900 text-white"
                      : "border-line-strong bg-white text-neutral-700 hover:border-forest-900"
                  }`}
                >
                  <button
                    onClick={() => carregarPerfil(p)}
                    className="flex flex-col items-start text-left"
                    title="Carregar este perfil"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {p.padrao && <Lock size={12} className={ativo ? "text-white/80" : "text-neutral-400"} />}
                      {p.nome}
                    </span>
                    {!p.padrao && legenda && (
                      <span className={`text-[10px] ${ativo ? "text-white/70" : "text-neutral-400"}`}>
                        {legenda}
                      </span>
                    )}
                  </button>
                  {podeExcluirPerfil(p) && (
                    <button
                      onClick={() => setConfirmarPerfil(p)}
                      title="Excluir perfil"
                      className={ativo ? "text-white/80 hover:text-white" : "text-neutral-400 hover:text-red-600"}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </section>

        {/* Imóvel relacionado (exigir x pegar todos os contatos) */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-medium uppercase tracking-wider text-neutral-500">
            Imóvel relacionado
          </span>
          {(
            [
              { v: true, label: "Exigir" },
              { v: false, label: "Não exigir (todos)" },
            ]
          ).map((opt) => (
            <button
              key={opt.label}
              onClick={() => set("exigirImovel", opt.v)}
              className={`px-4 py-1.5 text-sm font-medium transition ${
                rascunho.exigirImovel === opt.v
                  ? "bg-forest-900 text-white"
                  : "bg-white text-neutral-700 ring-1 ring-inset ring-line-strong hover:bg-neutral-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Finalidade (só faz sentido com imóvel relacionado) */}
        {rascunho.exigirImovel && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-medium uppercase tracking-wider text-neutral-500">
              Tipo de negociação
            </span>
            {(["ambos", "venda", "locacao"] as Finalidade[]).map((fin) => (
              <button
                key={fin}
                onClick={() => setFinalidade(fin)}
                className={`px-5 py-1.5 text-sm font-medium transition ${
                  rascunho.finalidade === fin
                    ? "bg-forest-900 text-white"
                    : "bg-white text-neutral-700 ring-1 ring-inset ring-line-strong hover:bg-neutral-50"
                }`}
              >
                {fin === "venda" ? "Venda" : fin === "locacao" ? "Locação" : "Venda e locação"}
              </button>
            ))}
          </div>
        )}

        {/* Fonte do contato (RealMate x Vista) */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-medium uppercase tracking-wider text-neutral-500">
            Fonte do contato
          </span>
          {(
            [
              { v: [] as string[], label: "Todas" },
              { v: ["realmente"], label: "RealMate" },
              { v: ["vista"], label: "Vista" },
            ]
          ).map((opt) => {
            const ativo = JSON.stringify(rascunho.sistemas) === JSON.stringify(opt.v);
            return (
              <button
                key={opt.label}
                onClick={() => set("sistemas", opt.v)}
                className={`px-4 py-1.5 text-sm font-medium transition ${
                  ativo
                    ? "bg-forest-900 text-white"
                    : "bg-white text-neutral-700 ring-1 ring-inset ring-line-strong hover:bg-neutral-50"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Painel de filtros */}
        <section className="border border-line-strong bg-white p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-neutral-700">
            <Filter size={15} /> Filtros
          </div>

          {rascunho.exigirImovel && (
            <>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Imóvel de interesse
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MultiSelect
              label="Bairro"
              flags={flagsAmbos}
              options={bairrosOpt}
              selected={rascunho.bairros}
              onChange={(v) => set("bairros", v)}
            />
            <MultiSelect
              label="Tipo de imóvel"
              flags={flagsAmbos}
              options={tiposOpt}
              selected={rascunho.tipos}
              onChange={(v) => set("tipos", v)}
            />
            <Campo label="Faixa de preço (mín / máx)" flags={flagsAmbos}>
              <div className="flex items-center gap-2">
                <MoneyInput
                  prefix="R$ "
                  placeholder="Mín"
                  value={rascunho.precoMin}
                  onChange={(v) => set("precoMin", v)}
                />
                <MoneyInput
                  prefix="R$ "
                  placeholder="Máx"
                  value={rascunho.precoMax}
                  onChange={(v) => set("precoMax", v)}
                />
              </div>
            </Campo>
            <Campo label="Metragem m² (mín / máx)" flags={flagsAmbos}>
              <div className="flex items-center gap-2">
                <MoneyInput
                  placeholder="Mín"
                  value={rascunho.metragemMin}
                  onChange={(v) => set("metragemMin", v)}
                />
                <MoneyInput
                  placeholder="Máx"
                  value={rascunho.metragemMax}
                  onChange={(v) => set("metragemMax", v)}
                />
              </div>
            </Campo>
            <Campo label="Quartos (mín)" flags={flagsAmbos}>
              <select
                className={campoCls(!!rascunho.quartosMin)}
                value={rascunho.quartosMin}
                onChange={(e) => set("quartosMin", e.target.value)}
              >
                <option value="">Qualquer</option>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}+
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Vagas (mín)" flags={flagsAmbos}>
              <select
                className={campoCls(!!rascunho.vagasMin)}
                value={rascunho.vagasMin}
                onChange={(e) => set("vagasMin", e.target.value)}
              >
                <option value="">Qualquer</option>
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n}+
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Código do imóvel" flags={flagsAmbos}>
              <input
                className={campoCls(!!rascunho.codigoImovel)}
                placeholder="Ex.: 12345"
                value={rascunho.codigoImovel}
                onChange={(e) => set("codigoImovel", e.target.value)}
              />
            </Campo>
            <MultiSelect
              label="Status do imóvel"
              flags={flagsAmbos}
              options={statusImovelOpt}
              selected={rascunho.statusImovel}
              onChange={(v) => set("statusImovel", v)}
            />
          </div>
            </>
          )}
          {!rascunho.exigirImovel && (
            <div className="mb-2 border border-line bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
              Modo “todos os contatos”: valem fonte do contato, canal de aquisição, entrada e os
              filtros de negócio (corretor, status, fase, negócio parado). Ao usar um filtro de
              negócio, os campos de imóvel (bairro, tipo, preço, metragem, quartos, vagas, código,
              status) passam a mirar o imóvel do negócio.
            </div>
          )}

          <hr className="mt-6 border-t border-line-strong" />

          <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Do lead
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Campo label="Entrada (de)" flags={flagsAmbos}>
              <input
                type="date"
                className={campoCls(!!rascunho.dataInicial)}
                value={rascunho.dataInicial}
                onChange={(e) => set("dataInicial", e.target.value)}
              />
            </Campo>
            <Campo label="Entrada (até)" flags={flagsAmbos}>
              <input
                type="date"
                className={campoCls(!!rascunho.dataFinal)}
                value={rascunho.dataFinal}
                onChange={(e) => set("dataFinal", e.target.value)}
              />
            </Campo>
            <MultiSelect
              label="Canal de aquisição"
              flags={flagsAmbos}
              options={canaisOpt}
              selected={rascunho.canais}
              onChange={(v) => set("canais", v)}
            />
          </div>

          {vistaVisivel && (
            <>
              <hr className="mt-6 border-t border-line-strong" />
              <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Do negócio
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MultiSelect
                  label="Status do negócio"
                  flags={["vista"]}
                  options={statusNegocioOpt}
                  selected={rascunho.statusNegocio}
                  onChange={(v) => set("statusNegocio", v)}
                />
                {faseVisivel && (
                  <MultiSelect
                    label="Fase do negócio"
                    flags={["vista"]}
                    options={fasesOpt}
                    selected={rascunho.fases}
                    onChange={(v) => set("fases", v)}
                  />
                )}
                <MultiSelect
                  label="Corretor do negócio"
                  flags={["vista"]}
                  options={corretoresOpt}
                  selected={rascunho.corretores}
                  onChange={(v) => set("corretores", v)}
                />
                <Campo label="Negócio parado há + (dias)" flags={["vista"]}>
                  <input
                    className={campoCls(!!rascunho.diasSemAtividade)}
                    placeholder="Ex.: 30"
                    inputMode="numeric"
                    value={rascunho.diasSemAtividade}
                    onChange={(e) => set("diasSemAtividade", e.target.value.replace(/\D/g, ""))}
                  />
                </Campo>
              </div>
            </>
          )}

          {/* Chips das seleções múltiplas */}
          {(rascunho.bairros.length ||
            rascunho.tipos.length ||
            rascunho.statusImovel.length ||
            rascunho.canais.length ||
            rascunho.statusNegocio.length ||
            rascunho.fases.length ||
            rascunho.corretores.length) > 0 && (
            <div className="mt-5 space-y-2">
              <Chips
                values={[
                  ...rascunho.bairros,
                  ...rascunho.tipos,
                  ...rascunho.statusImovel,
                  ...rascunho.canais,
                  ...rascunho.statusNegocio,
                  ...rascunho.fases,
                  ...rascunho.corretores,
                ]}
                onRemove={(v) =>
                  setRascunho((r) => ({
                    ...r,
                    bairros: r.bairros.filter((x) => x !== v),
                    tipos: r.tipos.filter((x) => x !== v),
                    statusImovel: r.statusImovel.filter((x) => x !== v),
                    canais: r.canais.filter((x) => x !== v),
                    statusNegocio: r.statusNegocio.filter((x) => x !== v),
                    fases: r.fases.filter((x) => x !== v),
                    corretores: r.corretores.filter((x) => x !== v),
                  }))
                }
              />
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={aplicar}
              disabled={carregando}
              className="inline-flex items-center gap-2 bg-forest-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {carregando ? <Loader2 size={15} className="animate-spin" /> : <Filter size={15} />}
              Aplicar filtros
            </button>
            <button
              onClick={limpar}
              className="inline-flex items-center gap-2 border border-line-strong px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
            >
              <RotateCcw size={15} /> Limpar filtros
            </button>
          </div>
        </section>

        {erro && (
          <div className="mt-6 flex items-center gap-2 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle size={16} /> {erro}
          </div>
        )}

        {/* Cards de resumo */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <ResumoCard icon={Users2} cor="#2FA35A" label="Leads filtrados" valor={num(resumo.totalLeads)} />
          <ResumoCard
            icon={CalendarClock}
            cor="#3b5bdb"
            label="Tempo médio de entrada"
            valor={`${num(Math.round(resumo.tempoMedio))} dias`}
          />
          <ResumoCard icon={Coins} cor="#b78227" label="VGV médio" valor={semImovel ? "—" : brl(resumo.vgvMedio, true)} />
          <ResumoCard icon={Landmark} cor="#7c5cbf" label="VGV total" valor={semImovel ? "—" : brl(resumo.vgvTotal, true)} />
          <ResumoCard
            icon={PieChart}
            cor="#e8590c"
            label="% da base de contatos"
            valor={`${resumo.percentualBase.toFixed(1)}%`}
          />
        </div>

        {/* Lista de leads */}
        <section className="mt-6 overflow-hidden border border-line-strong bg-white">
          <div className="flex items-center justify-between gap-4 border-b border-line-strong px-6 py-4">
            <div>
              <h2 className="font-title text-lg font-semibold text-forest-900">
                Leads do segmento
              </h2>
              <p className="text-xs text-neutral-500">
                {!jaAplicou
                  ? "Aplique os filtros para gerar a lista."
                  : carregando
                  ? "Consultando a base..."
                  : resultado?.truncado
                  ? `${num(resumo.totalLeads)} lead(s) no total · exibindo os primeiros ${num(grupos.length)}. Use “Copiar números” ou “Exportar planilha” para a lista completa.`
                  : `${num(resumo.totalLeads)} lead(s) · imóveis exibidos são os que bateram com o filtro`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={copiarNumeros}
                disabled={!temResultado || baixando !== null}
                className="inline-flex items-center gap-2 border border-forest-900 px-4 py-2.5 text-sm font-medium text-forest-900 transition hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-40"
              >
                {baixando === "copia" ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Copiando...
                  </>
                ) : copiado ? (
                  <>
                    <Check size={15} /> Números copiados
                  </>
                ) : (
                  <>
                    <Copy size={15} /> Copiar números
                  </>
                )}
              </button>
              <button
                onClick={exportar}
                disabled={!temResultado || baixando !== null}
                className="inline-flex items-center gap-2 bg-green-accent px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {baixando === "csv" ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Gerando...
                  </>
                ) : (
                  <>
                    <Download size={15} /> Exportar planilha
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-line-strong bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
                  <th className="px-6 py-3 font-medium">Lead</th>
                  <th className="px-4 py-3 font-medium">Telefone</th>
                  <th className="px-4 py-3 font-medium">Imóvel(is) de interesse</th>
                  <th className="px-4 py-3 font-medium">Entrada</th>
                  <th className="px-6 py-3 font-medium">Canal de aquisição</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => (
                  <tr key={g.id} className="border-b border-line last:border-0 hover:bg-neutral-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-neutral-800">{g.nome}</div>
                      {g.email && <div className="text-xs text-neutral-400">{g.email}</div>}
                      {g.sistemas.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {g.sistemas.map((s) => (
                            <span
                              key={s}
                              className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                                s === "vista"
                                  ? "bg-violet-50 text-violet-700 ring-violet-600/20"
                                  : "bg-blue-50 text-blue-700 ring-blue-600/20"
                              }`}
                            >
                              {SISTEMA_LABEL[s] ?? s}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-neutral-600">{g.telefone}</td>
                    <td className="px-4 py-4">
                      {g.imoveis.length === 0 ? (
                        <span className="text-xs text-neutral-400">Sem imóvel relacionado</span>
                      ) : (
                        <div className="space-y-1">
                          {g.imoveis.map((im, i) => (
                            <div key={i} className="text-neutral-700">
                              <span className="font-medium">{im.codigo || "sem código"}</span>
                              <span className="text-neutral-400"> · </span>
                              {im.categoria}
                              <span className="text-neutral-400"> · </span>
                              {im.bairro}
                              {im.valor > 0 && (
                                <>
                                  <span className="text-neutral-400"> · </span>
                                  <span className="text-forest-700">{brl(im.valor)}</span>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-neutral-600">
                      {dataEntradaBR(g.entrada)}
                    </td>
                    <td className="px-6 py-4">
                      {g.canais.length ? (
                        <div className="flex flex-wrap gap-1">
                          {g.canais.map((c) => (
                            <span
                              key={c}
                              className="inline-flex items-center border border-line bg-green-soft px-2 py-0.5 text-xs text-forest-800"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400">Sem canal definido</span>
                      )}
                    </td>
                  </tr>
                ))}
                {carregando && (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-neutral-400">
                      <Loader2 size={20} className="mx-auto mb-2 animate-spin" />
                      Consultando a base de clientes...
                    </td>
                  </tr>
                )}
                {!carregando && grupos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-neutral-400">
                      {jaAplicou
                        ? "Nenhum lead corresponde aos filtros aplicados."
                        : "Defina os filtros acima e clique em “Aplicar filtros” para gerar a lista."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Modal salvar perfil */}
      {modalPerfil && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md border border-line-strong bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-line-strong px-6 py-4">
              <h2 className="font-title text-lg font-semibold text-forest-900">
                Salvar perfil de filtros
              </h2>
              <button
                onClick={() => setModalPerfil(false)}
                className="text-neutral-400 transition hover:text-neutral-700"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 px-6 py-5">
              <label className="block text-xs font-medium text-neutral-600">Nome do perfil</label>
              <input
                className={inputCls}
                autoFocus
                placeholder="Ex.: Apartamentos Moinhos até R$ 2 mi"
                value={nomePerfil}
                onChange={(e) => setNomePerfil(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && salvarPerfil()}
              />
              <p className="text-xs text-neutral-500">
                Guarda os filtros exatamente como estão agora, para reaplicar depois com um clique.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-line-strong px-6 py-4">
              <button
                onClick={() => setModalPerfil(false)}
                className="border border-line-strong px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
              >
                Cancelar
              </button>
              <button
                onClick={salvarPerfil}
                disabled={!nomePerfil.trim() || salvandoPerfil}
                className="inline-flex items-center gap-2 bg-forest-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {salvandoPerfil ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Salvar perfil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar exclusão de perfil salvo */}
      {confirmarPerfil && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md border border-line-strong bg-white shadow-xl">
            <div className="flex items-center gap-3 border-b border-line-strong px-6 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-red-50">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <h2 className="font-title text-lg font-semibold text-forest-900">Excluir perfil salvo</h2>
            </div>
            <div className="px-6 py-5 text-sm text-neutral-700">
              Excluir o perfil{" "}
              <span className="font-semibold text-neutral-900">{confirmarPerfil.nome}</span>? Ele deixa
              de aparecer para toda a equipe. Esta ação não pode ser desfeita.
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-line-strong px-6 py-4">
              <button
                onClick={() => setConfirmarPerfil(null)}
                className="border border-line-strong px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
              >
                Cancelar
              </button>
              <button
                onClick={excluirPerfil}
                className="inline-flex items-center gap-2 bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
              >
                <Trash2 size={16} /> Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({
  label,
  children,
  flags,
}: {
  label: string;
  children: React.ReactNode;
  flags?: string[];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-neutral-500">
        {label}
        <FonteFlags flags={flags} />
      </label>
      {children}
    </div>
  );
}

// Campo numérico com separador de milhares. Guarda só os dígitos (valor inteiro)
// no estado; mostra formatado. Enquanto está em foco, exibe sem os centavos
// (para digitar limpo, sem o cursor "tropeçar" no ,00); ao sair, mostra ",00".
// prefix="R$ " para preço; vazio para metragem.
function MoneyInput({
  value,
  onChange,
  prefix = "",
  placeholder,
}: {
  value: string; // dígitos (inteiro) ou ""
  onChange: (digits: string) => void;
  prefix?: string;
  placeholder?: string;
}) {
  const [focado, setFocado] = useState(false);
  const agrupado = value ? Number(value).toLocaleString("pt-BR") : "";
  const exibicao = !value ? "" : `${prefix}${agrupado}${focado ? "" : ",00"}`;
  return (
    <input
      className={campoCls(!!value)}
      inputMode="numeric"
      placeholder={placeholder}
      value={exibicao}
      onFocus={() => setFocado(true)}
      onBlur={() => setFocado(false)}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
    />
  );
}

function ResumoCard({
  icon: Icon,
  cor,
  label,
  valor,
}: {
  icon: typeof Users2;
  cor: string;
  label: string;
  valor: string;
}) {
  return (
    <div className="border border-line-strong bg-white p-5">
      <div
        className="mb-3 flex h-9 w-9 items-center justify-center"
        style={{ backgroundColor: `${cor}1a` }}
      >
        <Icon size={17} style={{ color: cor }} />
      </div>
      <div className="font-title text-2xl font-semibold text-forest-900">{valor}</div>
      <div className="mt-0.5 text-xs text-neutral-600">{label}</div>
    </div>
  );
}

function exportarCSV(grupos: LeadGrupo[], finalidade: Finalidade) {
  const cabecalho = ["Nome", "Telefone", "E-mail", "Fonte", "Imoveis de interesse", "Data de entrada", "Canal de aquisicao"];
  const escapar = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const linhasCsv = grupos.map((g) => {
    const imv = g.imoveis
      .map((im) => `${im.codigo} - ${im.categoria} - ${im.bairro} - ${im.valor > 0 ? brl(im.valor) : ""}`)
      .join(" | ");
    const canal = g.canais.length ? g.canais.join(" | ") : "Sem canal definido";
    const fontes = g.sistemas.map((s) => SISTEMA_LABEL[s] ?? s).join(" | ");
    return [g.nome, g.telefone, g.email, fontes, imv, dataEntradaBR(g.entrada), canal]
      .map((c) => escapar(String(c)))
      .join(",");
  });

  const csv = "﻿" + [cabecalho.join(","), ...linhasCsv].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `campanha-leads-${finalidade}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
