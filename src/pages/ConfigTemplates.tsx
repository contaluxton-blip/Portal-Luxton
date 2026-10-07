import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Loader2, Pencil, Plus, Search, Settings, Trash2, X } from "lucide-react";
import { LuxtonMark } from "../components/Logo";
import { EditorTemplate } from "../components/EditorTemplate";
import { registrarLog } from "../lib/logs";
import { num, dataBR } from "../lib/format";
import {
  excluirNaoPadrao,
  ligarTemplate,
  listarNaoPadrao,
  listarPadrao,
  type Etapa,
  type TemplateNaoPadrao,
  type TemplatePadrao,
} from "../lib/templatesApi";

type Aba = "padrao" | "nao_padrao";
type Editando = { tipo: Aba; id: string | null; chave: number } | null;

const ETAPA_TXT: Record<Etapa, string> = {
  sem_config: "Falta configurar",
  cadastrado: "Falta testar",
  testado: "Falta aprovar",
  aprovado: "Aprovado",
  em_uso: "Em uso",
};
const ETAPA_COR: Record<Etapa, string> = {
  sem_config: "bg-neutral-100 text-neutral-600",
  cadastrado: "bg-amber-50 text-amber-800",
  testado: "bg-amber-50 text-amber-800",
  aprovado: "bg-blue-50 text-blue-700",
  em_uso: "bg-green-soft text-forest-800",
};

