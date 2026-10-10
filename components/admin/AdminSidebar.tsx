import Link from "next/link";
import Image from "next/image";
import type { Profile } from "@/lib/types";

interface AdminSidebarProps {
  currentPath: string;
  adminUser: Profile | null;
}

export default function AdminSidebar({ currentPath, adminUser }: AdminSidebarProps) {
  const navItems = [
    { label: "Citas", icon: "calendar_today", href: "/admin" },
    { label: "Servicios", icon: "spa", href: "/admin/servicios" },
    { label: "Horarios", icon: "schedule", href: "/admin/horarios" },
    { label: "Usuarios", icon: "group", href: "/admin/usuarios" },
  ];

  return (
    <aside className="w-full lg:w-72 shrink-0 bg-surface-container-low rounded-2xl p-space-md shadow-sm flex flex-col justify-between gap-6 self-stretch">
      <div className="flex flex-col gap-space-md">
        {/* Cabecera del Panel */}
        <div className="flex items-center gap-space-sm px-space-sm pb-space-sm border-b border-surface-container-high/60">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary">
            <span className="material-symbols-outlined text-[20px] icon-filled">content_cut</span>
          </div>
          <div className="flex flex-col">
            <span className="font-title-md text-on-surface uppercase tracking-wider font-bold">
              JM Studio
            </span>
            <span className="font-label-sm text-secondary uppercase tracking-widest font-bold">
              Panel Administrador
            </span>
          </div>
        </div>

        {/* Menú de Navegación Lateral */}
        <nav aria-label="Navegación del Administrador" className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const isActive = currentPath === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-space-md py-3 rounded-full transition-all ${
                  isActive
                    ? "bg-primary text-on-primary shadow-sm font-semibold"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                }`}
              >
                <div className="flex items-center gap-space-sm">
                  <span
                    className={`material-symbols-outlined text-[20px] ${
                      isActive ? "text-secondary-fixed" : ""
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="font-label-lg">{item.label}</span>
                </div>
                {isActive && (
                  <span className="w-1.5 h-3.5 rounded-full bg-secondary-fixed"></span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Pie del Sidebar: Vista previa rápida & Perfil Admin */}
      <div className="flex flex-col gap-space-sm pt-space-lg border-t border-surface-container-high/60">
        <Link
          href="/cliente"
          className="flex items-center justify-between px-space-md py-2.5 rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors"
        >
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[18px] text-secondary">visibility</span>
            <span className="font-label-md">Vista de Cliente</span>
          </div>
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
            open_in_new
          </span>
        </Link>

        <div className="p-space-sm rounded-xl bg-surface-container-lowest flex items-center gap-space-sm shadow-sm">
          {adminUser?.avatar_url ? (
            <Image
              src={adminUser.avatar_url}
              alt="Administrador"
              width={40}
              height={40}
              className="w-10 h-10 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center font-bold text-on-surface">
              AD
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="font-title-md text-on-surface truncate leading-tight font-semibold">
              {adminUser ? `${adminUser.first_name} ${adminUser.last_name}` : "Admin"}
            </span>
            <span className="font-label-sm text-secondary truncate">
              {adminUser?.role === "admin" ? "Director / Admin" : "Barbero Staff"}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
