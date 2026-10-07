import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  History,
  Loader2,
  Lock,
  Pause,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";
import { num } from "../lib/format";
import { registrarLog } from "../lib/logs";
import { PALAVRAS_SUGERIDAS, acharCodigoNoTexto } from "../lib/codigoRegras";
import {
  aprovarTemplate,
  atualizarCampanhas,
  cancelarRetroativo,
  estimarRetroativo,
  iniciarRetroativo,
  ligarTemplate,
  listarNaoPadrao,
  listarPadrao,
  obterTeste,
  salvarNaoPadrao,
  salvarPadrao,
  testarTemplate,
  ultimoRetroativo,
  type JobRetro,
  type TemplateNaoPadrao,
  type TemplatePadrao,
  type TesteSalvo,
  type TipoTemplate,
} from "../lib/templatesApi";

type Item = TemplatePadrao | TemplateNaoPadrao;
type Props = { tipo: TipoTemplate; id: string | null; onFechar: () => void; onMudou: () => void };

const CANAIS = ["Meta Ads", "Chaves na Mão", "Zap", "Site", "Lead Ads", "Orgânico (WhatsApp)"];
const PERIODOS_TESTE = [7, 15, 30, 60];
const PERIODOS_PASSADO = [
  { k: "30", rotulo: "Últimos 30 dias", dias: 30 },
  { k: "90", rotulo: "Últimos 3 meses", dias: 90 },
  { k: "180", rotulo: "Últimos 6 meses", dias: 180 },
  { k: "365", rotulo: "Último ano", dias: 365 },
  { k: "tudo", rotulo: "Desde o começo (set/2024)", dias: 0 },
];
const desdeDo = (k: string) => {
  const p = PERIODOS_PASSADO.find((x) => x.k === k)!;
  return p.dias === 0 ? "2024-09-01" : new Date(Date.now() - p.dias * 86400000).toISOString().slice(0, 10);
};

const campoCls =
  "w-full border border-line bg-white px-3 py-2 text-sm text-neutral-800 transition placeholder:text-neutral-400 hover:border-forest-900 focus:border-green-accent focus:outline-none";
const rotuloCls = "mb-1.5 block text-sm font-medium text-neutral-700";
const ajudaCls = "mt-1.5 text-xs text-neutral-500";
const btnPrimario =
  "inline-flex items-center gap-2 bg-forest-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-40";
const btnSecundario =
  "inline-flex items-center gap-2 border border-forest-900 px-5 py-2.5 text-sm font-medium text-forest-900 transition hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-40";

const POR_PAGINA = 10;
const duracao = (min: number) => {
  if (min < 60) return `${num(Math.max(1, Math.round(min)))} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${num(h)} h ${m} min` : `${num(h)} h`;
};

const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

function Destacado({ texto, codigo }: { texto: string; codigo: string | null }) {
  if (!codigo) return <>{texto}</>;
  const partes = texto.split(codigo);
  return (
    <>
      {partes.map((p, i) => (
        <span key={i}>
          {p}
          {i < partes.length - 1 && <mark className="bg-amber-200 px-0.5 font-semibold text-neutral-900">{codigo}</mark>}
        </span>
      ))}
    </>
  );
}

// Uma pergunta do cadastro, separada das outras por uma linha.
function Bloco({ titulo, opcional, ajuda, children }: { titulo: string; opcional?: boolean; ajuda?: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line py-6 first:border-t-0 first:pt-0">
      <label className="mb-1 block text-sm font-semibold text-forest-900">
        {titulo} {opcional && <span className="font-normal text-neutral-400">(opcional)</span>}
      </label>
      {ajuda && <p className="mb-3 text-xs text-neutral-500">{ajuda}</p>}
      {!ajuda && <div className="mb-2" />}
      {children}
    </div>
  );
}

// Cartão de uma etapa do fluxo.
function Passo(p: {
  n: number;
  titulo: string;
  resumo?: string;
  feito: boolean;
  aberta: boolean;
  bloqueio?: string | null;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const bloqueado = !!p.bloqueio;
  return (
    <section className={`border bg-white ${p.aberta && !bloqueado ? "border-forest-900" : "border-line-strong"}`}>
      <button
        type="button"
        onClick={p.onToggle}
        disabled={bloqueado}
        className="flex w-full items-center gap-3 px-5 py-4 text-left disabled:cursor-not-allowed"
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center text-sm font-semibold ${
            p.feito ? "bg-forest-900 text-white" : bloqueado ? "bg-neutral-100 text-neutral-400" : "border border-forest-900 text-forest-900"
          }`}
        >
          {p.feito ? <Check size={15} /> : bloqueado ? <Lock size={13} /> : p.n}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-semibold ${bloqueado ? "text-neutral-400" : "text-forest-900"}`}>{p.titulo}</span>
          {(bloqueado ? p.bloqueio : p.resumo) && (
            <span className="block truncate text-xs text-neutral-500">{bloqueado ? p.bloqueio : p.resumo}</span>
          )}
        </span>
        {!bloqueado && <ChevronDown size={16} className={`shrink-0 text-neutral-400 transition ${p.aberta ? "rotate-180" : ""}`} />}
      </button>
      {p.aberta && !bloqueado && <div className="border-t border-line px-5 py-5">{p.children}</div>}
    </section>
  );
}

