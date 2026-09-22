import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

type Props = {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  flags?: string[]; // fontes que este filtro está aplicando: 'realmente' | 'vista'
};

// Bandeirinhas de fonte ao lado do rótulo do filtro (Vista laranja, RM azul).
export function FonteFlags({ flags }: { flags?: string[] }) {
  if (!flags || flags.length === 0) return null;
  return (
    <span className="ml-1 inline-flex gap-1 align-middle">
      {flags.includes("realmente") && (
        <span className="inline-flex items-center rounded-sm bg-blue-50 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-700 ring-1 ring-inset ring-blue-600/20">
          RM
        </span>
      )}
      {flags.includes("vista") && (
        <span className="inline-flex items-center rounded-sm bg-orange-50 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-orange-700 ring-1 ring-inset ring-orange-600/20">
          Vista
        </span>
      )}
    </span>
  );
}

// Remove acentos e caixa para a busca casar "petropolis" com "Petrópolis".
const normalizar = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = "Todos",
  flags,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Ao fechar, limpa a busca para reabrir com a lista completa.
  useEffect(() => {
    if (!open) setBusca("");
  }, [open]);

  const filtradas = useMemo(() => {
    const q = normalizar(busca.trim());
    return q ? options.filter((o) => normalizar(o).includes(q)) : options;
  }, [options, busca]);

  const toggle = (opt: string) =>
    onChange(
      selected.includes(opt)
        ? selected.filter((s) => s !== opt)
        : [...selected, opt]
    );

  // Preenchido = borda/fundo mais fortes (verde); vazio = clarinho.
  const preenchido = selected.length > 0;

  return (
    <div ref={ref} className="relative">
      <label className="mb-1.5 block text-xs font-medium text-neutral-600">
        {label}
        <FonteFlags flags={flags} />
      </label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 border px-3 py-2 text-left text-sm transition focus:border-green-accent focus:outline-none ${
          preenchido
            ? "border-forest-900 bg-green-soft font-medium text-neutral-900"
            : "border-line bg-white text-neutral-700 hover:border-forest-900"
        }`}
      >
        <span className={preenchido ? "text-neutral-900" : "text-neutral-400"}>
          {selected.length === 0
            ? placeholder
            : selected.length === 1
            ? selected[0]
            : `${selected.length} selecionados`}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 transition ${preenchido ? "text-forest-900" : "text-neutral-400"} ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full border border-line-strong bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-line px-2.5 py-2">
            <Search size={14} className="shrink-0 text-neutral-400" />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar..."
              className="w-full bg-transparent text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                className="shrink-0 text-neutral-400 hover:text-neutral-700"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="max-h-56 overflow-auto p-1">
            {filtradas.length === 0 ? (
              <div className="px-2.5 py-2 text-sm text-neutral-400">Nada encontrado</div>
            ) : (
              filtradas.map((opt) => {
                const on = selected.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggle(opt)}
                    className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-sm text-neutral-700 hover:bg-green-soft"
                  >
                    {opt}
                    {on && <Check size={15} className="shrink-0 text-green-accent" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Chips({
  values,
  onRemove,
}: {
  values: string[];
  onRemove: (v: string) => void;
}) {
  if (!values.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 border border-line bg-green-soft px-2.5 py-1 text-xs text-forest-800"
        >
          {v}
          <button type="button" onClick={() => onRemove(v)} className="hover:text-forest-950">
            <X size={12} />
          </button>
        </span>
      ))}
    </div>
  );
}
