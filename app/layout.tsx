import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Bebas_Neue, Lato } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-title"
});

const lato = Lato({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "Agendamento Multi-Negocio",
  description: "Painel para configurar automacao de agendamento com WhatsApp."
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning>
      <body className={`${lato.variable} ${bebasNeue.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
