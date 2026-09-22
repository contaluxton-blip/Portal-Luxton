import { Navigate, useLocation } from "react-router-dom";
import { Loader2, ShieldAlert, LogOut } from "lucide-react";
import { LuxtonMark } from "./Logo";
import { useAuth } from "../lib/auth";

function Carregando() {
  return (
    <div className="flex min-h-full items-center justify-center bg-sand">
      <Loader2 className="animate-spin text-forest-900" size={28} />
    </div>
  );
}

function ContaDesativada({ onSair }: { onSair: () => void }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-sand px-6">
      <div className="w-full max-w-sm text-center">
        <LuxtonMark size={48} className="mx-auto" />
        <div className="mt-6 border border-line-strong bg-white p-6">
          <ShieldAlert className="mx-auto text-amber-600" size={28} />
          <h1 className="font-title mt-3 text-lg font-semibold text-forest-900">
            Conta desativada
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Seu acesso ao portal está desativado. Fale com um administrador.
          </p>
          <button
            onClick={onSair}
            className="mt-5 inline-flex items-center gap-2 border border-line-strong px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            <LogOut size={15} /> Sair
          </button>
        </div>
      </div>
    </div>
  );
}

export function Protegido({ children }: { children: React.ReactNode }) {
  const { sessao, perfil, carregando, sair } = useAuth();
  const loc = useLocation();
  if (carregando) return <Carregando />;
  if (!sessao) return <Navigate to="/login" replace state={{ de: loc.pathname }} />;
  if (!perfil) return <Carregando />;
  if (!perfil.ativo) return <ContaDesativada onSair={sair} />;
  return <>{children}</>;
}

export function SomenteAdmin({ children }: { children: React.ReactNode }) {
  const { ehAdmin, perfil, carregando } = useAuth();
  if (carregando || !perfil) return <Carregando />;
  if (!ehAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function SomenteCampanhas({ children }: { children: React.ReactNode }) {
  const { podeCampanhas, perfil, carregando } = useAuth();
  if (carregando || !perfil) return <Carregando />;
  if (!podeCampanhas) return <Navigate to="/" replace />;
  return <>{children}</>;
}