function Interruptor({ ligado, onClick, disabled, titulo }: { ligado: boolean; onClick: () => void; disabled?: boolean; titulo?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      title={titulo}
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-40 ${ligado ? "bg-forest-900" : "bg-neutral-300"}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${ligado ? "translate-x-[18px]" : "translate-x-0.5"}`} />
    </button>
  );
}

const STATUS_COR: Record<string, string> = {
  APPROVED: "bg-green-soft text-forest-800",
  DISAPPROVED: "bg-red-50 text-red-700",
  INREVISION: "bg-amber-50 text-amber-800",
};
const STATUS_TXT: Record<string, string> = { APPROVED: "Aprovado", DISAPPROVED: "Reprovado", INREVISION: "Em revisão" };

export default function ConfigTemplates() {
  const [aba, setAba] = useState<Aba>("padrao");
  const [padrao, setPadrao] = useState<TemplatePadrao[] | null>(null);
  const [naoPadrao, setNaoPadrao] = useState<TemplateNaoPadrao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "ligados" | "desligados">("todos");
  const [editando, setEditando] = useState<Editando>(null);
  const [trabalhando, setTrabalhando] = useState<string | null>(null);
  const [excluir, setExcluir] = useState<TemplateNaoPadrao | null>(null);
  const [apagarMsgs, setApagarMsgs] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);

  useEffect(() => {
    registrarLog("entrou_config_templates");
  }, []);

  const carregar = useCallback(async () => {
    try {
      const [p, n] = await Promise.all([listarPadrao(), listarNaoPadrao()]);
      setPadrao(p);
      setNaoPadrao(n);
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  const padraoFiltrado = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (padrao ?? []).filter(
      (t) =>
        (filtro === "todos" || (filtro === "ligados" ? t.interesse : !t.interesse)) &&
        (!q || `${t.nome} ${t.nome_interno ?? ""} ${t.texto ?? ""}`.toLowerCase().includes(q))
    );
  }, [padrao, busca, filtro]);

  // Liga/desliga direto da lista. Só liga o que já foi testado e aprovado; senão abre o passo a passo.
  const alternarUso = async (tipo: Aba, t: TemplatePadrao | TemplateNaoPadrao) => {
    const ligado = t.etapa === "em_uso";
    if (!ligado && t.etapa !== "aprovado") {
      setEditando({ tipo, id: t.id, chave: Date.now() });
      return;
    }
    setTrabalhando(t.id);
    try {
      await ligarTemplate(tipo, t.id, !ligado);
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setTrabalhando(null);
    }
  };

  const confirmarExcluir = async () => {
    if (!excluir) return;
    setExcluindo(true);
    setErroExcluir(null);
    try {
      await excluirNaoPadrao(excluir.id, apagarMsgs);
      registrarLog("template_excluido", { template: excluir.nome, tipo: "nao_padrao" });
      setExcluir(null);
      setApagarMsgs(false);
      await carregar();
    } catch (e) {
      setErroExcluir((e as Error).message.replace(/^MENSAGENS_VINCULADAS:\d+/, "Há mensagens vinculadas: marque a opção para apagá-las também."));
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div className="min-h-full bg-sand">
      <div className="border-b border-line-strong bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3 transition hover:opacity-80" title="Voltar ao portal">
            <LuxtonMark size={36} />
            <div>
              <div className="text-xs uppercase tracking-widest text-neutral-500">Campanhas de Leads</div>
              <h1 className="font-title flex items-center gap-2 text-xl font-semibold text-forest-900">
                <Settings size={18} /> Configurações · Templates
              </h1>
            </div>
          </Link>
          <Link
            to="/campanhas"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-800"
          >
            <ArrowLeft size={16} /> Voltar para Campanhas
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-6 py-8">
        <p className="mb-5 max-w-4xl text-sm text-neutral-600">
          Defina de quais mensagens do RealMate sai o <strong>interesse do lead por um imóvel</strong>. Cada
          template tem regras para achar o código do imóvel; você pode testar com mensagens reais antes de ativar
          e depois gerar o interesse retroativo.
        </p>

        {erro && (
          <div className="mb-5 flex items-center gap-2 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle size={16} /> {erro}
          </div>
        )}

        <div className="mb-5 flex gap-1 border-b border-line-strong">
          {(
            [
              { v: "padrao", label: "Templates padrão (RealMate)", n: padrao?.length },
              { v: "nao_padrao", label: "Templates não padrão", n: naoPadrao?.length },
            ] as { v: Aba; label: string; n?: number }[]
          ).map((a) => (
            <button
              key={a.v}
              onClick={() => setAba(a.v)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                aba === a.v ? "border-forest-900 text-forest-900" : "border-transparent text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {a.label} {a.n != null && <span className="ml-1 text-xs text-neutral-400">({a.n})</span>}
            </button>
          ))}
        </div>

        {/* ------------------------------ PADRÃO ------------------------------ */}
        {aba === "padrao" && (
          <section className="border border-line-strong bg-white">
            <div className="flex flex-wrap items-center gap-3 border-b border-line-strong px-5 py-3">
              <div className="relative w-full max-w-xs">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  className="w-full border border-line bg-white py-2 pl-8 pr-3 text-sm focus:border-green-accent focus:outline-none"
                  placeholder="Buscar template…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              <div className="flex gap-1">
                {(["todos", "ligados", "desligados"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFiltro(f)}
                    className={`px-3 py-1.5 text-xs font-medium transition ${
                      filtro === f ? "bg-forest-900 text-white" : "bg-white text-neutral-700 ring-1 ring-inset ring-line-strong hover:bg-neutral-50"
                    }`}
                  >
                    {f === "todos" ? "Todos" : f === "ligados" ? "Gera interesse" : "Desligados"}
                  </button>
                ))}
              </div>
              <span className="ml-auto text-xs text-neutral-500">
                Novos templates do RealMate chegam sozinhos (3 vezes ao dia) e começam desligados.
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line-strong bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
                    <th className="px-5 py-3 font-medium">Template</th>
                    <th className="px-4 py-3 font-medium">No RealMate</th>
                    <th className="px-4 py-3 font-medium">Criado</th>
                    <th className="px-4 py-3 font-medium">Mensagens guardadas</th>
                    <th className="px-4 py-3 font-medium">Etapa</th>
                    <th className="px-4 py-3 font-medium">Em uso</th>
                    <th className="px-5 py-3 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {padrao === null && (
                    <tr><td colSpan={7} className="px-6 py-14 text-center text-neutral-400"><Loader2 size={20} className="mx-auto mb-2 animate-spin" /> Carregando…</td></tr>
                  )}
                  {padraoFiltrado.map((t) => (
                    <tr key={t.id} className="border-b border-line align-top last:border-0 hover:bg-neutral-50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-neutral-800">{t.nome}</div>
                        <div className="max-w-md truncate text-xs text-neutral-500">{t.texto}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium ${STATUS_COR[t.status ?? ""] ?? "bg-neutral-100 text-neutral-600"}`}>
                          {STATUS_TXT[t.status ?? ""] ?? t.status ?? "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{t.criado ? dataBR(t.criado.slice(0, 10)) : "—"}</td>
                      <td className="px-4 py-3 text-neutral-600">
                        {t.msgs > 0 ? <>{num(t.msgs)} <span className="text-xs text-neutral-400">({num(t.msgs_com_codigo)} com código)</span></> : <span className="text-neutral-400">nenhuma</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium ${ETAPA_COR[t.etapa]}`}>{ETAPA_TXT[t.etapa]}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Interruptor
                          ligado={t.etapa === "em_uso"}
                          onClick={() => alternarUso("padrao", t)}
                          disabled={trabalhando === t.id}
                          titulo={t.etapa === "em_uso" ? "Pausar" : t.etapa === "aprovado" ? "Ligar" : "Abrir o passo a passo para testar e aprovar"}
                        />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => setEditando({ tipo: "padrao", id: t.id, chave: Date.now() })}
                          className="inline-flex items-center gap-1.5 border border-line-strong px-3 py-1.5 text-xs font-medium text-forest-900 transition hover:border-forest-900 hover:bg-green-soft"
                        >
                          <Pencil size={13} /> Abrir passo a passo
                        </button>
                      </td>
                    </tr>
                  ))}
                  {padrao !== null && padraoFiltrado.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-neutral-400">Nenhum template encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ------------------------------ NÃO PADRÃO ------------------------------ */}
        {aba === "nao_padrao" && (
          <section className="border border-line-strong bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-strong px-5 py-3">
              <p className="text-xs text-neutral-500">
                Mensagens sem template do RealMate (portais, anúncios…). O sistema reconhece pelas palavras-chave e
                acha o código do imóvel pelas regras.
              </p>
              <button
                onClick={() => setEditando({ tipo: "nao_padrao", id: null, chave: Date.now() })}
                className="inline-flex items-center gap-2 bg-forest-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-forest-800"
              >
                <Plus size={15} /> Novo template
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line-strong bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
                    <th className="px-5 py-3 font-medium">Template</th>
                    <th className="px-4 py-3 font-medium">Canal</th>
                    <th className="px-4 py-3 font-medium">Palavras-chave</th>
                    <th className="px-4 py-3 font-medium">Mensagens guardadas</th>
                    <th className="px-4 py-3 font-medium">Etapa</th>
                    <th className="px-4 py-3 font-medium">Em uso</th>
                    <th className="px-5 py-3 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {naoPadrao === null && (
                    <tr><td colSpan={7} className="px-6 py-14 text-center text-neutral-400"><Loader2 size={20} className="mx-auto mb-2 animate-spin" /> Carregando…</td></tr>
                  )}
                  {(naoPadrao ?? []).map((t) => (
                    <tr key={t.id} className="border-b border-line align-top last:border-0 hover:bg-neutral-50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-neutral-800">{t.nome}</div>
                        <div className="text-xs text-neutral-500">{t.modo === "especial" ? "Regra especial" : (t.config_codigo?.palavras ?? []).join(" · ") || "Código no link / número solto"}</div>
                      </td>
                      <td className="px-4 py-3 text-neutral-700">{t.canal}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {t.sinais.map((s) => (
                            <span key={s} className="border border-line bg-green-soft px-2 py-0.5 text-xs text-forest-800">{s}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {t.msgs > 0 ? <>{num(t.msgs)} <span className="text-xs text-neutral-400">({num(t.msgs_com_codigo)} com código)</span></> : <span className="text-neutral-400">nenhuma</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium ${ETAPA_COR[t.etapa]}`}>{ETAPA_TXT[t.etapa]}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Interruptor
                          ligado={t.etapa === "em_uso"}
                          onClick={() => alternarUso("nao_padrao", t)}
                          disabled={trabalhando === t.id}
                          titulo={t.etapa === "em_uso" ? "Pausar" : t.etapa === "aprovado" ? "Ligar" : "Abrir o passo a passo para testar e aprovar"}
                        />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        <button
                          onClick={() => setEditando({ tipo: "nao_padrao", id: t.id, chave: Date.now() })}
                          className="mr-2 inline-flex items-center gap-1.5 border border-line-strong px-3 py-1.5 text-xs font-medium text-forest-900 transition hover:border-forest-900 hover:bg-green-soft"
                        >
                          <Pencil size={13} /> Abrir passo a passo
                        </button>
                        <button
                          onClick={() => { setExcluir(t); setApagarMsgs(false); setErroExcluir(null); }}
                          className="inline-flex items-center border border-line-strong p-1.5 text-neutral-500 transition hover:border-red-400 hover:text-red-600"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {naoPadrao !== null && naoPadrao.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-neutral-400">Nenhum template não padrão cadastrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {editando && (
        <EditorTemplate
          key={editando.chave}
          tipo={editando.tipo}
          id={editando.id}
          onFechar={() => { setEditando(null); carregar(); }}
          onMudou={carregar}
        />
      )}

      {excluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md border border-line-strong bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-line-strong px-6 py-4">
              <h2 className="font-title text-lg font-semibold text-forest-900">Excluir template</h2>
              <button onClick={() => setExcluir(null)} className="text-neutral-400 hover:text-neutral-700"><X size={18} /></button>
            </div>
            <div className="space-y-3 px-6 py-5 text-sm text-neutral-700">
              <p>Excluir o template <strong>{excluir.nome}</strong>? Para só parar de usar, prefira desativá-lo.</p>
              {excluir.msgs > 0 && (
                <label className="flex cursor-pointer items-start gap-2 border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                  <input type="checkbox" className="mt-0.5 accent-[#0b3d2e]" checked={apagarMsgs} onChange={(e) => setApagarMsgs(e.target.checked)} />
                  <span>
                    Este template tem <strong>{num(excluir.msgs)} mensagem(ns)</strong> guardada(s), que sustentam
                    interesses de leads. Marque para apagá-las também (os interesses vindos delas somem).
                  </span>
                </label>
              )}
              {erroExcluir && <p className="text-red-700">{erroExcluir}</p>}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-line-strong px-6 py-4">
              <button onClick={() => setExcluir(null)} className="border border-line-strong px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100">Cancelar</button>
              <button
                onClick={confirmarExcluir}
                disabled={excluindo || (excluir.msgs > 0 && !apagarMsgs)}
                className="inline-flex items-center gap-2 bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-40"
              >
                {excluindo ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
