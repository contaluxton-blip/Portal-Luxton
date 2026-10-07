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
import { adicionarIgnorados, listarIgnorados, removerIgnorados, type Ignorado } from "../lib/ignoradosApi";

const POR_PAGINA = 10;
const campoCls =
  "w-full border border-line bg-white px-3 py-2 text-sm text-neutral-800 transition placeholder:text-neutral-400 hover:border-forest-900 focus:border-green-accent focus:outline-none";
const btnPrimario =
  "inline-flex items-center gap-2 bg-forest-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-40";
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

// Cada linha: um telefone, com nome opcional antes ou depois ("Maria Silva 51 99999-0000", "(51) 99999-0000 - Maria").
function lerLinhas(texto: string): { telefone: string; nome?: string }[] {
  const saida: { telefone: string; nome?: string }[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha) continue;
    const m = /\+?\d[\d\s().\-|]{6,}\d/.exec(linha);
    if (!m) {
      saida.push({ telefone: linha });
      continue;
    }
    const nome = (linha.slice(0, m.index) + " " + linha.slice(m.index + m[0].length)).replace(/^[\s\-–;,|:]+|[\s\-–;,|:]+$/g, "").trim();
    saida.push({ telefone: m[0].trim(), ...(nome ? { nome } : {}) });
  }
  return saida;
}

export default function ConfigListas() {
  const [lista, setLista] = useState<Ignorado[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
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

  const linhas = useMemo(() => lerLinhas(texto), [texto]);
  const validas = linhas.filter((l) => chaveTelefone(l.telefone)).length;

  const adicionar = async () => {
    setAdicionando(true);
    setErro(null);
    setResultado(null);
    try {
      const r = await adicionarIgnorados(linhas, motivo);
      const partes = [`${num(r.adicionados)} adicionado(s)`];
      if (r.ja_existiam) partes.push(`${num(r.ja_existiam)} já estava(m) na lista`);
      if (r.invalidos) partes.push(`${num(r.invalidos)} telefone(s) inválido(s)`);
      setResultado(partes.join(" · "));
      if (r.adicionados > 0 || r.ja_existiam > 0) {
        setTexto("");
        setMotivo("");
      }
      setPagina(1);
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setAdicionando(false);
    }
  };

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const dig = q.replace(/\D/g, "");
    return (lista ?? []).filter(
      (i) =>
        !q ||
        (i.nome ?? "").toLowerCase().includes(q) ||
        (i.motivo ?? "").toLowerCase().includes(q) ||
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
            <div>
              <label className="mb-1 block text-sm font-semibold text-forest-900">Adicionar contatos</label>
              <p className="mb-2 text-xs text-neutral-500">
                Um telefone por linha. Se quiser, escreva o nome junto; se não escrever, o sistema procura o nome no
                RealMate e no Vista.
              </p>
              <textarea
                className={`${campoCls} min-h-[120px] font-mono text-xs`}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={"(51) 99999-0000\nMaria Silva 51 98888-1111\n+55 51 97777-2222 - João"}
              />
              <input
                className={`${campoCls} mt-2`}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo (opcional), ex.: pediu para não receber mais mensagens"
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button onClick={adicionar} disabled={adicionando || validas === 0} className={btnPrimario}>
                  {adicionando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Adicionar à lista
                </button>
                {linhas.length > 0 && (
                  <span className="text-xs text-neutral-500">
                    {num(validas)} telefone(s) reconhecido(s){linhas.length > validas ? ` · ${num(linhas.length - validas)} sem telefone válido` : ""}
                  </span>
                )}
              </div>
              {resultado && (
                <div className="mt-3 flex items-center gap-2 border border-line bg-green-soft px-3 py-2 text-sm text-forest-800">
                  <Check size={15} /> {resultado}
                </div>
              )}
            </div>

            <div className="border border-line bg-neutral-50 p-4 text-sm text-neutral-600">
              <div className="mb-1 font-semibold text-neutral-700">Como funciona</div>
              <ul className="list-disc space-y-1 pl-5">
                <li>O contato ignorado <strong>não some</strong> da campanha: aparece com a marca “Ignorado” e desmarcado.</li>
                <li>Quem quiser incluir mesmo assim marca a caixinha dele na campanha.</li>
                <li>Também dá para ignorar um contato direto na lista de uma campanha, pelo botão ao lado do nome.</li>
                <li>Tirar da lista é só selecionar abaixo e remover.</li>
              </ul>
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
