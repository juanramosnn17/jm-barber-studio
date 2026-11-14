import type { Metadata } from "next";
import AppHeader from "@/components/layout/AppHeader";
import Footer from "@/components/layout/Footer";
import AdminSidebar from "@/components/admin/AdminSidebar";
import UsersTable from "@/components/admin/UsersTable";
import { getClientCount, getCurrentProfile, getProfilesPage } from "@/lib/data/queries";

export const metadata: Metadata = {
  title: "Gestión de Usuarios y Permisos",
  description: "Directorio de usuarios, clientes, barberos y administradores en JM Barber Studio.",
};

const PAGE_SIZE = 6;

interface AdminUsersPageProps {
  searchParams?: Promise<{ page?: string }>;
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  const parsedPage = parseInt(resolvedParams?.page ?? "1", 10);
  const currentPage = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  const [adminUser, usersData, clientCount] = await Promise.all([
    getCurrentProfile("admin"),
    getProfilesPage(currentPage, PAGE_SIZE),
    getClientCount(),
  ]);

  const staffCount = Math.max(0, usersData.total - clientCount);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-surface selection:bg-secondary-fixed selection:text-on-secondary-fixed">
      <AppHeader user={adminUser} currentRole="admin" />

      <main className="w-full pt-20 bg-surface min-h-[calc(100vh-80px)] flex-1">
        <div className="max-w-[1440px] w-full mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
            {/* Sidebar con la ruta /admin/usuarios activa */}
            <div className="lg:col-span-3">
              <AdminSidebar currentPath="/admin/usuarios" adminUser={adminUser} />
            </div>

            {/* Contenido Principal: Gestión de Usuarios */}
            <section className="lg:col-span-9 flex flex-col gap-6">
              {/* Cabecera del Directorio */}
              <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-surface-container-high/60">
                <div>
                  <h1 className="font-headline-md text-on-surface font-bold">
                    Usuarios y Permisos
                  </h1>
                  <p className="font-body-sm text-on-surface-variant">
                    Control de accesos y directorio de clientes y barberos
                  </p>
                </div>
                {/* Sin "Nuevo Usuario": las cuentas se crean en /registro y el admin cambia el rol aquí */}
              </div>

              {/* Métricas rápidas */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col gap-1 border border-surface-container-high/60">
                  <span className="font-label-sm uppercase tracking-wide text-on-surface-variant">
                    Total Usuarios
                  </span>
                  <span className="font-headline-md text-on-surface font-bold">
                    {usersData.total}
                  </span>
                </div>
                <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col gap-1 border border-surface-container-high/60">
                  <span className="font-label-sm uppercase tracking-wide text-on-surface-variant">
                    Staff & Barberos
                  </span>
                  <span className="font-headline-md text-on-surface font-bold">
                    {staffCount}
                  </span>
                </div>
                <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col gap-1 border border-surface-container-high/60">
                  <span className="font-label-sm uppercase tracking-wide text-on-surface-variant">
                    Clientes
                  </span>
                  <span className="font-headline-md text-on-surface font-bold">
                    {clientCount}
                  </span>
                </div>
              </div>

              {/* Tabla Directorio con Paginación Real */}
              <UsersTable
                initialProfiles={usersData.rows}
                totalCount={usersData.total}
                currentPage={currentPage}
                pageSize={PAGE_SIZE}
              />
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
