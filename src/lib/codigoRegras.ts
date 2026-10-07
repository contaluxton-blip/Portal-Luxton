import type { ConfigCodigo } from "./templatesApi";

// Palavras que costumam vir antes do código do imóvel.
export const PALAVRAS_SUGERIDAS = ["Cód", "Código", "Ref", "Referência"];

const CLASSES: Record<string, string> = {
  a: "[aáàâãä]",
  e: "[eéèêë]",
  i: "[iíìîï]",
  o: "[oóòôõö]",
  u: "[uúùûü]",
  c: "[cç]",
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function palavraParaRegex(w: string): string {
  const base = w.trim().replace(/[.:\s]+$/, "");
  let out = "";
  for (const ch of semAcento(base)) {
    out +=
      CLASSES[ch] ??
      (ch === " " ? "\\s+" : ch === "º" || ch === "°" ? "[º°]" : ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  }
  return out;
}

// Espelha, no navegador, a regra que o banco gera a partir das palavras escolhidas
// (public.config_gerar_regex). Serve só para a conferência ao vivo na tela.
export function acharCodigoNoTexto(texto: string, cfg: ConfigCodigo): { codigo: string; como: string } | null {
  const alt = cfg.palavras.map(palavraParaRegex).filter(Boolean);
  if (alt.length) {
    const re = new RegExp(
      `(?<![\\p{L}\\p{N}])(?:${alt.join("|")})[*_~]*\\.?\\s*[*_~]*:?\\s*[*_~]*\\s*(?:n[º°]\\s*)?(\\d{3,6})`,
      "iu"
    );
    const m = re.exec(texto);
    if (m) return { codigo: m[1], como: "pela palavra antes do número" };
  }
  if (cfg.link) {
    const m = /\/imovel\/(\d{3,6})\b/i.exec(texto);
    if (m) return { codigo: m[1], como: "pelo link do imóvel" };
  }
  if (cfg.isolado) {
    const cands = [...new Set([...texto.matchAll(/(?<!\d)(\d{5})(?!\d)/g)].map((x) => x[1]))];
    if (cands.length === 1) return { codigo: cands[0], como: "pelo único número de 5 dígitos" };
  }
  return null;
}
