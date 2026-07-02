import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GastroCore \u2014 ERP de Costeo de Recetas',
  description:
    'Plataforma de costeo de recetas para restaurantes. Insumos, recetas, food cost y precios sugeridos.',
};

const NAV = [
  { href: '/', label: 'Inicio', icon: '\uD83C\uDFE0' },
  { href: '/insumos', label: 'Insumos', icon: '\uD83D\uDCE6' },
  { href: '/subrecetas', label: 'Subrecetas', icon: '\uD83E\uDD63' },
  { href: '/recetas', label: 'Recetas', icon: '\uD83D\uDCD8' },
  { href: '/recetas/familias', label: 'Familias', icon: '\uD83D\uDDC2\uFE0F' },
  { href: '/recetas/resumen', label: 'Panel', icon: '\uD83D\uDCCA' },
  { href: '/analisis', label: 'An\u00e1lisis', icon: '\uD83D\uDCC8' },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} ${jetbrains.variable}`}>
      <body>
        <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur">
          <nav className="app-shell flex items-center gap-1 py-2 overflow-x-auto">
            <Link href="/" className="mr-2 flex items-center gap-2 font-display text-lg font-bold text-[#1E3A5F]">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1E3A5F] text-sm font-bold text-white">GC</span>
              GastroCore
            </Link>
            <div className="mx-2 h-6 w-px bg-black/10" />
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-[#1E3A5F] hover:bg-[#EFF6FF]"
              >
                <span>{n.icon}</span>
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
