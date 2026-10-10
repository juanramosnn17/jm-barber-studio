/**
 * Componente SVG del Logotipo de JM Barber Studio.
 * Diseñado a partir del vector extraído de Google Stitch.
 */
export default function BrandLogo({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 160 40"
      className={className}
      fill="none"
      aria-label="JM Barber Studio Logo"
    >
      {/* CAMBIAR COLOR/ESTILO AQUÍ: Color de fondo del recuadro del isotipo */}
      <rect x="2" y="4" width="32" height="32" rx="8" fill="#18181B" />
      {/* Tijeras / X en dorado */}
      <path d="M12 12L20 28M24 12L16 28" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="18" cy="20" r="2" fill="#D4AF37" />
      {/* Textos del Logo */}
      <text
        x="44"
        y="22"
        fontFamily="var(--font-sans), sans-serif"
        fontSize="15"
        fontWeight="800"
        letterSpacing="1.5"
        fill="#18181B"
      >
        JM BARBER
      </text>
      <text
        x="44"
        y="32"
        fontFamily="var(--font-sans), sans-serif"
        fontSize="9"
        fontWeight="600"
        letterSpacing="3"
        fill="#8C7E6A"
      >
        STUDIO
      </text>
    </svg>
  );
}
