import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Bebas_Neue } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-title"
});

export const metadata: Metadata = {
  title: "Agendamento Multi-Negócio",
  description: "Painel para configurar automação de agendamento com WhatsApp."
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning>
      <body className={`${GeistSans.className} ${GeistSans.variable} ${bebasNeue.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
