"use client";

/* =====================================================================
   GESTOR DE SERVICIOS (components/admin/ServicesManager.tsx)
   ---------------------------------------------------------------------
   Permite al Administrador:
     1. Activar o desactivar servicios existentes de inmediato.
     2. Crear nuevos servicios con:
        - Nombre y nombre corto
        - Precio e inversión
        - Duración estimada (minutos y etiqueta)
        - Descripción detallada
        - Icono distintivo
        - Imagen representativa (elegir entre galería o URL personalizada)
   Al guardar, se actualiza el Store y Supabase, impactando en tiempo real
   tanto la landing page (/) como el catálogo del cliente (/cliente).
   ===================================================================== */

import { useState, useTransition } from "react";
import Image from "next/image";
import type { Service } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { createServiceAction, toggleServiceActiveAction } from "@/lib/actions";

interface ServicesManagerProps {
  initialServices: Service[];
}

// Opciones de imágenes sugeridas precargadas en el proyecto
const PRESET_IMAGES = [
  { label: "Corte Tradicional", url: "/images/servicios/corte-cabello.jpg" },
  { label: "Corte Pro", url: "/images/servicios/corte-pro.jpg" },
  { label: "Corte Pro Max", url: "/images/servicios/corte-pro-max.jpg" },
  { label: "Arreglo de Barba", url: "/images/servicios/arreglo-barba.jpg" },
  { label: "Arreglo de Cejas", url: "/images/servicios/arreglo-cejas.jpg" },
];

// Opciones de iconos Material Symbols disponibles
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
  const [selectedImage, setSelectedImage] = useState(PRESET_IMAGES[0].url);
  const [customImageUrl, setCustomImageUrl] = useState("");
  const [selectedIcon, setSelectedIcon] = useState(PRESET_ICONS[0].icon);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Alternar visibilidad de un servicio
  const handleToggle = (id: string) => {
    // Optimistic UI update
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_active: !s.is_active } : s))
    );

    startTransition(async () => {
      await toggleServiceActiveAction(id);
    });
  };

  // Crear un nuevo servicio
  const handleSubmitNewService = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    const form = e.currentTarget;
    const formData = new FormData(form);

    const finalImageUrl = customImageUrl.trim() ? customImageUrl.trim() : selectedImage;
    formData.set("image_url", finalImageUrl);
    formData.set("icon", selectedIcon);

    startTransition(async () => {
      const res = await createServiceAction(formData);
      if (res.ok) {
        setIsModalOpen(false);
        form.reset();
        setCustomImageUrl("");
        // Agregar optimistamente al estado local para reflejo inmediato
        const name = formData.get("name") as string;
        const price = parseFloat(formData.get("price") as string) || 0;
        const duration = (formData.get("duration_label") as string) || "30 min";
        const desc = (formData.get("description") as string) || "";
        const newLocalSrv: Service = {
          id: `srv-${Date.now()}`,
          name,
          short_name: name,
          description: desc,
          includes: null,
          price,
          duration_minutes: 30,
          duration_label: duration,
          image_url: finalImageUrl,
          icon: selectedIcon,
          is_active: true,
          sort_order: services.length + 1,
        };
        setServices((prev) => [...prev, newLocalSrv]);
      } else {
        setErrorMessage(res.message || "Error al crear el servicio.");
      }
    });
  };

  return (
    <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col justify-between gap-space-md border border-surface-container-high/60">
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
            Activa, desactiva o agrega servicios para el catálogo de clientes
          </p>
        </div>

        {/* Botón para abrir modal de nuevo servicio */}
        {/* EDITAR AQUÍ: Botón que dispara el formulario de nuevo servicio */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="h-9 px-3.5 rounded-full bg-primary text-on-primary hover:bg-neutral-800 font-label-md transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px] text-secondary-fixed">add</span>
          <span>Nuevo Servicio</span>
        </button>
      </div>

      {/* Lista de Servicios Disponibles */}
      <div className="flex flex-col gap-space-sm max-h-[380px] overflow-y-auto pr-1">
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
                  {formatPrice(srv.price)} • {srv.duration_label}
                </span>
              </div>
            </div>

            {/* Conmutador de Visibilidad Activo/Inactivo */}
            <div className="flex items-center gap-2">
              <span className="font-label-xs text-on-surface-variant hidden sm:inline">
                {srv.is_active ? "Visible" : "Oculto"}
              </span>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={srv.is_active}
                  onChange={() => handleToggle(srv.id)}
                  disabled={isPending}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-on-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-on-primary after:border-surface-variant after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL: FORMULARIO PARA AGREGAR NUEVO SERVICIO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl border border-surface-container-high flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-container-high/60 pb-3">
              <div>
                <span className="font-label-xs uppercase tracking-widest text-secondary font-bold">
                  Catálogo Maestro
                </span>
                <h3 className="font-headline-sm text-on-surface font-bold">Agregar Nuevo Servicio</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
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

            <form onSubmit={handleSubmitNewService} className="flex flex-col gap-4">
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
                    placeholder="Ej. Corte Ritual"
                    className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-secondary/40 text-sm"
                  />
                </div>
              </div>

              {/* Precio y Duración */}
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
                    placeholder="45000"
                    className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-secondary/40 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-on-surface font-medium" htmlFor="srv-duration">
                    Etiqueta de Duración
                  </label>
                  <input
                    id="srv-duration"
                    name="duration_label"
                    defaultValue="45 min"
                    placeholder="45 min"
                    className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-secondary/40 text-sm"
                  />
                </div>
              </div>

              {/* Descripción */}
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-on-surface font-medium" htmlFor="srv-desc">
                  Descripción del Servicio
                </label>
                <textarea
                  id="srv-desc"
                  name="description"
                  rows={2}
                  placeholder="Detalla qué incluye la experiencia para el cliente..."
                  className="p-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-secondary/40 text-sm resize-none"
                />
              </div>

              {/* Selección de Icono */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-on-surface font-medium">Icono representativo</label>
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
                <label className="font-label-sm text-on-surface font-medium">Imagen del Servicio</label>
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
                          isSelected ? "border-secondary ring-2 ring-secondary/40" : "border-transparent opacity-70 hover:opacity-100"
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
                  onClick={() => setIsModalOpen(false)}
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
                  <span>{isPending ? "Guardando..." : "Guardar Servicio"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
