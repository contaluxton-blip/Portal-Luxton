import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type Papel = "admin_geral" | "admin" | "geral";

export const PAPEL_LABEL: Record<Papel, string> = {
  admin_geral: "Administrador Geral",
  admin: "Administrador",
  geral: "Geral",
};

export type Perfil = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
};

type AuthCtx = {
  sessao: Session | null;
  perfil: Perfil | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
  recarregarPerfil: () => Promise<void>;
  ehAdmin: boolean;
  ehAdminGeral: boolean;
  podeCampanhas: boolean;
};

const Ctx = createContext<AuthCtx | null>(null);

async function buscarPerfil(id: string): Promise<Perfil | null> {
  const { data } = await supabase
    .from("usuarios")
    .select("id, nome, email, papel, ativo")
    .eq("id", id)
    .single();
  return (data as Perfil) ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!ativo) return;
      setSessao(data.session);
      if (data.session) setPerfil(await buscarPerfil(data.session.user.id));
      setCarregando(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (evento, s) => {
      if (!ativo) return;
      setSessao(s);
      if (s) {
        setPerfil(await buscarPerfil(s.user.id));
        // Fire-and-forget; o .then dispara a requisição (o builder é lazy no v2).
        if (evento === "SIGNED_IN") {
          supabase.rpc("registrar_acesso").then(
            () => {},
            () => {}
          );
        }
      } else {
        setPerfil(null);
      }
    });

    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const entrar = async (email: string, senha: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    });
    if (error) throw error;
  };

  const sair = async () => {
    await supabase.auth.signOut();
    setPerfil(null);
  };

  const recarregarPerfil = async () => {
    if (sessao) setPerfil(await buscarPerfil(sessao.user.id));
  };

  const value = useMemo<AuthCtx>(() => {
    const ehAdmin = !!perfil && perfil.ativo && (perfil.papel === "admin" || perfil.papel === "admin_geral");
    return {
      sessao,
      perfil,
      carregando,
      entrar,
      sair,
      recarregarPerfil,
      ehAdmin,
      ehAdminGeral: !!perfil && perfil.ativo && perfil.papel === "admin_geral",
      podeCampanhas: ehAdmin,
    };
  }, [sessao, perfil, carregando]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth precisa do <AuthProvider>");
  return ctx;
}
