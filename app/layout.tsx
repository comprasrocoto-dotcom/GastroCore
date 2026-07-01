import type { Metadata } from 'next';
import { Inter, Zilla_Slab, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const zilla = Zilla_Slab({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-zilla',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GastroCore — ERP de Costeo de Recetas',
  description:
    'Plataforma de costeo de recetas para restaurantes. Insumos, recetas, food cost y precios sugeridos.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} ${zilla.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
