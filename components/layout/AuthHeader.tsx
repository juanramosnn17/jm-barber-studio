import Link from "next/link";
import BrandLogo from "@/components/ui/BrandLogo";
import { siteConfig } from "@/lib/config";

interface AuthHeaderProps {
  rightText?: string;
  linkText?: string;
  linkHref?: string;
}

export default function AuthHeader({
  rightText = "¿No tienes cuenta?",
  linkText = "Regístrate",
  linkHref = "/registro",
}: AuthHeaderProps) {
  return (
    <header className="w-full bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.03)] z-50">
      <div className="h-20 max-w-[1440px] mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin flex items-center justify-between">
        <Link href="/" className="flex items-center gap-space-sm hover:opacity-90 transition-opacity">
          <BrandLogo className="h-8 w-auto" />
        </Link>
        <div className="flex items-center gap-space-md">
          {rightText && (
            <span className="hidden sm:inline font-body-sm text-on-surface-variant">
              {rightText}
            </span>
          )}
          {linkHref && (
            <Link
              href={linkHref}
              className="inline-flex items-center justify-center font-label-md text-primary hover:text-secondary transition-colors underline-offset-4 hover:underline"
            >
              {linkText}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
