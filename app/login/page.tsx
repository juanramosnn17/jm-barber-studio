import { Suspense } from "react";
import type { Metadata } from "next";
import AuthHeader from "@/components/layout/AuthHeader";
import Footer from "@/components/layout/Footer";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Iniciar Sesión",
  description: "Accede a tu cuenta de JM Barber Studio para gestionar tus citas.",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-background selection:bg-secondary-fixed selection:text-on-secondary-fixed">
      {/* Encabezado con enlace a Registro */}
      <AuthHeader
        rightText="¿No tienes cuenta?"
        linkText="Regístrate"
        linkHref="/registro"
      />

      <main className="flex-1 flex flex-col items-center justify-center w-full px-margin-mobile md:px-margin-tablet lg:px-margin py-space-xl bg-background relative overflow-hidden">
        {/* Resplandores atmosféricos de fondo (diseño de Google Stitch) */}
        <div className="absolute -top-24 w-96 h-96 bg-secondary-container/20 rounded-full blur-3xl pointer-events-none -z-10"></div>
        <div className="absolute -bottom-16 right-1/4 w-80 h-80 bg-surface-container-high/60 rounded-full blur-2xl pointer-events-none -z-10"></div>

        <Suspense fallback={<div className="text-center p-8 text-on-surface-variant font-label-md">Cargando formulario...</div>}>
          <LoginForm />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
