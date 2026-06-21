"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { loginAction } from "@/features/auth/actions/auth.actions";

// A single wave period, tiled vertically to form the wavy side lines (desktop).
const WAVE = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='12' height='40' viewBox='0 0 12 40'><path d='M6 0 C0 10 12 30 6 40' fill='none' stroke='white' stroke-width='1.2'/></svg>`,
);
const waveStyle: React.CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,${WAVE}")`,
  backgroundRepeat: "repeat-y",
  backgroundSize: "12px 40px",
};

// Input styling pulled from the Figma export (mobile + desktop scales).
// border-2 border-gray-700 (#374151), bg-zinc-950 (#09090b).
const inputClass =
  "h-14 rounded-xl border-2 border-[#374151] bg-[#09090b] md:h-16 md:rounded-2xl";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const result = await loginAction(username.trim(), password);

    if (result.success) {
      // Session cookie is set server-side; a full navigation lets the proxy
      // route us to the role-appropriate home (/auction or /host).
      window.location.assign("/");
      return;
    }

    setError("Usuario o contraseña inválidos.");
    setLoading(false);
  }

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#09090b] px-6 py-10">
      {/* Wavy side lines — desktop only */}
      <div
        aria-hidden
        style={waveStyle}
        className="pointer-events-none absolute inset-y-0 left-8 hidden w-3 opacity-60 md:block"
      />
      <div
        aria-hidden
        style={waveStyle}
        className="pointer-events-none absolute inset-y-0 right-8 hidden w-3 opacity-60 md:block"
      />

      <div className="flex w-full max-w-6xl flex-col gap-8">
        <h1 className="text-center text-3xl font-medium text-white [text-shadow:0px_0px_10px_rgba(255,255,255,0.5)] md:text-left md:text-6xl md:[text-shadow:0px_0px_23px_rgba(255,255,255,0.5)]">
          Bienvenido :)
        </h1>

        <div className="flex flex-col items-center gap-10 md:flex-row md:justify-center md:gap-40">
          <Image
            src="/liga-logo.png"
            alt="Pokémon Liga de Inválidos"
            width={736}
            height={564}
            priority
            className="h-auto w-72 drop-shadow-[0px_0px_10px_rgba(255,255,255,0.15)] md:w-[34rem]"
          />

          <form
            onSubmit={handleSubmit}
            className="flex w-full max-w-sm flex-col items-center gap-8 md:max-w-md md:gap-12"
          >
            <div className="flex w-full flex-col gap-5 md:gap-7">
              <div className="flex flex-col gap-1.5 md:gap-2.5">
                <label
                  htmlFor="username"
                  className="text-xs font-normal text-white md:text-xl md:font-bold"
                >
                  Nombre
                </label>
                <Input
                  id="username"
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={loading}
                  className={inputClass}
                />
              </div>

              <div className="flex flex-col gap-1.5 md:gap-2.5">
                <label
                  htmlFor="password"
                  className="text-xs font-normal text-white md:text-xl md:font-bold"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className={`${inputClass} pr-12 md:pr-14`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={loading}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-white disabled:opacity-50 md:right-5"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 md:h-6 md:w-6" />
                    ) : (
                      <Eye className="h-5 w-5 md:h-6 md:w-6" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-48 rounded-lg bg-[#0F1D0E] px-7 py-2.5 text-base cursor-pointer font-medium text-[#d9f99d] shadow-[0px_0px_31px_0px_rgba(48,110,25,0.25)] outline outline-[1.33px] -outline-offset-[1.33px] outline-[#3f6212] transition-all disabled:cursor-not-allowed disabled:opacity-50 md:w-64 md:rounded-xl md:px-10 md:py-3.5 md:text-2xl md:shadow-[0px_0px_43px_0px_rgba(48,110,25,0.25)] md:outline-2"
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
