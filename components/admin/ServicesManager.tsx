"use client";

/* =====================================================================
   GESTOR DE SERVICIOS (components/admin/ServicesManager.tsx)
   ---------------------------------------------------------------------
   Permite al Administrador:
     1. Activar o desactivar servicios existentes de inmediato.
     2. Crear nuevos servicios y editar los existentes (nombre, precio,
        duración en minutos, reserva fija, descripción, icono e imagen).
   Los cambios en duración, precio o reserva solo aplican a citas nuevas;
   las reservas y cobros pasados conservan sus valores congelados (T-B4).
   ===================================================================== */

import { useState, useTransition } from "react";
import Image from "next/image";
import type { Service } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import {
  createServiceAction,
  toggleServiceActiveAction,
  updateServiceAction,
} from "@/lib/actions";
import ErrorMessage from "@/components/ui/ErrorMessage";
import ServiceReserveField from "@/components/admin/ServiceReserveField";

interface ServicesManagerProps {
  initialServices: Service[];
}

const PRESET_IMAGES = [
  { label: "Corte Tradicional", url: "/images/servicios/corte-cabello.jpg" },
  { label: "Corte Pro", url: "/images/servicios/corte-pro.jpg" },
  { label: "Corte Pro Max", url: "/images/servicios/corte-pro-max.jpg" },
  { label: "Arreglo de Barba", url: "/images/servicios/arreglo-barba.jpg" },
  { label: "Arreglo de Cejas", url: "/images/servicios/arreglo-cejas.jpg" },
];

const PRESET_ICONS = [
  { label: "Tijera", icon: "content_cut" },
  { label: "Cuidado Facial", icon: "spa" },
  { label: "Estilo & Barba", icon: "face" },
  { label: "Tratamiento", icon: "clean_hands" },
  { label: "Navaja / Detalle", icon: "auto_fix_high" },
];

