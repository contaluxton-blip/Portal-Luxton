import { Plus, X } from "lucide-react";
import { MultiSelect } from "./MultiSelect";
import {
  CAMPO_LABEL,
  OP_LABEL,
  descreverCondicoes,
  novaCaixa,
  novaLinha,
  opsDoCampo,
  type CaixaCond,
  type CampoCond,
  type Conector,
  type LinhaCond,
} from "../lib/condicoes";

type Props = {
  caixas: CaixaCond[];
  onChange: (c: CaixaCond[]) => void;
  statusOpt: string[];
  corretoresOpt: string[];
  fasesOpt: string[];
  faseDisponivel: boolean; // fase só vale com venda OU locação e imóvel exigido
};

const selectCls =
  "border px-3 py-2 text-sm transition focus:border-green-accent focus:outline-none border-line bg-white text-neutral-700 hover:border-forest-900";

// Alternador E / OU (liga duas linhas ou duas caixas).
function SeletorConector({ valor, onChange }: { valor: Conector; onChange: (v: Conector) => void }) {
  return (
    <div className="inline-flex overflow-hidden border border-line-strong text-sm font-bold">
      {(["E", "OU"] as Conector[]).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`px-3 py-1 transition ${
            valor === c ? "bg-forest-900 text-white" : "bg-white text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          {c === "E" ? "e" : "ou"}
        </button>
      ))}
    </div>
  );
}

export function ConstrutorNegocio({
  caixas,
  onChange,
  statusOpt,
  corretoresOpt,
  fasesOpt,
  faseDisponivel,
}: Props) {
  const camposDisponiveis: CampoCond[] = faseDisponivel
    ? ["status", "corretor", "fase", "parado"]
    : ["status", "corretor", "parado"];

  const setCaixa = (id: string, patch: Partial<CaixaCond>) =>
    onChange(caixas.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const setLinha = (caixaId: string, linhaId: string, patch: Partial<LinhaCond>) =>
    onChange(
      caixas.map((c) =>
        c.id === caixaId
          ? { ...c, linhas: c.linhas.map((l) => (l.id === linhaId ? { ...l, ...patch } : l)) }
          : c
      )
    );

  const trocarCampo = (caixaId: string, l: LinhaCond, campo: CampoCond) =>
    setLinha(caixaId, l.id, {
      campo,
      op: opsDoCampo(campo)[0],
      valores: [],
      numero: "",
    });

  const opcoesDe = (campo: CampoCond) =>
    campo === "status" ? statusOpt : campo === "corretor" ? corretoresOpt : fasesOpt;

  const resumo = descreverCondicoes(caixas);

  return (
    <div>
      {caixas.length === 0 && (
        <p className="mb-3 text-sm text-neutral-500">
          Sem condições de negócio. Adicione uma caixa para filtrar por status, corretor, fase ou
          tempo parado. Para incluir quem não tem negócio, use o status “Sem negócio”.
        </p>
      )}

      <div className="space-y-3">
        {caixas.map((c, ci) => (
          <div key={c.id}>
            {ci > 0 && (
              <div className="mb-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-line-strong" />
                <SeletorConector valor={c.conector} onChange={(v) => setCaixa(c.id, { conector: v })} />
                <div className="h-px flex-1 bg-line-strong" />
              </div>
            )}

            <div className="border border-l-4 border-line-strong border-l-forest-900 bg-neutral-50/60 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-xs text-neutral-500">
                  <span className="font-bold text-neutral-700">é</span> olha para um mesmo negócio
                  {" · "}
                  <span className="font-bold text-neutral-700">não é</span> vale para o lead todo
                  (nenhum negócio dele)
                </span>
                <button
                  type="button"
                  onClick={() => onChange(caixas.filter((x) => x.id !== c.id))}
                  className="inline-flex items-center gap-1 text-xs text-neutral-400 transition hover:text-red-600"
                  title="Remover esta caixa"
                >
                  <X size={14} /> Remover caixa
                </button>
              </div>

              <div className="space-y-2">
                {c.linhas.map((l, li) => (
                  <div key={l.id} className="flex flex-wrap items-start gap-2">
                    <div className="flex w-[72px] shrink-0 items-center justify-center pt-1.5">
                      {li === 0 ? (
                        <span className="text-xs text-neutral-400">quando</span>
                      ) : (
                        <SeletorConector
                          valor={l.conector}
                          onChange={(v) => setLinha(c.id, l.id, { conector: v })}
                        />
                      )}
                    </div>
                    <select
                      className={selectCls}
                      value={l.campo}
                      onChange={(e) => trocarCampo(c.id, l, e.target.value as CampoCond)}
                    >
                      {camposDisponiveis.map((campo) => (
                        <option key={campo} value={campo}>
                          {CAMPO_LABEL[campo]}
                        </option>
                      ))}
                    </select>
                    <select
                      className={selectCls}
                      value={l.op}
                      onChange={(e) =>
                        setLinha(c.id, l.id, { op: e.target.value as LinhaCond["op"] })
                      }
                    >
                      {opsDoCampo(l.campo).map((op) => (
                        <option key={op} value={op}>
                          {OP_LABEL[op]}
                        </option>
                      ))}
                    </select>
                    <div className="min-w-[220px] flex-1 sm:max-w-sm">
                      {l.campo === "parado" ? (
                        <input
                          className={`w-full border px-3 py-2 text-sm transition placeholder:text-neutral-400 focus:border-green-accent focus:outline-none ${
                            l.numero
                              ? "border-forest-900 bg-green-soft font-medium text-neutral-900"
                              : "border-line bg-white text-neutral-700 hover:border-forest-900"
                          }`}
                          placeholder="Dias, ex.: 30"
                          inputMode="numeric"
                          value={l.numero}
                          onChange={(e) =>
                            setLinha(c.id, l.id, { numero: e.target.value.replace(/\D/g, "") })
                          }
                        />
                      ) : (
                        <MultiSelect
                          options={opcoesDe(l.campo)}
                          selected={l.valores}
                          onChange={(v) => setLinha(c.id, l.id, { valores: v })}
                          placeholder="Escolha"
                          // uma escolha por linha; perfis antigos com vários valores seguem editáveis
                          single={l.valores.length <= 1}
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCaixa(c.id, { linhas: c.linhas.filter((x) => x.id !== l.id) })}
                      className="mt-2 text-neutral-400 transition hover:text-red-600"
                      title="Remover esta condição"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  setCaixa(c.id, { linhas: [...c.linhas, novaLinha("status", "E")] })
                }
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-forest-900 transition hover:underline"
              >
                <Plus size={14} /> Adicionar condição
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange([...caixas, novaCaixa("E")])}
        className="mt-3 inline-flex items-center gap-1.5 border border-line-strong px-3 py-2 text-sm font-medium text-forest-900 transition hover:border-forest-900 hover:bg-green-soft"
      >
        <Plus size={15} /> {caixas.length === 0 ? "Adicionar caixa de condições" : "Adicionar outra caixa"}
      </button>

      {resumo && (
        <p className="mt-4 border border-line bg-white px-4 py-3 text-sm text-neutral-700">
          <span className="font-semibold text-forest-900">Resumo: </span>
          leads em que {resumo}.
        </p>
      )}
    </div>
  );
}
