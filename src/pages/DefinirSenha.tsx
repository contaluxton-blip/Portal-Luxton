import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, KeyRound, AlertTriangle } from "lucide-react";
import { LuxtonMark } from "../components/Logo";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

const inputCls =
  "w-full border border-line-strong bg-white px-3 py-2.5 text-sm text-neutral-800 transition placeholder:text-neutral-400 hover:border-forest-900 focus:border-green-accent focus:outline-none";

export default function DefinirSenha() {
  const { sessao, carregando } = useAuth();
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Se o link expirou/for inválido, o Supabase coloca o erro no hash da URL.
  const [erroLink, setErroLink] = useState("");
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hash.get("error_description")) setErroLink(hash.get("error_description")!);
  }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    if (senha.length < 8) return setErro("A senha precisa ter ao menos 8 caracteres.");
    if (senha !== senha2) return setErro("As senhas não conferem.");
    setSalvando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      navigate("/", { replace: true });
    } catch (err) {
      setErro((err as Error)?.message ?? "Não foi possível salvar a senha.");
    } finally {
      setSalvando(false);
    }
  };

  const semSessao = !carregando && !sessao;

  return (
    <div className="flex min-h-full items-center justify-center bg-sand px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <LuxtonMark size={56} />
          <h1 className="font-title mt-5 text-2xl font-semibold text-forest-900">
            Definir senha
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Escolha uma senha para acessar o Portal Luxton.
          </p>
        </div>

        {erroLink || semSessao ? (
          <div className="mt-8 border border-line-strong bg-white p-6">
            <div className="flex items-start gap-2 border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {erroLink ||
                "Link inválido ou expirado. Volte ao login e use “Esqueci minha senha”, ou peça um novo convite ao administrador."}
            </div>
            <button
              onClick={() => navigate("/login", { replace: true })}
              className="mt-4 w-full border border-line-strong px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
            >
              Ir para o login
            </button>
          </div>
        ) : (
          <form
            onSubmit={salvar}
            className="mt-8 border border-line-strong bg-white p-6 shadow-[6px_6px_0_0_#0b3d2e]"
          >
            <label className="mb-1.5 block text-xs font-medium text-neutral-600">Nova senha</label>
            <input
              className={inputCls}
              type="password"
              autoFocus
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo de 8 caracteres"
            />
            <label className="mb-1.5 mt-4 block text-xs font-medium text-neutral-600">
              Confirmar senha
            </label>
            <input
              className={inputCls}
              type="password"
              autoComplete="new-password"
              value={senha2}
              onChange={(e) => setSenha2(e.target.value)}
              placeholder="Repita a senha"
            />
            {erro && (
              <div className="mt-4 flex items-start gap-2 border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {erro}
              </div>
            )}
            <button
              type="submit"
              disabled={salvando}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 bg-forest-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {salvando ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              Salvar senha e entrar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