export default function ServicesManager({ initialServices }: ServicesManagerProps) {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [selectedImage, setSelectedImage] = useState(PRESET_IMAGES[0].url);
  const [customImageUrl, setCustomImageUrl] = useState("");
  const [selectedIcon, setSelectedIcon] = useState(PRESET_ICONS[0].icon);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const openCreateModal = () => {
    setEditingService(null);
    setSelectedImage(PRESET_IMAGES[0].url);
    setCustomImageUrl("");
    setSelectedIcon(PRESET_ICONS[0].icon);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (srv: Service) => {
    setEditingService(srv);
    const isPreset = PRESET_IMAGES.some((img) => img.url === srv.image_url);
    setSelectedImage(isPreset && srv.image_url ? srv.image_url : PRESET_IMAGES[0].url);
    setCustomImageUrl(!isPreset && srv.image_url ? srv.image_url : "");
    setSelectedIcon(srv.icon || PRESET_ICONS[0].icon);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
    setErrorMessage(null);
  };

  // Alternar visibilidad de un servicio
  const handleToggle = (id: string) => {
    const previous = services;
    setToggleError(null);
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_active: !s.is_active } : s))
    );

    startTransition(async () => {
      const res = await toggleServiceActiveAction(id);
      if (!res.ok) {
        setServices(previous);
        setToggleError(res.message || "No se pudo cambiar el estado del servicio.");
      }
    });
  };

  // Crear o editar un servicio
  const handleSubmitService = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    const form = e.currentTarget;
    const formData = new FormData(form);

    const finalImageUrl = customImageUrl.trim() ? customImageUrl.trim() : selectedImage;
    formData.set("image_url", finalImageUrl);
    formData.set("icon", selectedIcon);

    const name = ((formData.get("name") as string) ?? "").trim();
    const shortName = ((formData.get("short_name") as string) ?? "").trim() || name;
    const price = Math.round(Number(formData.get("price")) || 0);
    const reserveAmount = Math.round(Number(formData.get("reserve_amount")) || 0);
    const durationMinutes = Math.round(Number(formData.get("duration_minutes")) || 30);
    const durationLabel =
      ((formData.get("duration_label") as string) ?? "").trim() || `${durationMinutes} min`;
    const desc = ((formData.get("description") as string) ?? "").trim();
    const includes = ((formData.get("includes") as string) ?? "").trim() || null;

    startTransition(async () => {
      const res = editingService
        ? await updateServiceAction(editingService.id, formData)
        : await createServiceAction(formData);

      if (res.ok) {
        if (editingService) {
          setServices((prev) =>
            prev.map((s) =>
              s.id === editingService.id
                ? {
                    ...s,
                    name,
                    short_name: shortName,
                    description: desc || s.description,
                    includes,
                    price,
                    reserve_amount: reserveAmount,
                    duration_minutes: durationMinutes,
                    duration_label: durationLabel,
                    image_url: finalImageUrl,
                    icon: selectedIcon,
                  }
                : s
            )
          );
        } else {
          const newLocalSrv: Service = {
            id: `srv-${Date.now()}`,
            name,
            short_name: shortName,
            description: desc || "Servicio profesional de cuidado masculino.",
            includes,
            price,
            reserve_amount: reserveAmount,
            duration_minutes: durationMinutes,
            duration_label: durationLabel,
            image_url: finalImageUrl,
            icon: selectedIcon,
            is_active: true,
            sort_order: services.length + 1,
          };
          setServices((prev) => [...prev, newLocalSrv]);
        }
        closeModal();
        form.reset();
      } else {
        setErrorMessage(
          res.message ||
            (editingService ? "Error al actualizar el servicio." : "Error al crear el servicio.")
        );
      }
    });
  };

  return (
    <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col justify-between gap-space-md border border-surface-container-high/60">
      {toggleError && <ErrorMessage message={toggleError} />}

      {/* Cabecera del Módulo */}
      <div className="flex items-center justify-between pb-2 border-b border-surface-container-high/60">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h3 className="font-title-lg text-on-surface font-semibold">Servicios del Estudio</h3>
            <span className="px-2 py-0.5 rounded-full bg-surface-container font-label-xs text-on-surface-variant font-bold">
              {services.length}
            </span>
          </div>
          <p className="font-body-sm text-on-surface-variant mt-0.5">
            Activa, edita duración/precio o agrega servicios para el catálogo de clientes
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="h-9 px-3.5 rounded-full bg-primary text-on-primary hover:bg-neutral-800 font-label-md transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px] text-secondary-fixed">add</span>
          <span>Nuevo Servicio</span>
        </button>
      </div>

      {/* Lista de Servicios Disponibles */}
      <div className="flex flex-col gap-space-sm max-h-[420px] overflow-y-auto pr-1">
        {services.map((srv) => (
          <div
            key={srv.id}
            className={`p-space-sm rounded-xl flex items-center justify-between gap-space-sm transition-all border ${
              srv.is_active
                ? "bg-surface-container-low border-surface-container-high/40"
                : "bg-surface-container-lowest/60 opacity-60 border-dashed border-outline-variant/40"
            }`}
          >
            <div className="flex items-center gap-space-sm min-w-0">
              {srv.image_url ? (
                <div className="w-11 h-11 rounded-lg overflow-hidden relative shrink-0 bg-surface-container">
                  <Image src={srv.image_url} alt={srv.name} fill className="object-cover" />
                </div>
              ) : (
                <div className="w-11 h-11 rounded-lg bg-surface-container flex items-center justify-center text-on-surface shrink-0">
                  <span className="material-symbols-outlined text-[20px]">{srv.icon}</span>
                </div>
              )}

              <div className="flex flex-col min-w-0">
                <span className="font-title-md text-on-surface truncate font-semibold">
                  {srv.name}
                </span>
                <span className="font-body-sm text-on-surface-variant">
                  {formatPrice(srv.price)} • {srv.duration_minutes} min
                  {srv.duration_label && srv.duration_label !== `${srv.duration_minutes} min`
                    ? ` (${srv.duration_label})`
                    : ""}
                </span>
                <ServiceReserveField
                  // La key con el monto reinicia el campo cuando "Editar" cambia la reserva
                  key={`${srv.id}-${srv.reserve_amount ?? 0}`}
                  serviceId={srv.id}
                  serviceName={srv.name}
                  initialAmount={Number(srv.reserve_amount ?? 0)}
                />
              </div>
            </div>

            {/* Acciones: Editar + Conmutador Activo/Inactivo */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => openEditModal(srv)}
                disabled={isPending}
                aria-label={`Editar el servicio ${srv.name}`}
                className="h-8 px-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-xs flex items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[15px]">edit</span>
                <span className="hidden sm:inline">Editar</span>
              </button>

              <span className="font-label-xs text-on-surface-variant hidden md:inline">
                {srv.is_active ? "Visible" : "Oculto"}
              </span>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={srv.is_active}
                  onChange={() => handleToggle(srv.id)}
                  disabled={isPending}
                  aria-label={`${srv.is_active ? "Ocultar" : "Mostrar"} el servicio ${srv.name}`}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-on-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-on-primary after:border-surface-variant after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL: CREAR O EDITAR SERVICIO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl border border-surface-container-high flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-container-high/60 pb-3">
              <div>
                <span className="font-label-xs uppercase tracking-widest text-secondary font-bold">
                  Catálogo Maestro
                </span>
                <h3 className="font-headline-sm text-on-surface font-bold">
                  {editingService ? "Editar Servicio" : "Agregar Nuevo Servicio"}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Cerrar ventana"
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-error-container text-on-error-container text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{errorMessage}</span>
              </div>
            )}

            <form
              key={editingService?.id ?? "new-service"}
              onSubmit={handleSubmitService}
              className="flex flex-col gap-4"
            >
              {/* Nombre y Nombre Corto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-on-surface font-medium" htmlFor="srv-name">
                    Nombre del Servicio *
                  </label>
                  <input
                    id="srv-name"
                    name="name"
                    required
                    defaultValue={editingService?.name ?? ""}
                    placeholder="Ej. Corte & Toalla Caliente"
                    className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-secondary/40 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-on-surface font-medium" htmlFor="srv-short">
                    Nombre Corto
                  </label>
                  <input
                    id="srv-short"
                    name="short_name"
                    defaultValue={editingService?.short_name ?? ""}
                    placeholder="Ej. Corte Ritual"
                    className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-secondary/40 text-sm"
                  />
                </div>
              </div>

              {/* Precio y Reserva fija */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-on-surface font-medium" htmlFor="srv-price">
                    Precio (COP) *
                  </label>
                  <input
                    id="srv-price"
                    name="price"
                    type="number"
                    required
                    min="1000"
                    step="500"
                    defaultValue={editingService?.price ?? ""}
                    placeholder="25000"
                    className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-secondary/40 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-on-surface font-medium" htmlFor="srv-reserve">
                    Reserva del negocio (COP)
                  </label>
                  <input
                    id="srv-reserve"
                    name="reserve_amount"
                    type="number"
                    min="0"
                    step="500"
                    defaultValue={editingService?.reserve_amount ?? 0}
                    placeholder="5000"
                    className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-secondary/40 text-sm"
                  />
                </div>
              </div>

              {/* Duración real en minutos (bloquea agenda) + etiqueta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label
                    className="font-label-sm text-on-surface font-medium"
                    htmlFor="srv-duration-minutes"
                  >
                    Duración real (minutos) *
                  </label>
                  <input
                    id="srv-duration-minutes"
                    name="duration_minutes"
                    type="number"
                    required
                    min="10"
                    max="240"
                    step="5"
                    defaultValue={editingService?.duration_minutes ?? 30}
                    placeholder="60"
                    className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-secondary/40 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-on-surface font-medium" htmlFor="srv-duration">
                    Etiqueta visible
                  </label>
                  <input
                    id="srv-duration"
                    name="duration_label"
                    defaultValue={editingService?.duration_label ?? ""}
                    placeholder="Ej. 60 min"
                    className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-secondary/40 text-sm"
                  />
                </div>
              </div>

              {/* Descripción y qué incluye */}
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-on-surface font-medium" htmlFor="srv-desc">
                  Descripción del Servicio
                </label>
                <textarea
                  id="srv-desc"
                  name="description"
                  rows={2}
                  defaultValue={editingService?.description ?? ""}
                  placeholder="Detalla qué incluye la experiencia para el cliente..."
                  className="p-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-secondary/40 text-sm resize-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-on-surface font-medium" htmlFor="srv-includes">
                  Qué incluye (opcional)
                </label>
                <input
                  id="srv-includes"
                  name="includes"
                  defaultValue={editingService?.includes ?? ""}
                  placeholder="Ej. Lavado + Peinado + Asesoría"
                  className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-secondary/40 text-sm"
                />
              </div>

              {/* Selección de Icono */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-on-surface font-medium">
                  Icono representativo
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_ICONS.map((item) => (
                    <button
                      key={item.icon}
                      type="button"
                      onClick={() => setSelectedIcon(item.icon)}
                      className={`h-9 px-3 rounded-xl flex items-center gap-1.5 text-xs font-medium border transition-all ${
                        selectedIcon === item.icon
                          ? "bg-primary text-on-primary border-primary shadow-sm"
                          : "bg-surface-container text-on-surface hover:bg-surface-container-high border-surface-container-high"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selección de Imagen */}
              <div className="flex flex-col gap-2">
                <label className="font-label-sm text-on-surface font-medium">
                  Imagen del Servicio
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {PRESET_IMAGES.map((img) => {
                    const isSelected = selectedImage === img.url && !customImageUrl;
                    return (
                      <button
                        key={img.url}
                        type="button"
                        onClick={() => {
                          setSelectedImage(img.url);
                          setCustomImageUrl("");
                        }}
                        className={`relative h-16 rounded-xl overflow-hidden border-2 transition-all ${
                          isSelected
                            ? "border-secondary ring-2 ring-secondary/40"
                            : "border-transparent opacity-70 hover:opacity-100"
                        }`}
                      >
                        <Image src={img.url} alt={img.label} fill className="object-cover" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botones de Envío */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-container-high/60 mt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 rounded-full text-on-surface-variant hover:bg-surface-container font-label-md text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2.5 rounded-full bg-primary text-on-primary hover:bg-neutral-800 font-label-md text-sm transition-all shadow-md flex items-center gap-1.5 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[18px] text-secondary-fixed">
                    {isPending ? "sync" : "save"}
                  </span>
                  <span>
                    {isPending
                      ? "Guardando..."
                      : editingService
                      ? "Guardar Cambios"
                      : "Guardar Servicio"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
