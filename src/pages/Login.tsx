import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { Loader2, LogIn, AlertTriangle, Check } from "lucide-react";
import { LuxtonMark, LuxtonWordmark } from "../components/Logo";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

const inputCls =
  "w-full border border-line-strong bg-white px-3 py-2.5 text-sm text-neutral-800 transition placeholder:text-neutral-400 hover:border-forest-900 focus:border-green-accent focus:outline-none";

export default function Login() {
  const { entrar, sessao, carregando } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destino = (location.state as { de?: string } | null)?.de ?? "/";

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [recuperando, setRecuperando] = useState(false);
  const [avisoRecuperacao, setAvisoRecuperacao] = useState("");

  // Já logado: manda pro portal.
  if (!carregando && sessao) return <Navigate to={destino} replace />;

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setAvisoRecuperacao("");
    setEntrando(true);
    try {
      await entrar(email, senha);
      navigate(destino, { replace: true });
    } catch (err) {
      const msg = (err as Error)?.message ?? "";
      setErro(
        /invalid login credentials/i.test(msg)
          ? "E-mail ou senha incorretos."
          : msg || "Não foi possível entrar."
      );
    } finally {
      setEntrando(false);
    }
  };

  const recuperarSenha = async () => {
    setErro("");
    setAvisoRecuperacao("");
    if (!email.trim()) {
      setErro("Informe seu e-mail acima para receber o link de redefinição.");
      return;
    }
    setRecuperando(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/definir-senha`,
      });
      setAvisoRecuperacao(
        "Se este e-mail estiver cadastrado, enviamos um link para redefinir a senha."
      );
    } catch {
      setAvisoRecuperacao(
        "Se este e-mail estiver cadastrado, enviamos um link para redefinir a senha."
      );
    } finally {
      setRecuperando(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-sand px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <LuxtonMark size={56} />
          <h1 className="font-title mt-5 text-3xl font-semibold text-forest-900">
            Portal <LuxtonWordmark className="align-baseline text-forest-900" />
          </h1>
          <p className="mt-2 text-sm text-neutral-600">Entre para acessar o portal.</p>
        </div>

        <form
          onSubmit={submeter}
          className="mt-8 border border-line-strong bg-white p-6 shadow-[6px_6px_0_0_#0b3d2e]"
        >
          <label className="mb-1.5 block text-xs font-medium text-neutral-600">E-mail</label>
          <input
            className={inputCls}
            type="email"
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@luxton.com.br"
          />

          <label className="mb-1.5 mt-4 block text-xs font-medium text-neutral-600">Senha</label>
          <input
            className={inputCls}
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
          />

          {erro && (
            <div className="mt-4 flex items-start gap-2 border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {erro}
            </div>
          )}
          {avisoRecuperacao && (
            <div className="mt-4 flex items-start gap-2 border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              <Check size={14} className="mt-0.5 shrink-0" /> {avisoRecuperacao}
            </div>
          )}

          <button
            type="submit"
            disabled={entrando}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 bg-forest-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {entrando ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            Entrar
          </button>

          <button
            type="button"
            onClick={recuperarSenha}
            disabled={recuperando}
            className="mt-3 w-full text-center text-xs text-neutral-500 underline-offset-2 transition hover:text-forest-900 hover:underline disabled:opacity-60"
          >
            {recuperando ? "Enviando..." : "Esqueci minha senha"}
          </button>
        </form>
      </div>
    </div>
  );
}
