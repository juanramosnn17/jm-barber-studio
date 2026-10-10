import type { Metadata } from "next";
import AuthHeader from "@/components/layout/AuthHeader";
import Footer from "@/components/layout/Footer";
import RegisterForm from "@/components/auth/RegisterForm";

export const metadata: Metadata = {
  title: "Crear Cuenta",
  description: "Crea tu cuenta de cliente en JM Barber Studio para reservar tus citas en línea.",
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-background selection:bg-secondary-fixed selection:text-on-secondary-fixed">
      {/* Encabezado con enlace a Login */}
      <AuthHeader
        rightText="¿Ya tienes cuenta?"
        linkText="Iniciar sesión"
        linkHref="/login"
      />

      <main className="flex-1 flex flex-col items-center justify-center w-full px-margin-mobile md:px-margin-tablet lg:px-margin py-space-xl bg-background relative overflow-hidden">
        {/* Resplandores atmosféricos decorativos */}
        <div className="absolute -top-12 -left-12 w-64 h-64 bg-secondary-fixed/30 rounded-full blur-3xl pointer-events-none -z-10"></div>
        <div className="absolute -bottom-16 -right-12 w-72 h-72 bg-secondary-container/20 rounded-full blur-3xl pointer-events-none -z-10"></div>

        <RegisterForm />
      </main>

      <Footer />
    </div>
  );
}
