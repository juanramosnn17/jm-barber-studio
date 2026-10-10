import BrandLogo from "@/components/ui/BrandLogo";
import { siteConfig } from "@/lib/config";

export default function Footer() {
  return (
    <footer className="w-full bg-surface-container-low/60 py-space-lg border-t border-surface-container-high/40 mt-auto">
      <div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin flex flex-col items-center justify-center gap-space-xs text-center">
        <BrandLogo className="h-6 w-auto opacity-80" />
        <p className="font-label-sm text-on-surface-variant tracking-wider uppercase mt-space-xs">
          {siteConfig.name} © {siteConfig.copyrightYear} Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
