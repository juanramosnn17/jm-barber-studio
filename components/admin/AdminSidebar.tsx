import Link from "next/link";
import type { Profile } from "@/lib/types";

interface AdminSidebarProps {
  currentPath: string;
  adminUser: Profile | null;
}

export default function AdminSidebar({ currentPath, adminUser }: AdminSidebarProps) {
  // El barbero solo ve la agenda; el resto es exclusivo del admin (spec F4, tarea 3.21)
  const navItems = [
    { label: "Citas", icon: "calendar_today", href: "/admin" },
    ...(adminUser?.role === "admin"
      ? [
          { label: "Servicios", icon: "spa", href: "/admin/servicios" },
          { label: "Horarios", icon: "schedule", href: "/admin/horarios" },
          { label: "Usuarios", icon: "group", href: "/admin/usuarios" },
          {
            label: "Contabilidad",
            icon: "monitoring",
            href: "/admin/contabilidad/ganancias",
          },
        ]
      : []),
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
      {/* Sin pie: el usuario y "Vista de Cliente" ya están en el encabezado (AppHeader). */}
    </aside>
  );
}
