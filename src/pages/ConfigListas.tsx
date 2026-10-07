import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { LuxtonMark } from "../components/Logo";
import { AbasConfig } from "../components/AbasConfig";
import { num } from "../lib/format";
import { chaveTelefone, formatarTelefone } from "../lib/telefone";
import {
  adicionarIgnorados,
  buscarContatos,
  listarIgnorados,
  removerIgnorados,
  resolverTelefones,
  type ContatoBusca,
  type Ignorado,
} from "../lib/ignoradosApi";

const POR_PAGINA = 10;
const campoCls =
  "w-full border border-line bg-white px-3 py-2 text-sm text-neutral-800 transition placeholder:text-neutral-400 hover:border-forest-900 focus:border-green-accent focus:outline-none";
const btnPrimario =
  "inline-flex items-center gap-2 bg-forest-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-40";
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

// Contato na fila (ainda NÃO está na lista de ignorados).
type ItemFila = ContatoBusca & { encontrado: boolean };

function EtiquetasFonte({ rm, vi }: { rm: boolean; vi: boolean }) {
  return (
    <>
      {rm && <span className="bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">RealMate</span>}
      {vi && <span className="bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-inset ring-violet-600/20">Vista</span>}
    </>
  );
}

export default function ConfigListas() {
  const [lista, setLista] = useState<Ignorado[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // ---- fila: tudo o que é buscado ou colado vem para cá; só "Adicionar" grava na lista ----
  const [fila, setFila] = useState<ItemFila[]>([]);
  const [motivo, setMotivo] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  // busca por telefone/nome
  const [q, setQ] = useState("");
  const [achados, setAchados] = useState<ContatoBusca[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  // lista colada (só telefones, um por linha)
  const [texto, setTexto] = useState("");
  const [resolvendo, setResolvendo] = useState(false);
  const [avisoColar, setAvisoColar] = useState<string | null>(null);

  // tabela da lista
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [confirmarRemover, setConfirmarRemover] = useState(false);
  const [removendo, setRemovendo] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setLista(await listarIgnorados());
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  const naFila = useMemo(() => new Set(fila.map((f) => f.chave)), [fila]);
  const paraAdicionar = fila.filter((f) => !f.ja_ignorado);

  const poNaFila = (itens: ItemFila[]) =>
    setFila((atual) => {
      const vistos = new Set(atual.map((x) => x.chave));
      return [...atual, ...itens.filter((i) => !vistos.has(i.chave))];
    });

  // ---- busca (espera parar de digitar) ----
  useEffect(() => {
    const termo = q.trim();
    const digitos = termo.replace(/\D/g, "");
    const pesquisavel = /[A-Za-zÀ-ÿ]/.test(termo) ? termo.length >= 3 : digitos.length >= 4;
    if (!pesquisavel) {
      setAchados(null);
      setBuscando(false);
      return;
    }
    let ativo = true;
    setBuscando(true);
    const t = setTimeout(() => {
      buscarContatos(termo)
        .then((r) => ativo && setAchados(r))
        .catch((e) => ativo && setErro((e as Error).message))
        .finally(() => ativo && setBuscando(false));
    }, 400);
    return () => {
      ativo = false;
      clearTimeout(t);
    };
  }, [q]);

  // ---- lista colada: só telefones ----
  const tokens = useMemo(() => texto.split(/[\n;,]+/).map((t) => t.trim()).filter(Boolean), [texto]);
  const tokensValidos = tokens.filter((t) => chaveTelefone(t)).length;

  const colocarListaNaFila = async () => {
    setResolvendo(true);
    setErro(null);
    setAvisoColar(null);
    try {
      const validos = tokens.filter((t) => chaveTelefone(t));
      const r = await resolverTelefones(validos);
      const antes = new Set(fila.map((f) => f.chave));
      poNaFila(r);
      const novos = r.filter((x) => !antes.has(x.chave)).length;
      const partes = [`${num(novos)} contato(s) na fila`];
      const invalidos = tokens.length - tokensValidos;
      if (invalidos > 0) partes.push(`${num(invalidos)} linha(s) sem telefone válido`);
      const repetidos = validos.length - r.length;
      if (repetidos > 0) partes.push(`${num(repetidos)} repetido(s)`);
      const naoAchados = r.filter((x) => !x.encontrado).length;
      if (naoAchados > 0) partes.push(`${num(naoAchados)} sem cadastro no RealMate/Vista`);
      setAvisoColar(partes.join(" · "));
      setTexto("");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setResolvendo(false);
    }
  };

  // ---- gravar a fila na lista de ignorados ----
  const adicionarFila = async () => {
    setAdicionando(true);
    setErro(null);
    setResultado(null);
    try {
      const r = await adicionarIgnorados(
        paraAdicionar.map((f) => ({ telefone: f.telefone, ...(f.nome ? { nome: f.nome } : {}) })),
        motivo
      );
      const partes = [`${num(r.adicionados)} contato(s) adicionado(s) à lista de ignorados`];
      if (r.ja_existiam) partes.push(`${num(r.ja_existiam)} já estava(m) na lista`);
      setResultado(partes.join(" · "));
      setFila([]);
      setMotivo("");
      setAchados(null);
      setQ("");
      setAvisoColar(null);
      setPagina(1);
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setAdicionando(false);
    }
  };

  // ---- tabela da lista ----
  const filtrada = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const dig = t.replace(/\D/g, "");
    return (lista ?? []).filter(
      (i) =>
        !t ||
        (i.nome ?? "").toLowerCase().includes(t) ||
        (i.motivo ?? "").toLowerCase().includes(t) ||
        (dig.length >= 3 && i.telefone.includes(dig))
    );
  }, [lista, busca]);
  const totalPaginas = Math.max(1, Math.ceil(filtrada.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrada.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);
  const todosVisiveisMarcados = visiveis.length > 0 && visiveis.every((i) => marcados.has(i.id));

  const alternar = (id: string) =>
    setMarcados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const alternarVisiveis = () =>
    setMarcados((s) => {
      const n = new Set(s);
      for (const i of visiveis) {
        if (todosVisiveisMarcados) n.delete(i.id);
        else n.add(i.id);
      }
      return n;
    });

  const remover = async () => {
    setRemovendo(true);
    setErro(null);
    try {
      await removerIgnorados([...marcados]);
      setMarcados(new Set());
      setConfirmarRemover(false);
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
      setConfirmarRemover(false);
    } finally {
      setRemovendo(false);
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
                <Settings size={18} /> Configurações · Listas de contatos
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
        <AbasConfig atual="listas" />

        {erro && (
          <div className="mb-5 flex items-center gap-2 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle size={16} /> {erro}
          </div>
        )}

        <section className="mb-6 border border-line-strong bg-white">
          <div className="border-b border-line-strong px-6 py-4">
            <h2 className="font-title flex items-center gap-2 text-lg font-semibold text-forest-900">
              <Ban size={18} /> Contatos ignorados
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-neutral-600">
              Contatos que você não quer mais acionar. Em <strong>qualquer campanha</strong> eles continuam aparecendo na
              lista, mas já vêm <strong>desmarcados</strong>: não entram em “Copiar números” nem na planilha, a não ser
              que você marque de volta. O contato é reconhecido pelo <strong>telefone</strong>, seja do RealMate ou do
              Vista.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 px-6 py-5 lg:grid-cols-2">
            {/* ---------- 1. ENCONTRAR ---------- */}
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">1 · Encontre os contatos</div>

              <label className="mb-1 block text-sm font-semibold text-forest-900">Buscar por telefone ou nome</label>
              <p className="mb-2 text-xs text-neutral-500">
                Digite o telefone (inteiro ou só um pedaço) ou o nome e clique no contato para colocá-lo na fila.
              </p>
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  className={`${campoCls} pl-8 pr-8`}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Ex.: 99200-4129  ou  Maria Silva"
                  inputMode="search"
                  autoComplete="off"
                />
                {buscando ? (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-neutral-400" />
                ) : (
                  q && (
                    <button onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700" title="Limpar">
                      <X size={14} />
                    </button>
                  )
                )}
              </div>

              {achados !== null && (
                <div className="mt-2 border border-line">
                  {achados.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-neutral-500">
                      Nenhum contato encontrado.
                      {(() => {
                        const k = chaveTelefone(q);
                        return k && !/[A-Za-zÀ-ÿ]/.test(q) && !naFila.has(k) ? (
                          <button
                            onClick={() =>
                              poNaFila([{ chave: k, telefone: q.trim(), nome: null, em_realmate: false, em_vista: false, ja_ignorado: false, encontrado: false }])
                            }
                            className="mt-2 flex items-center gap-1.5 text-xs font-medium text-forest-900 underline-offset-2 hover:underline"
                          >
                            <Plus size={13} /> Colocar na fila o número {formatarTelefone(q)} mesmo assim
                          </button>
                        ) : null;
                      })()}
                    </div>
                  ) : (
                    <ul className="max-h-64 divide-y divide-line overflow-y-auto">
                      {achados.map((c) => {
                        const naLista = c.ja_ignorado;
                        const jaNaFila = naFila.has(c.chave);
                        return (
                          <li key={c.chave}>
                            <button
                              type="button"
                              onClick={() => !naLista && !jaNaFila && poNaFila([{ ...c, encontrado: true }])}
                              disabled={naLista || jaNaFila}
                              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                                naLista || jaNaFila ? "cursor-default bg-neutral-50" : "hover:bg-green-soft"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-neutral-800">
                                  {c.nome || <span className="font-normal text-neutral-400">sem nome cadastrado</span>}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                                  {formatarTelefone(c.telefone)}
                                  <EtiquetasFonte rm={c.em_realmate} vi={c.em_vista} />
                                </div>
                              </div>
                              {naLista ? (
                                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-neutral-500">
                                  <Check size={13} /> Já na lista
                                </span>
                              ) : jaNaFila ? (
                                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-neutral-500">
                                  <Check size={13} /> Na fila
                                </span>
                              ) : (
                                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-forest-900">
                                  <Plus size={13} /> Pôr na fila
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              <div className="mt-5 border-t border-line pt-4">
                <label className="mb-1 block text-sm font-semibold text-forest-900">Ou cole uma lista de telefones</label>
                <p className="mb-2 text-xs text-neutral-500">Só os números, um por linha.</p>
                <textarea
                  className={`${campoCls} min-h-[96px] font-mono text-xs`}
                  value={texto}
                  onChange={(e) => {
                    setTexto(e.target.value);
                    setAvisoColar(null);
                  }}
                  placeholder={"(51) 99999-0000\n51 98888-1111\n+55 51 97777-2222"}
                />
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    onClick={colocarListaNaFila}
                    disabled={resolvendo || tokensValidos === 0}
                    className="inline-flex items-center gap-2 border border-forest-900 px-4 py-2 text-sm font-medium text-forest-900 transition hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {resolvendo ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Colocar na fila
                  </button>
                  {tokens.length > 0 && !avisoColar && (
                    <span className="text-xs text-neutral-500">
                      {num(tokensValidos)} telefone(s) reconhecido(s){tokens.length > tokensValidos ? ` · ${num(tokens.length - tokensValidos)} sem telefone válido` : ""}
                    </span>
                  )}
                  {avisoColar && <span className="text-xs text-forest-800">{avisoColar}</span>}
                </div>
              </div>
            </div>

            {/* ---------- 2. FILA ---------- */}
            <div className="flex flex-col border border-line bg-neutral-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  2 · Fila para adicionar <span className="ml-1 font-normal text-neutral-400">({num(fila.length)})</span>
                </div>
                {fila.length > 0 && (
                  <button onClick={() => setFila([])} className="text-xs font-medium text-neutral-500 underline-offset-2 hover:text-red-600 hover:underline">
                    Limpar fila
                  </button>
                )}
              </div>

              {fila.length === 0 ? (
                <div className="flex flex-1 items-center justify-center px-4 py-10 text-center text-sm text-neutral-400">
                  A fila está vazia. Os contatos que você buscar ou colar aparecem aqui, e só entram na lista de ignorados
                  quando você clicar em “Adicionar”.
                </div>
              ) : (
                <ul className="mb-3 max-h-72 flex-1 divide-y divide-line overflow-y-auto border border-line bg-white">
                  {fila.map((f) => (
                    <li key={f.chave} className="flex items-center gap-3 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-neutral-800">
                          {f.nome || <span className="font-normal text-neutral-400">{f.encontrado ? "sem nome cadastrado" : "sem cadastro no RealMate/Vista"}</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                          {formatarTelefone(f.telefone)}
                          <EtiquetasFonte rm={f.em_realmate} vi={f.em_vista} />
                          {f.ja_ignorado && (
                            <span className="bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
                              Já está na lista
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setFila((l) => l.filter((x) => x.chave !== f.chave))}
                        className="shrink-0 text-neutral-300 transition hover:text-red-600"
                        title="Tirar da fila"
                        aria-label={`Tirar ${f.nome ?? f.telefone} da fila`}
                      >
                        <X size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <input
                className={campoCls}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo (opcional), ex.: pediu para não receber mais mensagens"
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button onClick={adicionarFila} disabled={adicionando || paraAdicionar.length === 0} className={btnPrimario}>
                  {adicionando ? <Loader2 size={15} className="animate-spin" /> : <Ban size={15} />}
                  Adicionar {paraAdicionar.length > 0 ? `${num(paraAdicionar.length)} ` : ""}à lista de ignorados
                </button>
                {fila.length > paraAdicionar.length && (
                  <span className="text-xs text-neutral-500">{num(fila.length - paraAdicionar.length)} já estava(m) na lista e será(ão) ignorado(s)</span>
                )}
              </div>
              {resultado && (
                <div className="mt-3 flex items-center gap-2 border border-line bg-green-soft px-3 py-2 text-sm text-forest-800">
                  <Check size={15} /> {resultado}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="border border-line-strong bg-white">
          <div className="flex flex-wrap items-center gap-3 border-b border-line-strong px-5 py-3">
            <h3 className="text-sm font-semibold text-forest-900">
              Na lista <span className="ml-1 font-normal text-neutral-400">({lista ? num(lista.length) : "…"})</span>
            </h3>
            <div className="relative w-full max-w-xs">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                className="w-full border border-line bg-white py-2 pl-8 pr-8 text-sm focus:border-green-accent focus:outline-none"
                placeholder="Buscar por nome, telefone ou motivo…"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPagina(1);
                }}
              />
              {busca && (
                <button onClick={() => setBusca("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700" title="Limpar">
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              onClick={() => setConfirmarRemover(true)}
              disabled={marcados.size === 0}
              className="ml-auto inline-flex items-center gap-1.5 border border-red-400 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 size={13} /> Remover da lista{marcados.size > 0 ? ` (${num(marcados.size)})` : ""}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-line-strong bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
                  <th className="w-10 py-3 pl-5 pr-0 font-medium">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer accent-[#0b3d2e]"
                      aria-label="Marcar os contatos da página"
                      disabled={visiveis.length === 0}
                      checked={todosVisiveisMarcados}
                      onChange={alternarVisiveis}
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">Contato</th>
                  <th className="px-4 py-3 font-medium">Telefone</th>
                  <th className="px-4 py-3 font-medium">Motivo</th>
                  <th className="px-5 py-3 font-medium">Adicionado</th>
                </tr>
              </thead>
              <tbody>
                {lista === null && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-neutral-400">
                      <Loader2 size={20} className="mx-auto mb-2 animate-spin" /> Carregando…
                    </td>
                  </tr>
                )}
                {lista !== null && visiveis.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-neutral-500">
                      {lista.length === 0 ? "Nenhum contato na lista ainda." : "Nenhum contato encontrado nessa busca."}
                    </td>
                  </tr>
                )}
                {visiveis.map((i) => (
                  <tr key={i.id} className="border-b border-line last:border-0 hover:bg-neutral-50">
                    <td className="w-10 py-3 pl-5 pr-0">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-[#0b3d2e]"
                        aria-label={`Selecionar ${i.nome ?? i.telefone}`}
                        checked={marcados.has(i.id)}
                        onChange={() => alternar(i.id)}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-neutral-800">
                      {i.nome || <span className="text-xs font-normal text-neutral-400">sem nome cadastrado</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{formatarTelefone(i.telefone)}</td>
                    <td className="px-4 py-3 text-neutral-600">{i.motivo || <span className="text-neutral-300">—</span>}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-neutral-500">
                      {dataHora(i.criado_em)}
                      {i.criado_por_nome && <div className="text-neutral-400">por {i.criado_por_nome}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtrada.length > POR_PAGINA && (
            <div className="flex items-center justify-end gap-3 border-t border-line px-5 py-3 text-xs text-neutral-600">
              <span>
                {num((paginaAtual - 1) * POR_PAGINA + 1)}–{num(Math.min(paginaAtual * POR_PAGINA, filtrada.length))} de {num(filtrada.length)}
              </span>
              <button
                onClick={() => setPagina(paginaAtual - 1)}
                disabled={paginaAtual <= 1}
                className="border border-line-strong p-1.5 transition hover:bg-neutral-100 disabled:opacity-30"
                title="Anterior"
              >
                <ChevronLeft size={14} />
              </button>
              <span>Página {paginaAtual} de {totalPaginas}</span>
              <button
                onClick={() => setPagina(paginaAtual + 1)}
                disabled={paginaAtual >= totalPaginas}
                className="border border-line-strong p-1.5 transition hover:bg-neutral-100 disabled:opacity-30"
                title="Próxima"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </section>
      </div>

      {confirmarRemover && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md border border-line-strong bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-line-strong px-6 py-4">
              <h2 className="font-title text-lg font-semibold text-forest-900">Remover da lista?</h2>
              <button onClick={() => setConfirmarRemover(false)} className="text-neutral-400 transition hover:text-neutral-700" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <p className="px-6 py-5 text-sm text-neutral-700">
              {num(marcados.size)} contato(s) deixam de ser ignorados e voltam a vir <strong>marcados</strong> nas campanhas.
            </p>
            <div className="flex items-center justify-end gap-3 border-t border-line-strong px-6 py-4">
              <button
                onClick={() => setConfirmarRemover(false)}
                disabled={removendo}
                className="border border-line-strong px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={remover}
                disabled={removendo}
                className="inline-flex items-center gap-2 bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-40"
              >
                {removendo ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Sim, remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
