import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "M Finance",
  description: "Cockpit financeiro pessoal de Matheus Mendes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