export function EditorTemplate({ tipo, id, onFechar, onMudou }: Props) {
  const ehPadrao = tipo === "padrao";
  const [idAtual, setIdAtual] = useState<string | null>(id);
  const [item, setItem] = useState<Item | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [aberta, setAberta] = useState(1);

  // ---- etapa 1: formulário ----
  const [nome, setNome] = useState("");
  const [canal, setCanal] = useState("");
  const [canalOutro, setCanalOutro] = useState(false);
  const [sinais, setSinais] = useState<string[]>([]);
  const [novoSinal, setNovoSinal] = useState("");
  const [notas, setNotas] = useState("");
  const [modo, setModo] = useState<"simples" | "especial">("simples");
  const [palavras, setPalavras] = useState<string[]>(["Cód", "Código"]);
  const [novaPalavra, setNovaPalavra] = useState("");
  const [link, setLink] = useState(false);
  const [isolado, setIsolado] = useState(false);
  const [exemplo, setExemplo] = useState("");
  const [salvoSnap, setSalvoSnap] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // ---- etapas 2 e 3: teste ----
  const [dias, setDias] = useState(30);
  const [testando, setTestando] = useState(false);
  const [erroTeste, setErroTeste] = useState<string | null>(null);
  const [teste, setTeste] = useState<TesteSalvo | null>(null);
  const [soProblemas, setSoProblemas] = useState(false);
  const [aprovando, setAprovando] = useState(false);
  const [prog, setProg] = useState<{ lidas: number; total: number; msgs: number } | null>(null);
  const [pagina, setPagina] = useState(1);
  const pararTeste = useRef(false);

  // ---- etapas 4 e 5: passado ----
  const [periodo, setPeriodo] = useState("30");
  const [estimativa, setEstimativa] = useState<{ sessoes: number; minutos: number; soAnuncios: boolean } | null>(null);
  const [job, setJob] = useState<JobRetro | null>(null);
  const [iniciando, setIniciando] = useState(false);
  const [refazer, setRefazer] = useState(false);
  const [erroRetro, setErroRetro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [campanhasOk, setCampanhasOk] = useState(false);
  const [ligando, setLigando] = useState(false);

  const forma = useMemo(
    () => ({ nome, canal, sinais, notas, modo, palavras, link, isolado }),
    [nome, canal, sinais, notas, modo, palavras, link, isolado]
  );
  const snapAtual = JSON.stringify(forma);
  const alterado = carregado && snapAtual !== salvoSnap;

  const carregarItem = useCallback(
    async (alvo: string): Promise<Item | null> => {
      const lista = ehPadrao ? await listarPadrao() : await listarNaoPadrao();
      return (lista.find((x) => x.id === alvo) as Item | undefined) ?? null;
    },
    [ehPadrao]
  );

  const aplicarItem = useCallback((it: Item | null) => {
    setItem(it);
    const f = {
      nome: it ? it.nome : "",
      canal: it && "canal" in it ? it.canal : "",
      sinais: it && "sinais" in it ? it.sinais : [],
      notas: it && "notas" in it ? it.notas ?? "" : "",
      modo: (it?.modo ?? "simples") as "simples" | "especial",
      palavras: it?.config_codigo?.palavras ?? (it && it.modo === "especial" ? [] : ["Cód", "Código"]),
      link: it?.config_codigo?.link ?? false,
      isolado: it?.config_codigo?.isolado ?? false,
    };
    setNome(f.nome);
    setCanal(f.canal);
    setCanalOutro(!!f.canal && !CANAIS.includes(f.canal));
    setSinais(f.sinais);
    setNotas(f.notas);
    setModo(f.modo);
    setPalavras(f.palavras);
    setLink(f.link);
    setIsolado(f.isolado);
    setSalvoSnap(JSON.stringify(f));
  }, []);

  const passoInicial = (it: Item | null) => {
    if (!it || it.etapa === "sem_config") return 1;
    if (it.etapa === "cadastrado") return 2;
    if (it.etapa === "testado") return 3;
    return 4;
  };

  const carregarTeste = useCallback(
    async (alvo: string) => {
      try {
        setTeste(await obterTeste(tipo, alvo));
      } catch {
        setTeste(null);
      }
    },
    [tipo]
  );

  useEffect(() => {
    (async () => {
      if (!id) {
        aplicarItem(null);
        setCarregado(true);
        return;
      }
      try {
        const it = await carregarItem(id);
        aplicarItem(it);
        setAberta(passoInicial(it));
        await carregarTeste(id);
        setJob(await ultimoRetroativo(tipo, id));
      } catch (e) {
        setErro((e as Error).message);
      }
      setCarregado(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // estimativa de tempo do passado
  useEffect(() => {
    if (aberta !== 4 || !idAtual) return;
    setEstimativa(null);
    estimarRetroativo(tipo, idAtual, desdeDo(periodo)).then(setEstimativa).catch(() => {});
  }, [aberta, periodo, idAtual, tipo]);

  // A atualização do passado roda sozinha no servidor (em segundo plano). Aqui só se acompanha o andamento.
  const rodando = job?.status === "rodando";
  const concluido = job?.status === "concluido";
  useEffect(() => {
    if (!idAtual || !rodando) return;
    let vivo = true;
    const t = setInterval(async () => {
      try {
        const j = await ultimoRetroativo(tipo, idAtual);
        if (!vivo) return;
        setJob(j);
        if (j && j.status === "concluido") {
          const it = await carregarItem(idAtual);
          if (!vivo) return;
          setItem(it);
          onMudou();
          setAberta(5);
        }
      } catch {
        /* tenta de novo no próximo ciclo */
      }
    }, 4000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idAtual, rodando, job?.id]);

  // ---- estado do fluxo ----
  const salvo = !!item && item.etapa !== "sem_config";
  const etapa = item?.etapa ?? "sem_config";
  const aprovado = etapa === "aprovado" || etapa === "em_uso";
  const emUso = etapa === "em_uso";
  const testeOk = !!teste?.valido && !alterado;
  const bloqueio2 = !salvo ? "Salve o cadastro para poder testar." : alterado ? "Salve as alterações para testar." : null;
  const bloqueio3 = bloqueio2 ?? (!testeOk ? "Rode o teste para ver os resultados." : null);
  const bloqueio4 = bloqueio3 ?? (!aprovado ? "Confira e aprove o resultado do teste primeiro." : null);
  const bloqueio5 = job ? null : "Aparece depois de atualizar o passado.";

  const exemploAchado = useMemo(
    () => (exemplo.trim() ? acharCodigoNoTexto(exemplo, { palavras, link, isolado }) : null),
    [exemplo, palavras, link, isolado]
  );

  // ---- ações ----
  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    setAviso(null);
    try {
      let alvo = idAtual;
      let pausado = false;
      if (ehPadrao && alvo) {
        pausado = (await salvarPadrao({ id: alvo, modo, palavras, link, isolado })).pausado;
      } else {
        const r = await salvarNaoPadrao({ id: alvo, nome, canal, sinais, notas, modo, palavras, link, isolado });
        alvo = r.id;
        pausado = r.pausado;
      }
      setIdAtual(alvo);
      registrarLog("template_salvo", { template: nome, tipo });
      const it = alvo ? await carregarItem(alvo) : null;
      aplicarItem(it);
      if (alvo) await carregarTeste(alvo);
      onMudou();
      setAviso(
        pausado
          ? "Salvo. Como a configuração mudou, o template ficou em pausa até ser testado e aprovado de novo."
          : "Salvo. Agora é só testar."
      );
      setAberta(2);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  // Lê as conversas em rodadas curtas, mostrando o andamento, até acabar (ou o usuário parar).
  const rodarTeste = async (continuar: boolean) => {
    if (!idAtual) return;
    setTestando(true);
    setErroTeste(null);
    pararTeste.current = false;
    let offset = continuar ? teste?.resumo?.sessoes_lidas ?? 0 : 0;
    setProg({ lidas: offset, total: continuar ? teste?.resumo?.total_sessoes ?? 0 : 0, msgs: continuar ? teste?.resumo?.casaram ?? 0 : 0 });
    let leu = continuar;
    try {
      for (;;) {
        const rd = await testarTemplate({ tipo, templateId: idAtual, dias, offset });
        leu = true;
        offset = rd.proximoOffset;
        const t = await obterTeste(tipo, idAtual);
        setTeste(t);
        setProg({ lidas: offset, total: rd.totalSessoes, msgs: t.resumo?.casaram ?? 0 });
        if (rd.sessoesLidas === 0 || offset >= rd.totalSessoes || pararTeste.current) break;
      }
    } catch (e) {
      setErroTeste((e as Error).message);
    } finally {
      if (leu) {
        try {
          await carregarTeste(idAtual);
          setItem(await carregarItem(idAtual));
          onMudou();
          setPagina(1);
          setAberta(3);
        } catch {
          /* mantém o que já está na tela */
        }
      }
      setTestando(false);
      setProg(null);
    }
  };

  const aprovar = async () => {
    if (!idAtual) return;
    setAprovando(true);
    setErroTeste(null);
    try {
      await aprovarTemplate(tipo, idAtual);
      setItem(await carregarItem(idAtual));
      await carregarTeste(idAtual);
      onMudou();
      setAberta(4);
    } catch (e) {
      setErroTeste((e as Error).message);
    } finally {
      setAprovando(false);
    }
  };

  const iniciarPassado = async () => {
    if (!idAtual) return;
    setErroRetro(null);
    setCampanhasOk(false);
    setRefazer(false);
    setIniciando(true);
    try {
      const r = await iniciarRetroativo({ tipo, templateId: idAtual, desde: desdeDo(periodo) });
      setJob(r.job);
      setItem(await carregarItem(idAtual));
      onMudou();
    } catch (e) {
      setErroRetro((e as Error).message);
    } finally {
      setIniciando(false);
    }
  };

  const pararPassado = async () => {
    if (!job) return;
    setErroRetro(null);
    try {
      const r = await cancelarRetroativo(job.id);
      if (r.job) setJob(r.job);
      else if (idAtual) setJob(await ultimoRetroativo(tipo, idAtual));
    } catch (e) {
      setErroRetro((e as Error).message);
    }
  };

  const alternarUso = async (ligar: boolean) => {
    if (!idAtual) return;
    setLigando(true);
    setErroRetro(null);
    try {
      await ligarTemplate(tipo, idAtual, ligar);
      setItem(await carregarItem(idAtual));
      onMudou();
    } catch (e) {
      setErroRetro((e as Error).message);
    } finally {
      setLigando(false);
    }
  };

  const atualizarAgora = async () => {
    setAtualizando(true);
    setErroRetro(null);
    try {
      await atualizarCampanhas();
      setCampanhasOk(true);
    } catch (e) {
      setErroRetro((e as Error).message);
    } finally {
      setAtualizando(false);
    }
  };

  // ---- auxiliares de formulário ----
  const alternarPalavra = (p: string) => setPalavras((l) => (l.includes(p) ? l.filter((x) => x !== p) : [...l, p]));
  const addPalavra = () => {
    const p = novaPalavra.trim();
    if (p && !palavras.some((x) => x.toLowerCase() === p.toLowerCase())) setPalavras((l) => [...l, p]);
    setNovaPalavra("");
  };
  const addSinal = (s?: string) => {
    const v = (s ?? novoSinal).trim();
    if (v && !sinais.includes(v)) setSinais((l) => [...l, v]);
    if (!s) setNovoSinal("");
  };

  const linhas = teste?.amostra ?? [];
  const filtradas = soProblemas ? linhas.filter((l) => !l.codigo || !l.imovel) : linhas;
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtradas.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);
  const r = teste?.resumo;
  const pct = job && job.total_sessoes > 0 ? Math.min(100, Math.round((job.sessoes_processadas / job.total_sessoes) * 100)) : 0;
  const padrao = ehPadrao ? (item as TemplatePadrao | null) : null;
  const titulo = ehPadrao ? padrao?.nome ?? "Template" : item?.nome || nome || "Novo template não padrão";
  const etapaTxt: Record<string, string> = {
    sem_config: "Em cadastro",
    cadastrado: "Cadastrado",
    testado: "Testado",
    aprovado: "Aprovado",
    em_uso: "Em uso",
  };

  const podeSalvar =
    carregado &&
    (!idAtual || alterado || etapa === "sem_config") &&
    (ehPadrao || (nome.trim() && canal.trim() && sinais.length > 0)) &&
    (modo === "especial" || palavras.length > 0 || link || isolado);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40">
      <div className="flex h-full w-full max-w-4xl flex-col bg-sand shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-line-strong bg-white px-6 py-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest text-neutral-500">
              {ehPadrao ? "Template padrão (RealMate)" : "Template não padrão"}
            </div>
            <h2 className="font-title truncate text-lg font-semibold text-forest-900">{titulo}</h2>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-2.5 py-1 text-xs font-medium ${
                emUso ? "bg-green-soft text-forest-800" : aprovado ? "bg-blue-50 text-blue-700" : "bg-neutral-100 text-neutral-600"
              }`}
            >
              {etapaTxt[etapa]}
            </span>
            {emUso && (
              <button
                onClick={() => alternarUso(false)}
                disabled={ligando}
                className="inline-flex items-center gap-1.5 border border-line-strong px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-40"
              >
                {ligando ? <Loader2 size={13} className="animate-spin" /> : <Pause size={13} />} Pausar
              </button>
            )}
            <button onClick={onFechar} className="text-neutral-400 transition hover:text-neutral-700" title="Fechar">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-6">
          {!carregado && (
            <div className="py-16 text-center text-neutral-400">
              <Loader2 size={22} className="mx-auto animate-spin" />
            </div>
          )}

          {carregado && (
            <>
              {/* ===================== 1. CADASTRAR ===================== */}
              <Passo
                n={1}
                titulo="Cadastrar"
                resumo={salvo && !alterado ? "Cadastro salvo" : undefined}
                feito={salvo && !alterado}
                aberta={aberta === 1}
                onToggle={() => setAberta(aberta === 1 ? 0 : 1)}
              >
                {ehPadrao && padrao && (
                  <Bloco titulo="Mensagem do template no RealMate">
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap border border-line bg-neutral-50 p-3 text-xs text-neutral-700">
                      {padrao.texto || "(sem texto)"}
                    </pre>
                    <p className={ajudaCls}>
                      {num(padrao.msgs)} mensagem(ns) deste template já guardada(s). O sistema reconhece o template
                      pelo próprio RealMate, então não precisa de palavras-chave.
                    </p>
                  </Bloco>
                )}

                {!ehPadrao && (
                  <>
                    <Bloco titulo="Nome do template">
                      <input className={campoCls} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Anúncio do Facebook" />
                    </Bloco>

                    <Bloco titulo="De onde vem esse lead?">
                      <select
                        className={campoCls}
                        value={canalOutro ? "__outro" : canal}
                        onChange={(e) => {
                          if (e.target.value === "__outro") {
                            setCanalOutro(true);
                            setCanal("");
                          } else {
                            setCanalOutro(false);
                            setCanal(e.target.value);
                          }
                        }}
                      >
                        <option value="">Escolha…</option>
                        {CANAIS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                        <option value="__outro">Outro…</option>
                      </select>
                      {canalOutro && (
                        <input className={`${campoCls} mt-2`} value={canal} onChange={(e) => setCanal(e.target.value)} placeholder="Digite o nome do canal" />
                      )}
                    </Bloco>

                    <Bloco
                      titulo="A mensagem precisa conter…"
                      ajuda="Palavras ou frases que sempre aparecem nesse tipo de mensagem. Se colocar mais de uma, a mensagem precisa ter todas. Maiúsculas e minúsculas não importam."
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {sinais.map((s) => (
                          <span key={s} className="inline-flex items-center gap-1 border border-line bg-green-soft px-2.5 py-1 text-sm text-forest-800">
                            {s}
                            <button type="button" onClick={() => setSinais((l) => l.filter((x) => x !== s))} className="hover:text-forest-950">
                              <X size={13} />
                            </button>
                          </span>
                        ))}
                        <input
                          className="min-w-[200px] flex-1 border border-line bg-white px-3 py-1.5 text-sm focus:border-green-accent focus:outline-none"
                          value={novoSinal}
                          onChange={(e) => setNovoSinal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addSinal();
                            }
                          }}
                          placeholder="Digite e tecle Enter"
                        />
                      </div>
                    </Bloco>
                  </>
                )}

                <Bloco titulo="Como achar o código do imóvel na mensagem?">
                  {modo === "especial" ? (
                    <div className="border border-line bg-neutral-50 p-4 text-sm text-neutral-700">
                      Este template usa uma <strong>regra especial</strong>, configurada pela equipe técnica, e
                      continua funcionando normalmente.
                      <div className="mt-3">
                        <button type="button" onClick={() => { setModo("simples"); setPalavras(["Cód", "Código"]); }} className="border border-line-strong px-3 py-1.5 text-xs font-medium text-forest-900 hover:bg-green-soft">
                          Trocar pelo modo simples
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mb-3 text-sm text-neutral-600">
                        Marque as palavras que aparecem <strong>logo antes do número</strong> do imóvel. Ex.: “Cód.
                        39227”, “Código: 38761”, “Ref 12345”.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {[...PALAVRAS_SUGERIDAS, ...palavras.filter((p) => !PALAVRAS_SUGERIDAS.includes(p))].map((p) => {
                          const on = palavras.includes(p);
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => alternarPalavra(p)}
                              className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-sm font-medium transition ${
                                on ? "border-forest-900 bg-forest-900 text-white" : "border-line-strong bg-white text-neutral-700 hover:border-forest-900"
                              }`}
                            >
                              {on && <Check size={13} />} {p}
                            </button>
                          );
                        })}
                        <input
                          className="w-48 border border-line bg-white px-3 py-1.5 text-sm focus:border-green-accent focus:outline-none"
                          value={novaPalavra}
                          onChange={(e) => setNovaPalavra(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addPalavra();
                            }
                          }}
                          placeholder="Outra palavra + Enter"
                        />
                      </div>
                      <p className={ajudaCls}>
                        Já funciona com ponto, dois-pontos, espaço, maiúscula e acento (Cód. · cód: · COD 123).
                      </p>

                      <div className="mt-4 space-y-2 text-sm text-neutral-700">
                        <label className="flex cursor-pointer items-start gap-2">
                          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0b3d2e]" checked={link} onChange={(e) => setLink(e.target.checked)} />
                          <span>Também procurar o código dentro do <strong>link do imóvel</strong> <span className="text-neutral-500">(…/imovel/38814/…)</span></span>
                        </label>
                        <label className="flex cursor-pointer items-start gap-2">
                          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0b3d2e]" checked={isolado} onChange={(e) => setIsolado(e.target.checked)} />
                          <span>
                            Se não achar, aceitar um <strong>número solto de 5 dígitos</strong>, só quando houver um único na mensagem{" "}
                            <span className="text-neutral-500">(menos preciso: pode confundir com preço ou telefone)</span>
                          </span>
                        </label>
                      </div>
                    </>
                  )}
                </Bloco>

                {modo !== "especial" && (
                  <Bloco titulo="Quer conferir?" opcional ajuda="Cole uma mensagem de exemplo e veja se o código é encontrado.">
                    <textarea className={`${campoCls} min-h-[64px]`} value={exemplo} onChange={(e) => setExemplo(e.target.value)} placeholder="Ex.: Pavilhão Industrial | Guaíba — R$ 10.000.000 | Cód. 39227" />
                    {exemplo.trim() && (
                      <p className={`mt-2 text-sm ${exemploAchado ? "text-forest-800" : "text-amber-800"}`}>
                        {exemploAchado ? (
                          <>✓ Código encontrado: <strong>{exemploAchado.codigo}</strong> <span className="text-neutral-500">({exemploAchado.como})</span></>
                        ) : (
                          "Nenhum código encontrado nessa mensagem com as opções escolhidas."
                        )}
                      </p>
                    )}
                  </Bloco>
                )}

                {!ehPadrao && (
                  <Bloco titulo="Anotações" opcional>
                    <textarea className={`${campoCls} min-h-[60px]`} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Algo que ajude a equipe a lembrar para que serve este template" />
                  </Bloco>
                )}

                {emUso && alterado && (
                  <div className="mt-5 flex items-start gap-2 border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    Este template está em uso. Ao salvar mudanças, ele fica em pausa até ser testado e aprovado de novo.
                    Nada se perde: ao reativar, o passado é atualizado.
                  </div>
                )}
                {erro && (
                  <div className="mt-5 flex items-start gap-2 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {erro}
                  </div>
                )}
                {aviso && !alterado && <div className="mt-5 border border-line bg-green-soft px-3 py-2 text-sm text-forest-800">{aviso}</div>}
                <div className="mt-5">
                  <button onClick={salvar} disabled={salvando || !podeSalvar} className={btnPrimario}>
                    {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar e continuar
                  </button>
                </div>
              </Passo>

              {/* ===================== 2. TESTAR ===================== */}
              <Passo
                n={2}
                titulo="Testar com conversas reais"
                resumo={testeOk && r ? `Testado em ${teste?.testado_em ? dataHora(teste.testado_em) : ""} · ${num(r.sessoes_lidas)} conversas lidas` : undefined}
                feito={testeOk}
                aberta={aberta === 2}
                bloqueio={bloqueio2}
                onToggle={() => setAberta(aberta === 2 ? 0 : 2)}
              >
                <p className="mb-4 text-sm text-neutral-600">
                  Vamos ler no RealMate todas as conversas do período escolhido e ver o que este template pegaria. <strong>Nada é
                  gravado nem muda nos leads</strong>: serve só para você conferir.
                </p>
                <div className="mb-4 flex flex-wrap items-end gap-4">
                  <div>
                    <label className={rotuloCls}>Conversas dos últimos…</label>
                    <select className={campoCls} value={dias} onChange={(e) => setDias(Number(e.target.value))}>
                      {PERIODOS_TESTE.map((d) => (
                        <option key={d} value={d}>{d} dias</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={() => rodarTeste(false)} disabled={testando} className={btnPrimario}>
                    {testando ? <Loader2 size={15} className="animate-spin" /> : <FlaskConical size={15} />}
                    {testando ? "Lendo o RealMate…" : testeOk ? "Testar de novo" : "Rodar teste"}
                  </button>
                  {testando && (
                    <button onClick={() => { pararTeste.current = true; }} className="inline-flex items-center gap-2 border border-red-400 px-5 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50">
                      <X size={15} /> Parar e ver o que achou
                    </button>
                  )}
                </div>
                {testando && prog && (
                  <div className="mb-4 border border-line bg-white p-4">
                    <div className="h-2 w-full bg-neutral-100">
                      <div className="h-2 bg-green-accent transition-all" style={{ width: `${prog.total > 0 ? Math.min(100, Math.round((prog.lidas / prog.total) * 100)) : 0}%` }} />
                    </div>
                    <div className="mt-2 text-xs text-neutral-600">
                      {prog.total > 0 ? `${num(prog.lidas)} de ${num(prog.total)} conversas lidas` : "Começando a leitura…"} · {num(prog.msgs)} mensagem(ns) encontrada(s) até agora
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">Fique nesta tela até terminar. Se preferir, clique em “Parar e ver o que achou” a qualquer momento.</p>
                  </div>
                )}
                {erroTeste && (
                  <div className="flex items-start gap-2 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {erroTeste}
                  </div>
                )}
              </Passo>

              {/* ===================== 3. CONFERIR ===================== */}
              <Passo
                n={3}
                titulo="Conferir os resultados"
                resumo={aprovado ? `Aprovado${teste?.aprovado_em ? ` em ${dataHora(teste.aprovado_em)}` : ""}` : undefined}
                feito={aprovado && !alterado}
                aberta={aberta === 3}
                bloqueio={bloqueio3}
                onToggle={() => setAberta(aberta === 3 ? 0 : 3)}
              >
                {r && (
                  <>
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="border border-line bg-white px-2.5 py-1">{num(r.sessoes_lidas)} de {num(r.total_sessoes)} conversas lidas (últimos {r.dias} dias)</span>
                      <span className="border border-line bg-white px-2.5 py-1">{num(r.casaram)} mensagem(ns) encontradas</span>
                      <span className="bg-green-soft px-2.5 py-1 text-forest-800">{num(r.ok)} com imóvel confirmado</span>
                      <span className="bg-amber-50 px-2.5 py-1 text-amber-800">{num(r.sem_codigo)} sem código</span>
                      <span className="bg-red-50 px-2.5 py-1 text-red-700">{num(r.codigo_inexistente)} imóvel não encontrado no Vista</span>
                      <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 text-neutral-600">
                        <input type="checkbox" className="accent-[#0b3d2e]" checked={soProblemas} onChange={(e) => { setSoProblemas(e.target.checked); setPagina(1); }} />
                        Mostrar só o que merece atenção
                      </label>
                    </div>

                    {linhas.length === 0 ? (
                      <p className="border border-line bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-600">
                        Nenhuma mensagem deste tipo apareceu nas conversas lidas. Isso pode ser normal se o template é
                        pouco usado: tente “Ler mais conversas” ou ajuste o cadastro.
                      </p>
                    ) : (
                      <div className="overflow-x-auto border border-line">
                        <table className="w-full min-w-[820px] text-left text-xs">
                          <thead className="bg-neutral-50 uppercase tracking-wider text-neutral-500">
                            <tr>
                              <th className="px-3 py-2 font-medium">Lead</th>
                              <th className="px-3 py-2 font-medium">Imóvel de interesse</th>
                              <th className="px-3 py-2 font-medium">Mensagem que o sistema leu</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visiveis.map((l, i) => (
                              <tr key={`${l.sessao}-${i}`} className="border-t border-line align-top">
                                <td className="whitespace-nowrap px-3 py-2">
                                  <div className="font-medium text-neutral-800">{l.contato}</div>
                                  <div className="text-neutral-600">{l.telefone || "sem telefone"}</div>
                                  <div className="text-neutral-400">{dataHora(l.data)}</div>
                                </td>
                                <td className="px-3 py-2">
                                  {l.codigo && l.imovel ? (
                                    <>
                                      <div className="font-semibold text-neutral-900">{l.codigo}</div>
                                      <div className="text-forest-800">✓ {l.imovel.categoria} · {l.imovel.bairro}</div>
                                    </>
                                  ) : l.codigo ? (
                                    <>
                                      <div className="font-semibold text-neutral-900">{l.codigo}</div>
                                      <span className="bg-red-50 px-1.5 py-0.5 text-red-700">imóvel não encontrado no Vista</span>
                                    </>
                                  ) : (
                                    <span className="bg-amber-50 px-1.5 py-0.5 text-amber-800">código não encontrado</span>
                                  )}
                                </td>
                                <td className="max-w-md px-3 py-2 text-neutral-700"><Destacado texto={l.trecho} codigo={l.codigo} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {filtradas.length > POR_PAGINA && (
                      <div className="mt-2 flex items-center justify-end gap-3 text-xs text-neutral-600">
                        <span>
                          {num((paginaAtual - 1) * POR_PAGINA + 1)}–{num(Math.min(paginaAtual * POR_PAGINA, filtradas.length))} de {num(filtradas.length)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPagina(paginaAtual - 1)}
                          disabled={paginaAtual <= 1}
                          className="border border-line-strong p-1.5 transition hover:bg-neutral-100 disabled:opacity-30"
                          title="Anterior"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <span>Página {paginaAtual} de {totalPaginas}</span>
                        <button
                          type="button"
                          onClick={() => setPagina(paginaAtual + 1)}
                          disabled={paginaAtual >= totalPaginas}
                          className="border border-line-strong p-1.5 transition hover:bg-neutral-100 disabled:opacity-30"
                          title="Próxima"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}

                    {r.sessoes_lidas < r.total_sessoes && (
                      <button onClick={() => rodarTeste(true)} disabled={testando} className="mt-3 inline-flex items-center gap-2 border border-line-strong px-4 py-2 text-sm text-forest-900 transition hover:bg-green-soft disabled:opacity-40">
                        {testando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Ler mais conversas
                      </button>
                    )}
                  </>
                )}

                {erroTeste && (
                  <div className="mt-3 flex items-start gap-2 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {erroTeste}
                  </div>
                )}

                <div className="mt-5 border-t border-line pt-5">
                  <p className="mb-3 text-sm font-medium text-neutral-800">Os resultados estão certos?</p>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={aprovar} disabled={aprovando || aprovado || !testeOk} className={btnPrimario}>
                      {aprovando ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                      {aprovado ? "Aprovado" : r && r.casaram === 0 ? "Aprovar mesmo sem resultados" : "Sim, aprovar"}
                    </button>
                    <button onClick={() => setAberta(1)} className={btnSecundario}>Preciso ajustar o cadastro</button>
                  </div>
                  {!aprovado && <p className={ajudaCls}>Se mudar o cadastro, o teste precisa ser refeito.</p>}
                </div>
              </Passo>

              {/* ===================== 4. ATUALIZAR O PASSADO ===================== */}
              <Passo
                n={4}
                titulo="Ligar e atualizar o passado"
                resumo={job?.status === "concluido" ? "Passado atualizado" : emUso ? "Em uso" : undefined}
                feito={job?.status === "concluido"}
                aberta={aberta === 4}
                bloqueio={bloqueio4}
                onToggle={() => setAberta(aberta === 4 ? 0 : 4)}
              >
                <p className="mb-4 text-sm text-neutral-600">
                  Ao ligar, as <strong>próximas</strong> mensagens deste tipo já passam a registrar o interesse do
                  contato pelo imóvel. Para valer também para as conversas <strong>antigas</strong>, escolha até quando
                  voltar no tempo: o sistema busca no RealMate e registra os interesses.
                </p>
                {concluido && !refazer && !rodando && !iniciando ? (
                  <div className="border border-forest-900 bg-green-soft px-4 py-4 text-sm text-forest-800">
                    <div className="flex items-center gap-2 font-semibold">
                      <Check size={16} /> Template ligado e passado atualizado
                    </div>
                    <p className="mt-1 text-forest-800/80">
                      As conversas desde {job!.desde.slice(0, 10).split("-").reverse().join("/")} já foram lidas e as novas mensagens
                      deste tipo passam a ser registradas automaticamente. Siga para o último passo.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      <button type="button" disabled className={btnPrimario}>
                        <History size={15} /> Passado já atualizado
                      </button>
                      <button type="button" onClick={() => setRefazer(true)} className="text-xs text-neutral-500 underline hover:text-neutral-700">
                        Refazer a atualização
                      </button>
                    </div>
                  </div>
                ) : (
                <>
                <div className="mb-4 flex flex-wrap gap-2">
                  {PERIODOS_PASSADO.map((p) => (
                    <button
                      key={p.k}
                      type="button"
                      disabled={rodando || iniciando}
                      onClick={() => setPeriodo(p.k)}
                      className={`border px-3 py-2 text-sm font-medium transition ${
                        periodo === p.k ? "border-forest-900 bg-forest-900 text-white" : "border-line-strong bg-white text-neutral-700 hover:border-forest-900"
                      }`}
                    >
                      {p.rotulo}
                    </button>
                  ))}
                </div>
                <p className="mb-4 text-xs text-neutral-500">
                  {estimativa
                    ? `Cerca de ${num(estimativa.sessoes)} conversas${estimativa.soAnuncios ? " vindas de anúncio" : ""} para ler, uns ${duracao(estimativa.minutos)}.`
                    : "Calculando o tempo…"}
                </p>
                {rodando && (
                  <div className="mb-4 flex items-start gap-2 border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                    <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" />
                    <span>
                      <strong>Em andamento, em segundo plano.</strong> Você pode sair desta tela e fazer outras coisas:
                      a atualização continua sozinha. Para parar, é só voltar aqui e clicar em “Parar”.
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  {!rodando ? (
                    <button onClick={iniciarPassado} disabled={iniciando} className={btnPrimario}>
                      {iniciando ? <Loader2 size={15} className="animate-spin" /> : <History size={15} />} Ligar e atualizar o passado
                    </button>
                  ) : (
                    <button onClick={pararPassado} className="inline-flex items-center gap-2 border border-red-400 px-5 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50">
                      <X size={15} /> Parar
                    </button>
                  )}
                  {!rodando && !iniciando && !emUso && (
                    <button onClick={() => alternarUso(true)} disabled={ligando} className={btnSecundario}>
                      {ligando && <Loader2 size={14} className="animate-spin" />} Só ligar daqui para frente
                    </button>
                  )}
                </div>

                </>
                )}

                {erroRetro && (
                  <div className="mt-4 flex items-start gap-2 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {erroRetro}
                  </div>
                )}

                {job && (
                  <div className="mt-5 border border-line bg-white p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600">
                      <span>Atualização de {dataHora(job.created_at)}, desde {job.desde.slice(0, 10).split("-").reverse().join("/")}</span>
                      <span
                        className={`px-2 py-0.5 font-medium ${
                          job.status === "concluido" ? "bg-green-soft text-forest-800" : job.status === "rodando" ? "bg-blue-50 text-blue-700" : job.status === "erro" ? "bg-red-50 text-red-700" : "bg-neutral-100 text-neutral-600"
                        }`}
                      >
                        {job.status === "concluido" ? "Concluída" : job.status === "rodando" ? "Em andamento" : job.status === "erro" ? "Erro" : "Cancelada"}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-neutral-100">
                      <div className="h-2 bg-green-accent transition-all" style={{ width: `${job.status === "concluido" ? 100 : pct}%` }} />
                    </div>
                    <div className="mt-2 text-xs text-neutral-600">
                      {num(job.sessoes_processadas)} de {num(job.total_sessoes)} conversas lidas · {num(job.mensagens_gravadas)} mensagem(ns) novas guardadas
                      {rodando && job.sessoes_processadas > 0 && job.total_sessoes > job.sessoes_processadas && (
                        <>
                          {" "}· faltam cerca de {duracao(((job.total_sessoes - job.sessoes_processadas) * (Date.now() - new Date(job.created_at).getTime())) / job.sessoes_processadas / 60000)}
                        </>
                      )}
                    </div>
                    {job.ultimo_erro && <div className="mt-2 text-xs text-red-700">{job.ultimo_erro}</div>}
                  </div>
                )}
              </Passo>

              {/* ===================== 5. RESULTADO ===================== */}
              <Passo
                n={5}
                titulo="Resultado"
                resumo={job?.status === "concluido" && job.resumo ? `${num(job.resumo.contatos)} contatos com interesse` : undefined}
                feito={campanhasOk}
                aberta={aberta === 5}
                bloqueio={bloqueio5}
                onToggle={() => setAberta(aberta === 5 ? 0 : 5)}
              >
                {concluido && job?.resumo ? (
                  <>
                    <p className="mb-3 text-sm text-neutral-600">
                      O sistema leu as conversas e registrou o interesse dos contatos pelos imóveis:
                    </p>
                    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        ["Mensagens deste template", job.resumo.mensagens],
                        ["Com código do imóvel", job.resumo.com_codigo],
                        ["Contatos com interesse", job.resumo.contatos],
                        ["Interesses (contato × imóvel)", job.resumo.pares_contato_imovel],
                      ].map(([rot, v]) => (
                        <div key={String(rot)} className="border border-line p-3">
                          <div className="font-title text-xl font-semibold text-forest-900">{num(Number(v))}</div>
                          <div className="text-xs text-neutral-500">{rot}</div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-line pt-5">
                      <p className="mb-1 text-sm font-semibold text-forest-900">Mostrar esses interesses na tela de Campanhas</p>
                      <p className="mb-3 text-xs text-neutral-500">
                        A tela de Campanhas usa uma cópia dos dados, que se atualiza sozinha às 06h, 12h e 18h. Se quiser ver
                        agora, clique abaixo (leva até 1 minuto). Se não clicar, tudo bem: aparece na próxima atualização.
                      </p>
                      <button onClick={atualizarAgora} disabled={atualizando || campanhasOk} className={btnSecundario}>
                        {atualizando ? <Loader2 size={14} className="animate-spin" /> : campanhasOk ? <Check size={14} /> : <RefreshCw size={14} />}
                        {campanhasOk ? "Campanhas atualizadas" : atualizando ? "Atualizando… (até 1 min)" : "Atualizar Campanhas agora"}
                      </button>
                    </div>

                    <div className="mt-6 border border-forest-900 bg-green-soft px-4 py-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-forest-800">
                        <Check size={16} /> Cadastro concluído
                      </div>
                      <p className="mt-1 text-sm text-forest-800/80">
                        O template “{titulo}” está em uso. Não falta mais nada: você já pode voltar para a página inicial.
                      </p>
                      <button onClick={onFechar} className={`${btnPrimario} mt-3`}>
                        Concluir e voltar
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-neutral-500">O resultado aparece quando a atualização do passado terminar.</p>
                )}
              </Passo>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
