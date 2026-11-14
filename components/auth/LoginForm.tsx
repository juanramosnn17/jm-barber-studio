"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction } from "@/lib/actions";

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, null);
  const [showPassword, setShowPassword] = useState(false);
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("return_url") || searchParams.get("next") || "";
  const submitText = "Acceder al Estudio";

  return (
    <div className="w-full max-w-[500px] mx-auto">
      {/* Tarjeta de Inicio de Sesión */}
      <div className="bg-surface-container-lowest rounded-3xl p-6 sm:p-10 shadow-[0_4px_28px_-4px_rgba(24,24,27,0.06),0_2px_8px_-1px_rgba(24,24,27,0.03)] relative overflow-hidden">
        <div className="flex flex-col items-center text-center mb-space-lg">
          <h1 className="font-headline-lg text-on-surface tracking-tight">Iniciar Sesión</h1>
          <p className="font-body-sm text-on-surface-variant mt-space-xs max-w-sm">
            Accede para gestionar tus citas y reservas en JM Barber.
          </p>
        </div>

        {/* Mensaje de Error si falla la autenticación */}
        {state?.ok === false && (
          <div className="mb-space-md p-3 rounded-xl bg-error-container text-on-error-container text-body-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{state.message}</span>
          </div>
        )}

        <form action={formAction} className="flex flex-col gap-space-md">
          {/* Input Oculto para Redirección tras Login */}
          <input type="hidden" name="return_url" value={returnUrl} />
          {/* Campo Correo (Supabase Auth inicia sesión con correo) */}
          <div className="flex flex-col gap-1.5 text-left">
            <label className="font-label-md text-on-surface flex items-center gap-1.5" htmlFor="identifier">
              <span>Correo electrónico</span>
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-4 text-on-surface-variant text-[20px] pointer-events-none select-none">
                mail
              </span>
              <input
                className="w-full h-12 pl-12 pr-4 bg-surface-container-lowest rounded-xl font-body-md text-on-surface placeholder:text-outline-variant border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-secondary/40 shadow-sm transition-all"
                id="identifier"
                name="identifier"
                placeholder="tucorreo@ejemplo.com"
                autoComplete="email"
                required
                type="email"
              />
            </div>
          </div>

          {/* Campo Contraseña */}
          <div className="flex flex-col gap-1.5 text-left">
            <label className="font-label-md text-on-surface flex items-center gap-1.5" htmlFor="password">
              <span>Contraseña</span>
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-4 text-on-surface-variant text-[20px] pointer-events-none select-none">
                lock
              </span>
              <input
                className="w-full h-12 pl-12 pr-12 bg-surface-container-lowest rounded-xl font-body-md text-on-surface placeholder:text-outline-variant border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-secondary/40 shadow-sm transition-all"
                id="password"
                name="password"
                placeholder="••••••••••••"
                required
                type={showPassword ? "text" : "password"}
              />
              <button
                type="button"
                aria-label="Alternar visibilidad de contraseña"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 text-on-surface-variant hover:text-on-surface transition-colors p-1 flex items-center justify-center rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>

          {/* Botón de envío */}
          <button
            className="w-full h-12 mt-1 rounded-full bg-primary text-on-primary font-label-lg flex items-center justify-center gap-2 shadow-md hover:bg-neutral-800 active:scale-[0.99] transition-all duration-150 disabled:opacity-70"
            type="submit"
            disabled={isPending}
          >
            <span>{isPending ? "Validando..." : submitText}</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </form>

        <div className="mt-space-lg pt-space-md border-t border-surface-container-high/60 flex flex-col items-center text-center gap-1.5">
          <p className="font-body-sm text-on-surface-variant">
            ¿Aún no tienes cuenta?
            <Link
              href="/registro"
              className="font-label-md text-primary hover:text-secondary underline underline-offset-4 ml-1 transition-colors"
            >
              Regístrate y reserva tu cita
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
