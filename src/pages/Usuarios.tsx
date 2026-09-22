import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  UserPlus,
  Search,
  KeyRound,
  Trash2,
  Power,
  X,
  Users2,
  UserCheck,
  UserX,
  Check,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { LuxtonMark } from "../components/Logo";
import { supabase } from "../lib/supabase";
import { useAuth, PAPEL_LABEL, type Papel } from "../lib/auth";

const inputCls =
  "w-full border border-line-strong bg-white px-3 py-2 text-sm text-neutral-800 transition placeholder:text-neutral-400 hover:border-forest-900 focus:border-green-accent focus:outline-none";

type UsuarioRow = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
  ultimo_acesso: string | null;
  criado_em: string | null;
  criado_por: string | null;
};

type FormNovo = { nome: string; email: string; papel: Papel };

const dataHoraBR = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Nunca acessou";

const dataCurta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { dateStyle: "short" }) : "—";

// Chama a Edge Function admin-users e normaliza a mensagem de erro.
async function chamarAdmin(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const j = await ctx.json();
        if (j?.error) msg = j.error;
      }
    } catch {
      /* mantém msg padrão */
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function Usuarios() {
  const { perfil, ehAdminGeral } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState<FormNovo>({ nome: "", email: "", papel: "geral" });
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState<UsuarioRow | null>(null);
  const [toast, setToast] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);

  const avisar = (msg: string, tipo: "ok" | "erro" = "ok") => {
    setToast({ tipo, msg });
    setTimeout(() => setToast(null), 3200);
  };

  const carregar = async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, nome, email, papel, ativo, ultimo_acesso, criado_em, criado_por")
      .order("criado_em", { ascending: true });
    if (error) avisar(error.message, "erro");
    setUsuarios((data as UsuarioRow[]) ?? []);
    setCarregando(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) =>
      [u.nome, u.email, PAPEL_LABEL[u.papel]].some((c) => c.toLowerCase().includes(q))
    );
  }, [usuarios, busca]);

  const totais = useMemo(() => {
    const ativos = usuarios.filter((u) => u.ativo).length;
    return { total: usuarios.length, ativos, inativos: usuarios.length - ativos };
  }, [usuarios]);

  // Nome de quem criou cada perfil (resolvido a partir da própria lista).
  const nomePorId = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of usuarios) m.set(u.id, u.nome || u.email);
    return m;
  }, [usuarios]);

  // Um admin comum só gerencia usuários "geral"; admin_geral gerencia todos.
  const podeGerenciar = (alvo: UsuarioRow) => ehAdminGeral || alvo.papel === "geral";
  const ehEuMesmo = (u: UsuarioRow) => u.id === perfil?.id;

  // Papéis que o usuário atual pode atribuir ao criar.
  const papeisDisponiveis: Papel[] = ehAdminGeral ? ["geral", "admin", "admin_geral"] : ["geral"];

  const redirectTo = `${window.location.origin}/definir-senha`;

  const toggleAtivo = async (u: UsuarioRow) => {
    setOcupadoId(u.id);
    try {
      await chamarAdmin({ action: "set_ativo", id: u.id, ativo: !u.ativo });
      setUsuarios((l) => l.map((x) => (x.id === u.id ? { ...x, ativo: !x.ativo } : x)));
      avisar(u.ativo ? `${u.nome || u.email} foi desativado.` : `${u.nome || u.email} foi reativado.`);
    } catch (e) {
      avisar((e as Error).message, "erro");
    } finally {
      setOcupadoId(null);
    }
  };

  const redefinirSenha = async (u: UsuarioRow) => {
    setOcupadoId(u.id);
    try {
      await chamarAdmin({ action: "redefinir_senha", id: u.id, redirectTo });
      avisar(`Link de redefinição enviado para ${u.email}.`);
    } catch (e) {
      avisar((e as Error).message, "erro");
    } finally {
      setOcupadoId(null);
    }
  };

  const remover = async () => {
    const u = confirmarExclusao;
    if (!u) return;
    setConfirmarExclusao(null);
    setOcupadoId(u.id);
    try {
      await chamarAdmin({ action: "excluir", id: u.id });
      setUsuarios((l) => l.filter((x) => x.id !== u.id));
      avisar(`${u.nome || u.email} foi removido.`);
    } catch (e) {
      avisar((e as Error).message, "erro");
    } finally {
      setOcupadoId(null);
    }
  };

  const abrirNovo = () => {
    setForm({ nome: "", email: "", papel: "geral" });
    setErroForm("");
    setModalAberto(true);
  };

  const salvarNovo = async () => {
    const nome = form.nome.trim();
    const email = form.email.trim().toLowerCase();
    if (!nome || !email) return setErroForm("Preencha nome e e-mail.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErroForm("Informe um e-mail válido.");
    setSalvando(true);
    setErroForm("");
    try {
      await chamarAdmin({ action: "criar", nome, email, papel: form.papel, redirectTo });
      setModalAberto(false);
      avisar(`Convite enviado para ${email}.`);
      await carregar();
    } catch (e) {
      setErroForm((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-full bg-sand">
      {/* Barra superior */}
      <div className="border-b border-line-strong bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3 transition hover:opacity-80" title="Voltar ao portal">
            <LuxtonMark size={36} />
            <div>
              <div className="text-xs uppercase tracking-widest text-neutral-500">Portal Luxton</div>
              <h1 className="font-title text-xl font-semibold text-forest-900">Gestão de Usuários</h1>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ResumoCard icon={Users2} cor="#0b3d2e" label="Total de usuários" valor={totais.total} />
          <ResumoCard icon={UserCheck} cor="#2FA35A" label="Ativos" valor={totais.ativos} />
          <ResumoCard icon={UserX} cor="#9a9a92" label="Inativos" valor={totais.inativos} />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-xs">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, e-mail ou perfil"
              className={`${inputCls} pl-9`}
            />
          </div>
          <button
            onClick={abrirNovo}
            className="inline-flex items-center gap-2 bg-forest-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-forest-800"
          >
            <UserPlus size={16} /> Adicionar usuário
          </button>
        </div>

        <section className="mt-4 overflow-hidden border border-line-strong bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-line-strong bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
                  <th className="px-6 py-3 font-medium">Usuário</th>
                  <th className="px-4 py-3 font-medium">Perfil</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Último acesso</th>
                  <th className="px-4 py-3 font-medium">Criado</th>
                  <th className="px-6 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((u) => {
                  const gerenciavel = podeGerenciar(u);
                  const eu = ehEuMesmo(u);
                  const ocupado = ocupadoId === u.id;
                  return (
                    <tr key={u.id} className="border-b border-line last:border-0 hover:bg-neutral-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 font-medium text-neutral-800">
                          {u.nome || "(sem nome)"}
                          {eu && (
                            <span className="rounded-sm bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                              você
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-500">{u.email}</div>
                      </td>
                      <td className="px-4 py-4">
                        <PerfilBadge papel={u.papel} />
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge ativo={u.ativo} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-neutral-600">
                        {dataHoraBR(u.ultimo_acesso)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-neutral-600">
                        <div>{dataCurta(u.criado_em)}</div>
                        <div className="text-xs text-neutral-400">
                          {u.criado_por ? `por ${nomePorId.get(u.criado_por) ?? "—"}` : "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {ocupado ? (
                            <Loader2 size={16} className="animate-spin text-neutral-400" />
                          ) : gerenciavel ? (
                            <>
                              <AcaoIcon title="Redefinir senha" onClick={() => redefinirSenha(u)}>
                                <KeyRound size={16} />
                              </AcaoIcon>
                              <AcaoIcon
                                title={eu ? "Você não pode desativar a si mesmo" : u.ativo ? "Desativar" : "Reativar"}
                                onClick={() => toggleAtivo(u)}
                                disabled={eu}
                              >
                                <Power size={16} className={u.ativo ? "text-amber-600" : "text-green-accent"} />
                              </AcaoIcon>
                              <AcaoIcon
                                title={eu ? "Você não pode se excluir" : "Remover"}
                                onClick={() => setConfirmarExclusao(u)}
                                disabled={eu}
                                perigo
                              >
                                <Trash2 size={16} />
                              </AcaoIcon>
                            </>
                          ) : (
                            <span
                              title="Apenas o Administrador Geral gerencia administradores"
                              className="inline-flex items-center gap-1 text-xs text-neutral-400"
                            >
                              <ShieldCheck size={14} /> protegido
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {carregando && (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-neutral-400">
                      <Loader2 size={20} className="mx-auto mb-2 animate-spin" /> Carregando usuários...
                    </td>
                  </tr>
                )}
                {!carregando && filtrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-neutral-400">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Modal adicionar */}
      {modalAberto && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md border border-line-strong bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-line-strong px-6 py-4">
              <h2 className="font-title text-lg font-semibold text-forest-900">Adicionar usuário</h2>
              <button onClick={() => setModalAberto(false)} className="text-neutral-400 transition hover:text-neutral-700">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <Campo label="Nome completo">
                <input className={inputCls} value={form.nome} autoFocus onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
              </Campo>
              <Campo label="E-mail">
                <input className={inputCls} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </Campo>
              <Campo label="Perfil de acesso">
                <select
                  className={inputCls}
                  value={form.papel}
                  onChange={(e) => setForm((f) => ({ ...f, papel: e.target.value as Papel }))}
                >
                  {papeisDisponiveis.map((p) => (
                    <option key={p} value={p}>
                      {PAPEL_LABEL[p]}
                    </option>
                  ))}
                </select>
              </Campo>
              {erroForm && <p className="text-sm text-red-600">{erroForm}</p>}
              <p className="text-xs text-neutral-500">
                O usuário recebe um convite por e-mail para definir a própria senha.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-line-strong px-6 py-4">
              <button
                onClick={() => setModalAberto(false)}
                className="border border-line-strong px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
              >
                Cancelar
              </button>
              <button
                onClick={salvarNovo}
                disabled={salvando}
                className="inline-flex items-center gap-2 bg-forest-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-forest-800 disabled:opacity-60"
              >
                {salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Enviar convite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar exclusão */}
      {confirmarExclusao && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md border border-line-strong bg-white shadow-xl">
            <div className="flex items-center gap-3 border-b border-line-strong px-6 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-red-50">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <h2 className="font-title text-lg font-semibold text-forest-900">Excluir usuário</h2>
            </div>
            <div className="px-6 py-5 text-sm text-neutral-700">
              Tem certeza que deseja excluir{" "}
              <span className="font-semibold text-neutral-900">
                {confirmarExclusao.nome || confirmarExclusao.email}
              </span>
              ? Esta ação é <span className="font-semibold">permanente</span> e remove o acesso do
              usuário ao portal.
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-line-strong px-6 py-4">
              <button
                onClick={() => setConfirmarExclusao(null)}
                className="border border-line-strong px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
              >
                Cancelar
              </button>
              <button
                onClick={remover}
                className="inline-flex items-center gap-2 bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
              >
                <Trash2 size={16} /> Excluir definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 border px-4 py-3 text-sm shadow-lg ${
            toast.tipo === "ok"
              ? "border-forest-800 bg-forest-900 text-white"
              : "border-red-300 bg-red-50 text-red-700"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-neutral-600">{label}</label>
      {children}
    </div>
  );
}

function AcaoIcon({
  title,
  onClick,
  perigo,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  perigo?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center border border-line-strong text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 ${
        perigo ? "hover:border-red-300 hover:text-red-600" : "hover:border-forest-900"
      }`}
    >
      {children}
    </button>
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
  valor: number;
}) {
  return (
    <div className="flex items-center gap-4 border border-line-strong bg-white p-5">
      <div className="flex h-11 w-11 items-center justify-center" style={{ backgroundColor: `${cor}1a` }}>
        <Icon size={20} style={{ color: cor }} />
      </div>
      <div>
        <div className="font-title text-2xl font-semibold text-forest-900">{valor}</div>
        <div className="text-xs text-neutral-600">{label}</div>
      </div>
    </div>
  );
}

const PAPEL_COR: Record<Papel, string> = {
  admin_geral: "bg-forest-900 text-white",
  admin: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-600/20",
  geral: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20",
};

function PerfilBadge({ papel }: { papel: Papel }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${PAPEL_COR[papel]}`}>
      {PAPEL_LABEL[papel]}
    </span>
  );
}

function StatusBadge({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        ativo ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-neutral-100 text-neutral-500 ring-neutral-500/20"
      }`}
    >
      <span className={`h-1.5 w-1.5 ${ativo ? "bg-emerald-500" : "bg-neutral-400"}`} />
      {ativo ? "Ativo" : "Inativo"}
    </span>
  );
}
