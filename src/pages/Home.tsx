import { Link } from "react-router-dom";
import { Megaphone, Users, ArrowRight, LogOut, Lock, BarChart3, ExternalLink } from "lucide-react";
import { LuxtonMark, LuxtonWordmark } from "../components/Logo";
import { useAuth, PAPEL_LABEL } from "../lib/auth";

type Modulo = {
  titulo: string;
  subtitulo: string;
  icon: typeof Megaphone;
  to?: string; // rota interna
  href?: string; // link externo (abre em nova aba)
  liberado: boolean;
};

export default function Home() {
  const { perfil, ehAdmin, podeCampanhas, sair } = useAuth();

  const modulos: Modulo[] = [
    {
      titulo: "Campanhas de Leads",
      subtitulo: "Segmentação e exportação da base de leads.",
      icon: Megaphone,
      to: "/campanhas",
      liberado: podeCampanhas,
    },
    {
      titulo: "Dashboard de Locações",
      subtitulo: "Painel de locações (abre no Google Sites).",
      icon: BarChart3,
      href: "https://sites.google.com/luxtonimoveis.com.br/dashboardv2/dashboard-loca%C3%A7%C3%A3o",
      liberado: podeCampanhas,
    },
    {
      titulo: "Usuários",
      subtitulo: "Gestão de acesso da equipe.",
      icon: Users,
      to: "/usuarios",
      liberado: ehAdmin,
    },
  ];
  const liberados = modulos.filter((m) => m.liberado);
  const primeiroNome = (perfil?.nome || "").split(" ")[0];

  return (
    <div className="min-h-full bg-sand">
      <div className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
        {/* topo: papel + sair */}
        <div className="mb-10 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 border border-line-strong bg-white px-3 py-1.5 text-xs text-neutral-600">
            <span className="h-1.5 w-1.5 rounded-full bg-green-accent" />
            {perfil ? PAPEL_LABEL[perfil.papel] : ""}
          </span>
          <button
            onClick={sair}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-800"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>

        <header className="flex flex-col items-center text-center">
          <LuxtonMark size={64} />
          <h1 className="font-title mt-6 text-4xl font-semibold text-forest-900 sm:text-5xl">
            Portal <LuxtonWordmark className="align-baseline text-forest-900" />
          </h1>
          <p className="mt-3 text-base text-neutral-600">
            {primeiroNome ? `Olá, ${primeiroNome}. ` : "Olá. "}
            {liberados.length ? "Escolha por onde começar." : "Bem-vindo ao portal."}
          </p>
        </header>

        {liberados.length > 0 ? (
          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {liberados.map((m) => (
              <ModuloCard key={m.titulo} m={m} />
            ))}
          </div>
        ) : (
          <div className="mx-auto mt-14 max-w-md border border-line-strong bg-white p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center bg-neutral-100">
              <Lock size={22} className="text-neutral-400" />
            </div>
            <h2 className="font-title mt-4 text-lg font-semibold text-forest-900">
              Nenhum módulo liberado
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Seu perfil ainda não tem acesso a módulos do portal. Fale com um administrador
              se precisar de acesso.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ModuloCard({ m }: { m: Modulo }) {
  const Icon = m.icon;
  const externo = !!m.href;
  const conteudo = (
    <div className="group relative flex h-full flex-col overflow-hidden border border-line-strong bg-white p-8 transition hover:border-forest-900 hover:shadow-[6px_6px_0_0_#0b3d2e]">
      <div className="absolute inset-x-0 top-0 h-1 bg-green-accent" />
      <div className="flex h-12 w-12 items-center justify-center bg-green-soft">
        <Icon size={22} className="text-green-accent" />
      </div>
      <h2 className="font-title mt-5 text-2xl font-semibold text-forest-900">{m.titulo}</h2>
      <p className="mt-1 text-sm text-neutral-600">{m.subtitulo}</p>
      <div className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-forest-700 transition group-hover:gap-2">
        {externo ? (
          <>
            Abrir <ExternalLink size={16} />
          </>
        ) : (
          <>
            Entrar <ArrowRight size={16} />
          </>
        )}
      </div>
    </div>
  );

  if (externo) {
    return (
      <a href={m.href} target="_blank" rel="noopener noreferrer" className="block">
        {conteudo}
      </a>
    );
  }
  return (
    <Link to={m.to!} className="block">
      {conteudo}
    </Link>
  );
}
