export const brl = (v: number, compact = false) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(v);

export const num = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);

export const dataBR = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export const diasDesde = (iso: string, hoje = new Date(2026, 7, 19)) => {
  const d = new Date(iso + "T00:00:00");
  return Math.round((hoje.getTime() - d.getTime()) / 86_400_000);
};
