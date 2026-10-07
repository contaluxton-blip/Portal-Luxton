import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, ScrollText, AlertTriangle } from "lucide-react";
import { LuxtonMark } from "../components/Logo";
import { supabase } from "../lib/supabase";
import { LOG_TIPOS, type TipoLog } from "../lib/logs";
import { num } from "../lib/format";

const POR_PAGINA = 50;

const selectCls =
  "w-full border border-line-strong bg-white px-3 py-2 text-sm text-neutral-800 transition hover:border-forest-900 focus:border-green-accent focus:outline-none";

type LogRow = {
  id: string;
  criado_em: string;
  usuario_id: string | null;
  usuario_nome: string | null;
  usuario_email: string | null;
  tipo: TipoLog;
  detalhes: Record<string, unknown> | null;
  retroativo: boolean;
};

type UsuarioOpt = { id: string; nome: string; email: string };

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });

const txt = (v: unknown) => (typeof v === "string" ? v : "");

// Transforma o jsonb de detalhes em uma linha principal + linha de apoio.
function descrever(l: LogRow): { principal: string; apoio?: string } {
  const d = l.detalhes ?? {};
  const filtros = Array.isArray(d.filtros) ? (d.filtros as unknown[]).map(String).join(" · ") : undefined;
  const alvo = [txt(d.alvo_nome), txt(d.alvo_email) && `(${txt(d.alvo_email)})`].filter(Boolean).join(" ");
  switch (l.tipo) {
    case "aplicou_filtros":
      return { principal: `${num(Number(d.total_leads ?? 0))} lead(s) encontrados`, apoio: filtros };
    case "copiou_numeros":
      return { principal: `${num(Number(d.numeros ?? 0))} número(s) copiados`, apoio: filtros };
    case "exportou_planilha":
      return { principal: `${num(Number(d.leads ?? 0))} lead(s) exportados`, apoio: filtros };
    case "perfil_salvo":
      return { principal: txt(d.perfil), apoio: filtros };
    case "perfil_editado":
    case "perfil_excluido":
      return { principal: txt(d.perfil) };
    case "buscou_usuario":
      return { principal: `“${txt(d.termo)}”` };
    case "template_salvo":
    case "template_excluido":
      return { principal: txt(d.template), apoio: txt(d.tipo) === "padrao" ? "Template padrão" : "Template não padrão" };
    case "template_testado":
      return {
        principal: `${num(Number(d.casaram ?? 0))} mensagem(ns) casaram · ${num(Number(d.com_codigo ?? 0))} com código`,
        apoio: `${num(Number(d.sessoes_lidas ?? 0))} sessões lidas · últimos ${num(Number(d.dias ?? 0))} dias`,
      };
    case "template_retroativo":
      return { principal: txt(d.template), apoio: `${num(Number(d.sessoes ?? 0))} sessões desde ${txt(d.desde)}` };
    case "template_retroativo_concluido":
      return { principal: txt(d.template), apoio: `${num(Number(d.mensagens ?? 0))} mensagem(ns) gravadas` };
    case "usuario_criado":
      return { principal: alvo, apoio: txt(d.papel) ? `Perfil: ${txt(d.papel)}` : undefined };
    case "usuario_reativado":
    case "usuario_desativado":
    case "senha_redefinida":
    case "usuario_excluido":
      return { principal: alvo };
    case "login":
      return l.retroativo ? { principal: "Aproximado, reconstruído a partir da sessão" } : { principal: "" };
    default:
      return { principal: "" };
  }
}

