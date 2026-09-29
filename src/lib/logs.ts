import { supabase } from "./supabase";

// Tipos gravados pelo navegador (via RPC registrar_log).
export type TipoLogCliente =
  | "login"
  | "entrou_campanhas"
  | "entrou_dashboard_locacoes"
  | "entrou_usuarios"
  | "aplicou_filtros"
  | "copiou_numeros"
  | "exportou_planilha"
  | "perfil_salvo"
  | "perfil_editado"
  | "perfil_excluido"
  | "buscou_usuario";

// Tipos gravados pela Edge Function admin-users (não dá para forjar pelo navegador).
export type TipoLogServidor =
  | "usuario_criado"
  | "usuario_reativado"
  | "usuario_desativado"
  | "senha_redefinida"
  | "usuario_excluido";

export type TipoLog = TipoLogCliente | TipoLogServidor;

// Rótulo + cor de cada atividade (ordem = ordem do filtro na tela de logs).
export const LOG_TIPOS: { tipo: TipoLog; label: string; cor: string }[] = [
  { tipo: "login", label: "Entrou no portal", cor: "bg-neutral-100 text-neutral-700 ring-neutral-500/20" },
  { tipo: "entrou_campanhas", label: "Entrou em Campanhas de Leads", cor: "bg-blue-50 text-blue-700 ring-blue-600/20" },
  { tipo: "entrou_dashboard_locacoes", label: "Entrou no Dashboard de Locações", cor: "bg-blue-50 text-blue-700 ring-blue-600/20" },
  { tipo: "entrou_usuarios", label: "Entrou em Usuários", cor: "bg-blue-50 text-blue-700 ring-blue-600/20" },
  { tipo: "aplicou_filtros", label: "Aplicou filtros", cor: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  { tipo: "copiou_numeros", label: "Copiou números", cor: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  { tipo: "exportou_planilha", label: "Exportou planilha", cor: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  { tipo: "perfil_salvo", label: "Salvou perfil", cor: "bg-violet-50 text-violet-700 ring-violet-600/20" },
  { tipo: "perfil_editado", label: "Editou perfil", cor: "bg-violet-50 text-violet-700 ring-violet-600/20" },
  { tipo: "perfil_excluido", label: "Excluiu perfil", cor: "bg-red-50 text-red-700 ring-red-600/20" },
  { tipo: "buscou_usuario", label: "Buscou usuário", cor: "bg-neutral-100 text-neutral-700 ring-neutral-500/20" },
  { tipo: "usuario_criado", label: "Criou usuário", cor: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  { tipo: "usuario_reativado", label: "Reativou usuário", cor: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  { tipo: "usuario_desativado", label: "Desativou usuário", cor: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  { tipo: "senha_redefinida", label: "Redefiniu senha", cor: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  { tipo: "usuario_excluido", label: "Excluiu usuário", cor: "bg-red-50 text-red-700 ring-red-600/20" },
];

// Fire-and-forget: registrar log nunca pode atrapalhar a ação do usuário. O
// `.then` é necessário porque o builder do supabase-js v2 é lazy.
export function registrarLog(tipo: TipoLogCliente, detalhes: Record<string, unknown> = {}) {
  supabase.rpc("registrar_log", { p_tipo: tipo, p_detalhes: detalhes }).then(
    () => {},
    () => {}
  );
}
