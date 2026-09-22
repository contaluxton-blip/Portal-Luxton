import type { Status } from "../data/leads";

const MAP: Record<Status, string> = {
  "Prospecção/Qualificação": "bg-blue-50 text-blue-700 ring-blue-600/20",
  "Precisa Vender para Comprar": "bg-amber-50 text-amber-700 ring-amber-600/20",
  "Busca de imóveis": "bg-sky-50 text-sky-700 ring-sky-600/20",
  "Em visita": "bg-violet-50 text-violet-700 ring-violet-600/20",
  "Em proposta": "bg-orange-50 text-orange-700 ring-orange-600/20",
  Contrato: "bg-teal-50 text-teal-700 ring-teal-600/20",
  Fechamento: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${MAP[status]}`}
    >
      {status}
    </span>
  );
}