export default function Logs() {
  const [usuarios, setUsuarios] = useState<UsuarioOpt[]>([]);
  const [usuarioId, setUsuarioId] = useState("");
  const [tipo, setTipo] = useState("");
  const [pagina, setPagina] = useState(0);
  const [linhas, setLinhas] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("usuarios")
      .select("id, nome, email")
      .order("nome", { ascending: true })
      .then(({ data }) => setUsuarios((data as UsuarioOpt[]) ?? []));
  }, []);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    let q = supabase
      .from("logs_atividade")
      .select("id, criado_em, usuario_id, usuario_nome, usuario_email, tipo, detalhes, retroativo", {
        count: "exact",
      })
      .order("criado_em", { ascending: false })
      .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
    if (usuarioId) q = q.eq("usuario_id", usuarioId);
    if (tipo) q = q.eq("tipo", tipo);
    q.then(({ data, count, error }) => {
      if (!ativo) return;
      if (error) setErro(error.message);
      setLinhas((data as LogRow[]) ?? []);
      setTotal(count ?? 0);
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [usuarioId, tipo, pagina]);

  const tipoInfo = useMemo(() => new Map(LOG_TIPOS.map((t) => [t.tipo, t])), []);
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const filtrando = !!usuarioId || !!tipo;

  return (
    <div className="min-h-full bg-sand">
      <div className="border-b border-line-strong bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3 transition hover:opacity-80" title="Voltar ao portal">
            <LuxtonMark size={36} />
            <div>
              <div className="text-xs uppercase tracking-widest text-neutral-500">Portal Luxton</div>
              <h1 className="font-title text-xl font-semibold text-forest-900">Logs de atividade</h1>
            </div>
          </Link>
          <Link
            to="/usuarios"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-800"
          >
            <ArrowLeft size={16} /> Voltar para usuários
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-6 py-8">
        <section className="border border-line-strong bg-white p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-600">Usuário</label>
              <select
                className={selectCls}
                value={usuarioId}
                onChange={(e) => {
                  setUsuarioId(e.target.value);
                  setPagina(0);
                }}
              >
                <option value="">Todos os usuários</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome || u.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-600">Atividade</label>
              <select
                className={selectCls}
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value);
                  setPagina(0);
                }}
              >
                <option value="">Todas as atividades</option>
                {LOG_TIPOS.map((t) => (
                  <option key={t.tipo} value={t.tipo}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              {filtrando && (
                <button
                  onClick={() => {
                    setUsuarioId("");
                    setTipo("");
                    setPagina(0);
                  }}
                  className="border border-line-strong px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        </section>

        {erro && (
          <div className="mt-6 flex items-center gap-2 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle size={16} /> {erro}
          </div>
        )}

        <section className="mt-4 overflow-hidden border border-line-strong bg-white">
          <div className="flex items-center justify-between border-b border-line-strong px-6 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-forest-900">
              <ScrollText size={16} /> {num(total)} registro(s)
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <button
                onClick={() => setPagina((p) => Math.max(0, p - 1))}
                disabled={pagina === 0 || carregando}
                className="flex h-8 w-8 items-center justify-center border border-line-strong transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                Página {pagina + 1} de {totalPaginas}
              </span>
              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
                disabled={pagina + 1 >= totalPaginas || carregando}
                className="flex h-8 w-8 items-center justify-center border border-line-strong transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Próxima página"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-line-strong bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
                  <th className="px-6 py-3 font-medium">Data e hora</th>
                  <th className="px-4 py-3 font-medium">Usuário</th>
                  <th className="px-4 py-3 font-medium">Atividade</th>
                  <th className="px-6 py-3 font-medium">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const info = tipoInfo.get(l.tipo);
                  const desc = descrever(l);
                  return (
                    <tr key={l.id} className="border-b border-line align-top last:border-0 hover:bg-neutral-50">
                      <td className="whitespace-nowrap px-6 py-3 text-neutral-600">{dataHora(l.criado_em)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-neutral-800">{l.usuario_nome || "(sem nome)"}</div>
                        <div className="text-xs text-neutral-500">{l.usuario_email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                            info?.cor ?? "bg-neutral-100 text-neutral-700 ring-neutral-500/20"
                          }`}
                        >
                          {info?.label ?? l.tipo}
                        </span>
                        {l.retroativo && (
                          <span
                            title="Reconstruído a partir de dados antigos (aproximado)"
                            className="ml-1.5 inline-flex items-center border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500"
                          >
                            retroativo
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        {desc.principal && <div className="text-neutral-800">{desc.principal}</div>}
                        {desc.apoio && <div className="mt-0.5 max-w-3xl text-xs text-neutral-500">{desc.apoio}</div>}
                      </td>
                    </tr>
                  );
                })}
                {carregando && (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-neutral-400">
                      <Loader2 size={20} className="mx-auto mb-2 animate-spin" /> Carregando logs...
                    </td>
                  </tr>
                )}
                {!carregando && linhas.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-neutral-400">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
