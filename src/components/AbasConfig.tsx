import { Link } from "react-router-dom";

// Abas das Configurações de Campanhas: Templates | Listas de contatos.
export function AbasConfig({ atual }: { atual: "templates" | "listas" }) {
  const abas = [
    { v: "templates", label: "Templates", to: "/campanhas/configuracoes" },
    { v: "listas", label: "Listas de contatos", to: "/campanhas/configuracoes/listas" },
  ] as const;
  return (
    <div className="mb-6 inline-flex border border-line-strong bg-white">
      {abas.map((a) => (
        <Link
          key={a.v}
          to={a.to}
          className={`px-5 py-2.5 text-sm font-medium transition ${
            atual === a.v ? "bg-forest-900 text-white" : "text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          {a.label}
        </Link>
      ))}
    </div>
  );
}
