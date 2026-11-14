"use client";

/* =====================================================================
   DIRECTORIO Y GESTIÓN DE USUARIOS (components/admin/UsersTable.tsx)
   ---------------------------------------------------------------------
   Permite al Administrador:
     1. Ver la lista de todos los usuarios registrados (clientes, barberos, admin).
     2. Editar los datos del usuario (Nombre, Apellidos, Correo, Teléfono, Rol)
        mediante un modal intuitivo al hacer clic en el botón de edición.
     3. Eliminar un usuario con modal de confirmación de seguridad para
        prevenir borrados accidentales.
   Todos los cambios actualizan el Store y Supabase en tiempo real.
   ===================================================================== */

import { useState, useTransition } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Profile, UserRole } from "@/lib/types";
import { getInitials } from "@/lib/format";
import { deleteUserAction, updateUserAction } from "@/lib/actions";

interface UsersTableProps {
  initialProfiles: Profile[];
  totalCount: number;
  currentPage?: number;
  pageSize?: number;
}

export default function UsersTable({
  initialProfiles,
  totalCount,
  currentPage = 1,
  pageSize = 6,
}: UsersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [total, setTotal] = useState<number>(totalCount);

  // Sincronizar el estado local cuando el servidor envía otra página o datos nuevos.
  // Se hace durante el render (patrón recomendado por React) en lugar de en un efecto.
  const [prevInitialProfiles, setPrevInitialProfiles] = useState(initialProfiles);
  if (initialProfiles !== prevInitialProfiles) {
    setPrevInitialProfiles(initialProfiles);
    setProfiles(initialProfiles);
  }
  const [prevTotalCount, setPrevTotalCount] = useState(totalCount);
  if (totalCount !== prevTotalCount) {
    setPrevTotalCount(totalCount);
    setTotal(totalCount);
  }

  // Estados para modal de edición
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("cliente");

  // Estados para modal de eliminación
  const [deletingUser, setDeletingUser] = useState<Profile | null>(null);

  // Mensajes y transición
  const [actionMessage, setActionMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginatedProfiles = profiles;

  const goToPage = (targetPage: number) => {
    const nextPage = Math.max(1, Math.min(totalPages, targetPage));
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("page", String(nextPage));
    router.push(`${pathname}?${params.toString()}`);
  };

  // Abrir modal de edición con los datos del usuario seleccionado
  const handleOpenEdit = (user: Profile) => {
    setEditingUser(user);
    setEditFirstName(user.first_name);
    setEditLastName(user.last_name || "");
    setEditEmail(user.email);
    setEditPhone(user.phone || "");
    setEditRole(user.role);
    setActionMessage(null);
  };

  // Guardar edición de datos
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    startTransition(async () => {
      const res = await updateUserAction(editingUser.id, {
        first_name: editFirstName,
        last_name: editLastName,
        email: editEmail,
        phone: editPhone || null,
        role: editRole,
      });

      if (res.ok) {
        // Actualizar optimistamente en el estado
        setProfiles((prev) =>
          prev.map((u) =>
            u.id === editingUser.id
              ? {
                  ...u,
                  first_name: editFirstName,
                  last_name: editLastName,
                  email: editEmail,
                  phone: editPhone || null,
                  role: editRole,
                }
              : u
          )
        );
        setEditingUser(null);
        setActionMessage({ ok: true, text: "Usuario actualizado correctamente." });
        router.refresh();
      } else {
        setActionMessage({ ok: false, text: res.message || "Error al actualizar usuario." });
      }
    });
  };

  // Confirmar y eliminar usuario
  const handleConfirmDelete = () => {
    if (!deletingUser) return;

    startTransition(async () => {
      const res = await deleteUserAction(deletingUser.id);
      if (res.ok) {
        const remainingOnPage = profiles.filter((u) => u.id !== deletingUser.id);
        setProfiles(remainingOnPage);
        setTotal((prev) => Math.max(0, prev - 1));
        setDeletingUser(null);
        setActionMessage({ ok: true, text: "Usuario eliminado satisfactoriamente." });

        if (remainingOnPage.length === 0 && currentPage > 1) {
          goToPage(currentPage - 1);
        } else {
          router.refresh();
        }
      } else {
        setActionMessage({ ok: false, text: res.message || "Error al eliminar usuario." });
      }
    });
  };

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden border border-surface-container-high/60 flex flex-col">
      {/* Mensaje de retroalimentación de acciones */}
      {actionMessage && (
        <div
          className={`p-3.5 mx-4 mt-4 rounded-xl flex items-center justify-between text-sm ${
            actionMessage.ok
              ? "bg-secondary-fixed/50 text-on-secondary-fixed border border-secondary/40"
              : "bg-error-container text-on-error-container"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">
              {actionMessage.ok ? "check_circle" : "error"}
            </span>
            <span className="font-medium">{actionMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-current hover:opacity-75"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low/70 text-on-surface-variant font-label-sm uppercase tracking-wider border-b border-surface-container-high/60">
              <th className="py-4 px-6">Usuario</th>
              <th className="py-4 px-4">Rol</th>
              <th className="py-4 px-4">Teléfono</th>
              <th className="py-4 px-6 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-low text-on-surface font-body-md">
            {paginatedProfiles.map((user) => {
              const fullName = `${user.first_name} ${user.last_name}`.trim();
              const isAdmin = user.role === "admin";
              const isBarber = user.role === "barbero";

              return (
                <tr key={user.id} className="hover:bg-surface-container-low/40 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      {user.avatar_url ? (
                        <Image
                          src={user.avatar_url}
                          alt={fullName}
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-full object-cover shrink-0 ring-1 ring-surface-variant"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center font-title-md font-semibold text-on-surface shrink-0">
                          {getInitials(user.first_name, user.last_name)}
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="font-title-md font-semibold text-on-surface truncate">
                          {fullName}
                        </span>
                        <span className="font-body-sm text-on-surface-variant truncate">
                          {user.email}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="py-4 px-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                        isAdmin
                          ? "bg-secondary-fixed text-on-secondary-fixed"
                          : isBarber
                          ? "bg-surface-container-highest text-on-surface"
                          : "bg-surface-container text-on-surface-variant"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>

                  <td className="py-4 px-4 font-body-sm text-on-surface-variant font-mono whitespace-nowrap">
                    {user.phone || "No registrado"}
                  </td>

                  {/* Acciones: Primer botón Edición, Segundo botón Eliminación */}
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* BOTÓN 1: Editar Datos de Usuario */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(user)}
                        className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-secondary transition-all"
                        title={`Editar datos de ${fullName}`}
                      >
                        <span className="material-symbols-outlined text-[19px]">edit</span>
                      </button>

                      {/* BOTÓN 2: Eliminar Usuario */}
                      <button
                        type="button"
                        onClick={() => setDeletingUser(user)}
                        className="p-2 rounded-xl text-on-surface-variant hover:bg-error-container/50 hover:text-error transition-all"
                        title={`Eliminar usuario ${fullName}`}
                      >
                        <span className="material-symbols-outlined text-[19px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginación Real desde Base de Datos */}
      <div className="p-4 bg-surface-container-low/50 flex flex-col sm:flex-row items-center justify-between gap-3 font-body-sm text-on-surface-variant border-t border-surface-container-high/60">
        <span>
          Mostrando {paginatedProfiles.length} de {total} registros (Página {currentPage} de {totalPages})
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface-variant hover:bg-surface hover:text-on-surface transition-colors disabled:opacity-40"
          >
            Anterior
          </button>
          {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => {
            const isActive = pageNum === currentPage;
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => goToPage(pageNum)}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  isActive
                    ? "bg-primary text-on-primary font-semibold"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface hover:text-on-surface"
                }`}
              >
                {pageNum}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface-variant hover:bg-surface hover:text-on-surface transition-colors disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* MODAL 1: EDITAR DATOS DEL USUARIO */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-md p-6 sm:p-7 shadow-2xl border border-surface-container-high flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-surface-container-high/60 pb-3">
              <div>
                <span className="font-label-xs uppercase tracking-widest text-secondary font-bold">
                  Directorio
                </span>
                <h3 className="font-headline-sm text-on-surface font-bold">Editar Usuario</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-3.5">
              {/* Nombre y Apellido */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-on-surface font-medium" htmlFor="edit-first">
                    Nombre *
                  </label>
                  <input
                    id="edit-first"
                    type="text"
                    required
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-secondary/40 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-on-surface font-medium" htmlFor="edit-last">
                    Apellidos
                  </label>
                  <input
                    id="edit-last"
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-secondary/40 text-sm"
                  />
                </div>
              </div>

              {/* Correo Electrónico */}
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-on-surface font-medium" htmlFor="edit-email">
                  Correo Electrónico *
                </label>
                <input
                  id="edit-email"
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-secondary/40 text-sm"
                />
              </div>

              {/* Teléfono */}
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-on-surface font-medium" htmlFor="edit-phone">
                  Teléfono de Contacto
                </label>
                <input
                  id="edit-phone"
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+57 300 000 0000"
                  className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-secondary/40 text-sm"
                />
              </div>

              {/* Rol */}
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-on-surface font-medium" htmlFor="edit-role">
                  Rol y Permisos
                </label>
                <select
                  id="edit-role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-secondary/40 text-sm"
                >
                  <option value="cliente">Cliente (Reservas)</option>
                  <option value="barbero">Barbero (Staff del Estudio)</option>
                  <option value="admin">Administrador (Acceso Completo)</option>
                </select>
              </div>

              {/* Botones de acción del Modal */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-container-high/60 mt-1">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-full text-on-surface-variant hover:bg-surface-container font-label-md text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-full bg-primary text-on-primary hover:bg-neutral-800 font-label-md text-sm transition-all shadow-md flex items-center gap-1.5 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[16px] text-secondary-fixed">
                    {isPending ? "sync" : "save"}
                  </span>
                  <span>{isPending ? "Guardando..." : "Guardar Cambios"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRMACIÓN PARA ELIMINAR USUARIO */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-surface-container-high flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-error-container text-on-error-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[32px] text-error">
                warning
              </span>
            </div>

            <div>
              <h3 className="font-headline-sm text-on-surface font-bold">¿Eliminar usuario?</h3>
              <p className="font-body-sm text-on-surface-variant mt-1.5">
                ¿Estás seguro de que deseas eliminar a{" "}
                <strong className="text-on-surface">
                  {deletingUser.first_name} {deletingUser.last_name}
                </strong>{" "}
                ({deletingUser.email})? Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="flex items-center gap-2.5 w-full pt-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="flex-1 py-2.5 rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high font-label-md text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-full bg-error text-white hover:bg-error/90 font-label-md text-sm transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isPending ? "sync" : "delete"}
                </span>
                <span>{isPending ? "Borrando..." : "Eliminar"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
