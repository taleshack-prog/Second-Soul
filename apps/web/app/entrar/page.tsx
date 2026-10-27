"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { login, register, me } from "@/lib/api";

type Mode = "login" | "register";

export default function EntrarPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  // já logado? manda para onde faz sentido (admin vê o painel)
  useEffect(() => {
    me().then((acc) => {
      if (acc) router.replace(acc.is_admin ? "/admin" : "/meus-acervos");
      else setChecking(false);
    });
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const acc =
        mode === "login"
          ? await login(email.trim().toLowerCase(), password)
          : await register(email.trim().toLowerCase(), password, name.trim());
      router.replace(acc.is_admin ? "/admin" : "/meus-acervos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado.");
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <main className="min-h-screen grid place-items-center">
        <p className="text-muted">Carregando…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen grid place-items-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl text-ink text-center">Second Soul</h1>
        <p className="text-muted text-center mt-2 mb-8">
          {mode === "login"
            ? "Entre para acessar as essências que você guarda."
            : "Crie sua conta para começar a guardar uma essência."}
        </p>

        <form
          onSubmit={submit}
          className="bg-surface border border-line rounded-2xl p-6 space-y-4"
        >
          {mode === "register" && (
            <Field
              label="Seu nome"
              value={name}
              onChange={setName}
              type="text"
              placeholder="Como quer ser chamado"
            />
          )}
          <Field
            label="E-mail"
            value={email}
            onChange={setEmail}
            type="email"
            placeholder="voce@exemplo.com"
            required
          />
          <Field
            label="Senha"
            value={password}
            onChange={setPassword}
            type="password"
            placeholder={mode === "register" ? "mínimo 8 caracteres" : "sua senha"}
            required
          />

          {error && (
            <p className="text-sm text-red-300 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-soul text-base font-medium py-3 transition hover:brightness-110 disabled:opacity-50"
          >
            {busy
              ? "Aguarde…"
              : mode === "login"
                ? "Entrar"
                : "Criar conta"}
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          {mode === "login" ? "Ainda não tem conta? " : "Já tem conta? "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
            className="text-soul underline underline-offset-2"
          >
            {mode === "login" ? "Criar uma" : "Entrar"}
          </button>
        </p>
      </div>
    </main>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-sm text-muted mb-1.5">{props.label}</span>
      <input
        className="w-full rounded-xl bg-surface2 border border-line px-3 py-2.5 text-ink placeholder:text-muted/50 focus:border-soul outline-none transition"
        type={props.type}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        required={props.required}
        autoComplete={props.type === "password" ? "current-password" : "on"}
      />
    </label>
  );
}
