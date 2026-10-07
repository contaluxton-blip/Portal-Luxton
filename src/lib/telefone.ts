// Telefones chegam em formatos diferentes: RealMate "+55|51986029909", Vista "51 99705.3383".
// Aqui há um único jeito de exibir e um único jeito de copiar.

type Interpretado =
  | { tipo: "br"; ddd: string; numero: string } // 10 ou 11 dígitos com DDD
  | { tipo: "sem_ddd"; numero: string } // 8 ou 9 dígitos, sem DDD
  | { tipo: "outro"; digitos: string }; // internacional ou fora do padrão

function interpretar(raw?: string | null): Interpretado | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  let d = t.replace(/\D/g, "");
  if (!d) return null;
  const internacional = t.startsWith("+") && !d.startsWith("55");
  if (internacional) return { tipo: "outro", digitos: d };
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  d = d.replace(/^0+/, "");
  if (!d) return null;
  if (d.length === 10 || d.length === 11) return { tipo: "br", ddd: d.slice(0, 2), numero: d.slice(2) };
  if (d.length === 8 || d.length === 9) return { tipo: "sem_ddd", numero: d };
  return { tipo: "outro", digitos: d };
}

const meio = (n: string) => `${n.slice(0, n.length - 4)}-${n.slice(-4)}`;

// Para a tela e a planilha: (51) 99705-3383
export function formatarTelefone(raw?: string | null): string {
  const t = interpretar(raw);
  if (!t) return "";
  if (t.tipo === "br") return `(${t.ddd}) ${meio(t.numero)}`;
  if (t.tipo === "sem_ddd") return meio(t.numero);
  return `+${t.digitos}`;
}

// Para "Copiar números": só dígitos com código do país (+5551997053383), aceito por WhatsApp,
// RealMate e agendas. Números sem DDD não têm como virar internacionais e saem só com os dígitos.
export function telefoneParaCopia(raw?: string | null): string {
  const t = interpretar(raw);
  if (!t) return "";
  if (t.tipo === "br") return `+55${t.ddd}${t.numero}`;
  if (t.tipo === "sem_ddd") return t.numero;
  return `+${t.digitos}`;
}

// Chave única do telefone (igual à função tel_chave do banco): só dígitos, sem zeros à esquerda e sem o 55 do país.
// "+55|51992004129", "51 99200.4129" e "(51) 99200-4129" dão a mesma chave. Menos de 8 dígitos = sem chave.
export function chaveTelefone(raw?: string | null): string | null {
  let z = (raw ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if ((z.length === 12 || z.length === 13) && z.startsWith("55")) z = z.slice(2);
  return z.length >= 8 ? z : null;
}
