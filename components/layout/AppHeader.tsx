"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import BrandLogo from "@/components/ui/BrandLogo";
import type { Profile } from "@/lib/types";
import { logoutAction } from "@/lib/actions";
import { getInitials } from "@/lib/format";

interface AppHeaderProps {
  user: Profile | null;
  currentRole?: "cliente" | "admin";
}

export default function AppHeader({ user, currentRole = "cliente" }: AppHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const fullName = user ? `${user.first_name} ${user.last_name}`.trim() : "Invitado";
  // El staff (admin/barbero) puede ver /cliente, pero su panel principal es /admin (spec F3)
  const isStaff = user?.role === "admin" || user?.role === "barbero";
  const homeHref = isStaff ? "/admin" : "/cliente";

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-surface/95 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-20 max-w-[1440px] mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin flex items-center justify-between gap-space-lg">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-space-sm hover:opacity-90 transition-opacity">
          <BrandLogo className="h-9 w-auto" />
        </Link>

        {/* Barra lateral / Navegación derecha */}
        <div className="flex items-center gap-space-md">
          {/* Si está en admin, enlace a vista de cliente */}
          {currentRole === "admin" && (
            <Link
              href="/cliente"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md"
            >
              <span className="material-symbols-outlined text-[16px] text-secondary">visibility</span>
              <span>Vista de Cliente</span>
            </Link>
          )}

          {/* Si el staff está en la vista de cliente, enlace para volver al panel */}
          {currentRole === "cliente" && isStaff && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-3 h-11 rounded-full bg-primary text-on-primary hover:bg-neutral-800 transition-all font-label-md text-label-md"
            >
              <span className="material-symbols-outlined text-[16px] text-secondary-fixed" aria-hidden="true">
                arrow_back
              </span>
              <span>Volver al panel</span>
            </Link>
          )}

          {/* Menú de Perfil de Usuario */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-space-sm pl-space-sm py-1 pr-1.5 rounded-full bg-surface-container-low shadow-[0_2px_8px_rgba(24,24,27,0.03)] cursor-pointer hover:bg-surface-container transition-colors"
            >
              <div className="hidden sm:flex flex-col text-right pl-3">
                <span className="font-label-lg text-on-surface leading-tight font-semibold">
                  {fullName}
                </span>
                {user?.role && (
                  <span className="font-label-sm text-secondary capitalize text-left">
                    {user.role}
                  </span>
                )}
              </div>

              {/* Avatar con fallback de iniciales */}
              <div className="relative flex items-center">
                {user?.avatar_url ? (
                  <Image
                    src={user.avatar_url}
                    alt={fullName}
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-secondary/20"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-surface-container-high text-on-surface font-semibold flex items-center justify-center text-sm ring-2 ring-secondary/20">
                    {user ? getInitials(user.first_name, user.last_name) : "US"}
                  </div>
                )}
                <span
                  className={`material-symbols-outlined text-on-surface-variant text-[18px] ml-0.5 transition-transform ${
                    dropdownOpen ? "rotate-180" : ""
                  }`}
                >
                  arrow_drop_down
                </span>
              </div>
            </button>

            {/* Dropdown del perfil */}
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-52 bg-surface-container-lowest rounded-2xl shadow-lg border border-surface-variant/40 p-1.5 flex flex-col gap-1 z-50">
                  <div className="px-3 py-2 border-b border-surface-container-high">
                    <p className="font-label-md text-on-surface font-bold truncate">{fullName}</p>
                    <p className="font-body-sm text-on-surface-variant truncate">{user?.email}</p>
                  </div>

                  <Link
                    href={homeHref}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-on-surface hover:bg-surface-container font-label-md transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <span className="material-symbols-outlined text-[18px] text-secondary">
                      dashboard
                    </span>
                    <span>Panel Principal</span>
                  </Link>

                  <form action={logoutAction}>
                    <button
                      type="submit"
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-error hover:bg-error-container/20 font-label-md transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[18px]">logout</span>
                      <span>Cerrar sesión</span>
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
