import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, RefreshCw, X } from "lucide-react";
import { num } from "../lib/format";
import { iniciarAtualizacao, statusAtualizacao, type StatusAtualizacao } from "../lib/atualizacaoApi";

const duracao = (min: number) => {
  if (min < 60) return `${num(Math.max(1, Math.round(min)))} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
};

const hora = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

// "hoje, 06:40", "ontem, 18:10" ou "05/10, 12:00"
function quando(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(Date.now() - 86400000);
  const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (mesmoDia(d, hoje)) return `hoje, ${hora(d)}`;
  if (mesmoDia(d, ontem)) return `ontem, ${hora(d)}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}, ${hora(d)}`;
}

type Props = { onConcluida?: () => void };

// Mostra a última atualização dos dados e, para administradores, o botão de atualizar agora
// (mesma rotina das 06h/12h/18h, últimos 2 dias), com confirmação e andamento.
export function AtualizacaoDados({ onConcluida }: Props) {
  const [st, setSt] = useState<StatusAtualizacao | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [, forcar] = useState(0);
  const dif = useRef(0); // relógio do servidor - relógio do navegador
  const estavaRodando = useRef(false);
  const aoConcluir = useRef(onConcluida);
  aoConcluir.current = onConcluida;

  const carregar = useCallback(async () => {
    try {
      const s = await statusAtualizacao();
      dif.current = new Date(s.agora).getTime() - Date.now();
      if (estavaRodando.current && !s.rodando) {
        if (s.ultima_status === "erro") setErro(s.ultima_erro ?? "A atualização terminou com falhas.");
        else {
          setAviso("Dados atualizados.");
          setTimeout(() => setAviso(null), 10000);
        }
        aoConcluir.current?.();
      }
      estavaRodando.current = s.rodando;
      setSt(s);
    } catch {
      /* mantém o último estado; tenta de novo no próximo ciclo */
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Consulta mais seguido enquanto roda; devagar quando parado. Também redesenha os contadores.
  const rodando = !!st?.rodando;
  useEffect(() => {
    const t = setInterval(carregar, rodando ? 10000 : 60000);
    const r = setInterval(() => forcar((n) => n + 1), 15000);
    return () => {
      clearInterval(t);
      clearInterval(r);
    };
  }, [carregar, rodando]);

  const agora = () => Date.now() + dif.current;

  const pedir = async () => {
    setIniciando(true);
    setErro(null);
    try {
      await iniciarAtualizacao();
      setConfirmar(false);
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
      setConfirmar(false);
      await carregar();
    } finally {
      setIniciando(false);
    }
  };

  if (!st) return null;

  const minLiberar = st.liberada_em ? Math.ceil((new Date(st.liberada_em).getTime() - agora()) / 60000) : 0;
  const bloqueado = minLiberar > 0;
  const decorridos = st.iniciada_em ? Math.max(0, (agora() - new Date(st.iniciada_em).getTime()) / 60000) : 0;
  const faltam = st.media_min - decorridos;
  const pct = Math.min(97, Math.round((decorridos / Math.max(1, st.media_min)) * 100));
  const detalhe = st.etapa_detalhe ? ` · ${num(st.etapa_detalhe.feitas)} de ${num(st.etapa_detalhe.total)} conversas` : "";

  return (
    <>
      <div className="hidden items-center gap-3 border-r border-line pr-3 sm:flex">
        {st.rodando ? (
          <div className="w-[300px]" title={`Iniciada ${quando(st.iniciada_em)}${st.iniciada_por ? ` por ${st.iniciada_por}` : " (automática)"}`}>
            <div className="flex items-center gap-1.5 text-xs font-medium text-forest-900">
              <Loader2 size={13} className="animate-spin" />
              Atualizando os dados… etapa {Math.min(st.etapas_total, st.etapas_feitas + 1)} de {st.etapas_total}
            </div>
            <div className="truncate text-xs text-neutral-500">
              {st.etapa_atual}
              {detalhe} · {faltam > 1 ? `faltam cerca de ${duracao(faltam)}` : "finalizando…"}
            </div>
            <div className="mt-1 h-1 w-full bg-neutral-100">
              <div className="h-1 bg-green-accent transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : (
          <>
            <div
              className="text-right leading-tight"
              title={`Última atualização completa do Vista e do RealMate${
                st.ultima_origem === "manual" ? " (manual)" : st.ultima_origem === "agenda" ? " (automática)" : ""
              }: começou ${quando(st.ultima_iniciada_em)} e terminou ${quando(st.ultima_concluida_em)}. Tudo o que mudou até o começo está nos dados. Telas de Campanhas refeitas em ${quando(st.dados_atualizados_em)}. Próxima automática: ${quando(st.proxima_agenda)}.`}
            >
              <div className="text-[11px] uppercase tracking-wider text-neutral-400">Dados atualizados até</div>
              <div className="text-sm font-medium text-neutral-700">{quando(st.ultima_iniciada_em)}</div>
            </div>
            {st.pode_rodar && (
              <button
                onClick={() => {
                  setErro(null);
                  setConfirmar(true);
                }}
                disabled={bloqueado}
                title={bloqueado ? `Disponível de novo em ${minLiberar} min` : "Buscar agora o que mudou nos últimos 2 dias"}
                className="inline-flex items-center gap-1.5 border border-forest-900 px-3 py-1.5 text-xs font-medium text-forest-900 transition hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RefreshCw size={13} /> Atualizar
              </button>
            )}
          </>
        )}
      </div>

      {(erro || aviso) && (
        <div
          className={`fixed bottom-4 right-4 z-30 flex max-w-sm items-start gap-2 border px-4 py-3 text-sm shadow-lg ${
            erro ? "border-red-300 bg-red-50 text-red-700" : "border-forest-900 bg-green-soft text-forest-800"
          }`}
        >
          {erro ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <Check size={16} className="mt-0.5 shrink-0" />}
          <span className="flex-1">{erro ?? aviso}</span>
          <button onClick={() => { setErro(null); setAviso(null); }} className="opacity-60 hover:opacity-100" aria-label="Fechar">
            <X size={14} />
          </button>
        </div>
      )}

      {confirmar && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md border border-line-strong bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-line-strong px-6 py-4">
              <h2 className="font-title text-lg font-semibold text-forest-900">Atualizar os dados agora?</h2>
              <button onClick={() => setConfirmar(false)} className="text-neutral-400 transition hover:text-neutral-700" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 px-6 py-5 text-sm text-neutral-700">
              <p>
                Vamos buscar no <strong>Vista</strong> e no <strong>RealMate</strong> tudo o que mudou nos{" "}
                <strong>últimos 2 dias</strong> (imóveis, negócios, clientes, contatos, conversas, mensagens e notas) e,
                no fim, atualizar as telas de Campanhas.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-neutral-600">
                <li>Leva em média <strong>cerca de {duracao(st.media_min)}</strong>.</li>
                <li>Roda em segundo plano: você pode continuar usando o portal ou sair desta tela.</li>
                <li>Não dá para rodar duas ao mesmo tempo, e só dá para pedir outra 5 minutos depois desta.</li>
                <li>As atualizações automáticas (06h, 12h e 18h) continuam acontecendo normalmente.</li>
              </ul>
              <p className="text-xs text-neutral-500">
                Os dados do Vista e do RealMate estão atualizados até {quando(st.ultima_iniciada_em)}. Mudanças depois disso só entram numa nova atualização.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-line-strong px-6 py-4">
              <button
                onClick={() => setConfirmar(false)}
                disabled={iniciando}
                className="border border-line-strong px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={pedir}
                disabled={iniciando}
                className="inline-flex items-center gap-2 bg-forest-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-forest-800 disabled:opacity-40"
              >
                {iniciando ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Sim, atualizar agora
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
