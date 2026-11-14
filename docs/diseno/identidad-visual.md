# Identidad visual · JM Barber Studio ("Sartorial Grooming System")

## Tono de voz
Elegante, profesional, masculino y acogedor ("Sartorial Grooming"). Combina distinción de barbería clásica de autor con claridad digital. Tutéa al cliente con calidez y respeto (*"Reserva tu turno en segundos"*, *"Hola, [Nombre] 👋"*), y emplea terminología ejecutiva precisa en el panel administrativo (*"Panel Master"*, *"Flujo de Sillones"*, *"Ganancia Neta"*).

## Paleta de colores (tokens reales de `app/globals.css`)
Basada en **Material Design 3** adaptada a tonos cálidos crema/alabastro, negro carbón y acentos bronce/dorado:

### Fondos y Superficies
- **Fondo principal (`--color-background` / `--color-surface`):** `#FCF9F2` (Crema alabastro cálido)
- **Tarjetas principales (`--color-surface-container-lowest`):** `#FFFFFF` (Blanco puro para alto contraste de tarjetas)
- **Contenedor bajo (`--color-surface-container-low`):** `#F6F3EC`
- **Contenedor medio (`--color-surface-container`):** `#F1EEE7`
- **Contenedor alto / bordes sutiles (`--color-surface-container-high`):** `#EBE8E1`
- **Contenedor máximo (`--color-surface-container-highest`):** `#E5E2DB`
- **Superficie inversa (`--color-inverse-surface`):** `#31312C` (Texto inverso: `#F3F0E9`)

### Textos y Bordes
- **Texto principal (`--color-on-surface` / `--color-on-background`):** `#1C1C18` (Negro cálido profundo — Contraste > 15:1 sobre `#FCF9F2`, cumple WCAG AAA)
- **Texto secundario (`--color-on-surface-variant`):** `#47464B` (Gris carbón — Contraste > 7:1 sobre `#FCF9F2`, cumple WCAG AA/AAA)
- **Bordes (`--color-outline` / `--color-outline-variant`):** `#77767B` / `#C8C5CB`

### Acciones y Acentos de Marca
- **Primario (`--color-primary`):** `#000000` (Negro carbón para botones principales de llamada a la acción, con texto `--color-on-primary` `#FFFFFF` — Contraste 21:1)
- **Contenedor primario (`--color-primary-container`):** `#1B1B1E` (Texto: `#858387`)
- **Secundario / Acento de marca (`--color-secondary`):** `#775A00` (Bronce/Dorado oscuro para precios, etiquetas destacadas e iconos activos, con texto `#FFFFFF`)
- **Dorado iluminado (`--color-secondary-container` / `--color-secondary-fixed`):** `#FECE57` / `#FFDF98` (Variante dim: `#EEC14B`, texto sobre dorado: `#251A00`)
- **Error / Peligro (`--color-error`):** `#BA1A1A` (Texto: `#FFFFFF`, contenedor de alerta: `#FFDAD6`, texto de alerta: `#93000A`)

## Tipografía e Iconografía
- **Fuente principal:** `Plus Jakarta Sans` (Google Fonts, cargada con `next/font/google` en `app/layout.tsx` bajo la variable `--font-jakarta`).
- **Escala tipográfica personalizada (`@theme` en `app/globals.css`):**
  - `display-lg`: `3.5rem` (56px), peso `700`, tracking `-0.03em`.
  - `headline-lg`: `2rem` (32px) en desktop / `1.625rem` (26px) en móvil, peso `600`.
  - `headline-md`: `1.5rem` (24px), peso `600`.
  - `title-lg`: `1.125rem` (18px), peso `600`.
  - `body-lg` (`1.125rem`), `body-md` (`0.9375rem`), `body-sm` (`0.8125rem`), peso `400`.
  - `label-lg` (`0.875rem`), `label-md` (`0.75rem`), `label-sm` (`0.6875rem`), pesos `600–700` con `letter-spacing` amplio para subtítulos en mayúsculas (`uppercase tracking-widest`).
- **Iconografía:** `Material Symbols Outlined` (Google Fonts Icons) con soporte para variante rellena (`.icon-filled`).

## Estilo de componentes y layout
- **Tarjetas y contenedores:** Bordes redondeados amplios (`rounded-2xl` y `rounded-3xl`), fondo blanco (`bg-surface-container-lowest`) sobre lienzo crema (`bg-surface`), bordes sutiles (`border-surface-container-high/60`) y sombras suaves (`shadow-sm` a `shadow-md`).
- **Botones:** Principales tipo píldora (`rounded-full`) en negro (`bg-primary text-on-primary`) con micro-interacciones (`hover:bg-neutral-800`, flechas o iconos en dorado `text-secondary-fixed` que se desplazan al pasar el cursor).
- **Encabezado:** Fijo con desenfoque translúcido (`bg-surface/90 backdrop-blur-xl`).
- **Espaciado y Responsividad:** Diseño *Mobile First* con márgenes adaptativos mediante tokens propios (`px-margin-mobile md:px-margin-tablet lg:px-margin`) y contenedor máximo de `1440px` (`1200px` en hero).
