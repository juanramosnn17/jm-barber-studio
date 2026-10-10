"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { registerAction } from "@/lib/actions";

export default function RegisterForm() {
  const [state, formAction, isPending] = useActionState(registerAction, null);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");

  // Cálculo visual de la fortaleza de la contraseña
  const calculateStrength = (val: string) => {
    if (!val) return 0;
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    return score;
  };

  const strength = calculateStrength(password);
  const strengthLabels = [
    "Mínimo 8 caracteres",
    "Débil",
    "Aceptable",
    "Buena",
    "Excelente",
  ];

  return (
    <div className="w-full max-w-[580px] mx-auto my-auto relative">
      <div className="bg-surface-container-lowest rounded-2xl shadow-[0px_4px_28px_-2px_rgba(24,24,27,0.06),0px_2px_8px_-1px_rgba(24,24,27,0.03)] p-space-lg md:p-space-xl relative overflow-hidden transition-all duration-300">
        <div className="space-y-space-xs mb-space-lg text-left">
          <h1 className="font-headline-lg text-on-surface tracking-tight">Crear Cuenta</h1>
          <p className="font-body-sm text-on-surface-variant">
            Únete a JM Barber Studio para reservar citas en segundos.
          </p>
        </div>

        {/* Mensaje de Error */}
        {state?.ok === false && (
          <div className="mb-space-md p-3 rounded-xl bg-error-container text-on-error-container text-body-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{state.message}</span>
          </div>
        )}

        <form action={formAction} className="space-y-space-md">
          {/* Fila Nombre y Apellidos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm sm:gap-space-md">
            <div className="space-y-1">
              <label className="block font-label-md text-on-surface" htmlFor="first_name">
                Nombre
              </label>
              <input
                className="w-full h-[48px] px-space-md rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline font-body-md focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary/40 transition-all duration-200 border border-transparent focus:border-surface-container-high"
                id="first_name"
                name="first_name"
                placeholder="Carlos"
                required
                type="text"
              />
            </div>
            <div className="space-y-1">
              <label className="block font-label-md text-on-surface" htmlFor="last_name">
                Apellidos
              </label>
              <input
                className="w-full h-[48px] px-space-md rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline font-body-md focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary/40 transition-all duration-200 border border-transparent focus:border-surface-container-high"
                id="last_name"
                name="last_name"
                placeholder="Santana"
                required
                type="text"
              />
            </div>
          </div>

          {/* Correo Electrónico */}
          <div className="space-y-1">
            <label className="block font-label-md text-on-surface" htmlFor="email">
              Correo Electrónico
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-space-md text-outline text-[20px] pointer-events-none">
                mail
              </span>
              <input
                className="w-full h-[48px] pl-11 pr-space-md rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline font-body-md focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary/40 transition-all duration-200 border border-transparent focus:border-surface-container-high"
                id="email"
                name="email"
                placeholder="carlos.santana@ejemplo.com"
                required
                type="email"
              />
            </div>
          </div>

          {/* Teléfono / WhatsApp */}
          <div className="space-y-1">
            <label className="block font-label-md text-on-surface" htmlFor="phone">
              Teléfono / WhatsApp
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-space-md flex items-center gap-1 text-on-surface font-label-md pr-2 pointer-events-none select-none">
                <span className="material-symbols-outlined text-[18px] text-secondary">
                  phone_iphone
                </span>
                <span className="font-bold">+57</span>
              </div>
              <input
                className="w-full h-[48px] pl-20 pr-space-md rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline font-body-md focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary/40 transition-all duration-200 border border-transparent focus:border-surface-container-high"
                id="phone"
                name="phone"
                placeholder="312 345 6789"
                required
                type="tel"
              />
            </div>
          </div>

          {/* Contraseñas */}
          <div className="space-y-space-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm sm:gap-space-md">
              <div className="space-y-1">
                <label className="block font-label-md text-on-surface" htmlFor="password">
                  Contraseña
                </label>
                <div className="relative flex items-center">
                  <input
                    className="w-full h-[48px] px-space-md pr-10 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline font-body-md focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary/40 transition-all duration-200"
                    id="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    type={showPassword ? "text" : "password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-outline hover:text-on-surface transition-colors cursor-pointer flex items-center"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-label-md text-on-surface" htmlFor="confirm_password">
                  Confirmar
                </label>
                <div className="relative flex items-center">
                  <input
                    className="w-full h-[48px] px-space-md pr-10 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline font-body-md focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary/40 transition-all duration-200"
                    id="confirm_password"
                    name="confirm_password"
                    placeholder="••••••••••••"
                    required
                    type={showPassword ? "text" : "password"}
                  />
                </div>
              </div>
            </div>

            {/* Barra indicadora de fortaleza */}
            <div className="pt-1 px-1">
              <div className="flex items-center justify-between mb-1">
                <span className="font-label-sm text-on-surface-variant font-medium">
                  Seguridad de la clave
                </span>
                <span className="font-label-sm text-secondary font-bold">
                  {strengthLabels[strength]}
                </span>
              </div>
              <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden flex gap-1">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`h-full w-1/4 rounded-full transition-all duration-300 ${
                      strength >= step
                        ? strength === 1
                          ? "bg-error"
                          : "bg-secondary"
                        : "bg-surface-container-high"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Checkboxes de Términos y Notificaciones */}
          <div className="space-y-space-sm pt-space-xs">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input className="peer sr-only" id="terms" name="terms" required type="checkbox" />
              <div className="w-5 h-5 rounded bg-surface-container-low peer-checked:bg-primary transition-all duration-200 flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
                <span className="material-symbols-outlined text-[15px] text-secondary-fixed opacity-0 peer-checked:opacity-100 font-bold">
                  check
                </span>
              </div>
              <span className="font-body-sm text-on-surface-variant leading-tight select-none">
                Acepto los{" "}
                <a href="#" className="text-on-surface font-semibold underline underline-offset-2 hover:text-secondary">
                  Términos de Servicio
                </a>{" "}
                y la{" "}
                <a href="#" className="text-on-surface font-semibold underline underline-offset-2 hover:text-secondary">
                  Política de Privacidad
                </a>{" "}
                de JM Barber Studio.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input className="peer sr-only" id="reminders" name="reminders" defaultChecked type="checkbox" />
              <div className="w-5 h-5 rounded bg-surface-container-low peer-checked:bg-primary transition-all duration-200 flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
                <span className="material-symbols-outlined text-[15px] text-secondary-fixed opacity-0 peer-checked:opacity-100 font-bold">
                  check
                </span>
              </div>
              <span className="font-body-sm text-on-surface-variant leading-tight select-none">
                Deseo recibir confirmaciones y recordatorios de cita por WhatsApp o SMS.
              </span>
            </label>
          </div>

          {/* Botón Principal */}
          <div className="pt-space-sm">
            <button
              className="group w-full h-[52px] bg-primary text-on-primary rounded-full font-label-lg tracking-wide flex items-center justify-center gap-space-sm shadow-[0_4px_14px_rgba(0,0,0,0.15)] hover:bg-[#27272a] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-70"
              type="submit"
              disabled={isPending}
            >
              <span>{isPending ? "Creando cuenta..." : "Crear Cuenta y Reservar"}</span>
              <span className="material-symbols-outlined text-[20px] transition-transform duration-200 group-hover:translate-x-1">
                arrow_forward
              </span>
            </button>
          </div>
        </form>

        <div className="mt-space-md text-center">
          <p className="font-body-md text-on-surface-variant">
            ¿Ya eres miembro?{" "}
            <Link
              href="/login"
              className="text-primary font-semibold hover:text-secondary underline underline-offset-4 ml-1 transition-colors"
            >
              Inicia sesión aquí
            </Link>
          </p>
        </div>

        {/* Micro-insignias de confianza */}
        <div className="mt-space-lg flex items-center justify-center gap-space-md sm:gap-space-xl text-on-surface-variant/80 border-t border-surface-container-high/60 pt-space-md">
          <div className="flex items-center gap-1.5 font-label-sm">
            <span className="material-symbols-outlined text-[16px] text-secondary">
              verified_user
            </span>
            <span>Datos encriptados</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-outline-variant"></div>
          <div className="flex items-center gap-1.5 font-label-sm">
            <span className="material-symbols-outlined text-[16px] text-secondary">
              schedule
            </span>
            <span>Cita asegurada</span>
          </div>
        </div>
      </div>
    </div>
  );
}
