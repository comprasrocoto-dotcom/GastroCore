import Link from 'next/link';

export default function Home() {
  const secciones = [
    { href: '/insumos', titulo: 'Insumos', desc: 'Catalogo maestro de materias primas con costos en vivo, edicion de precios y trazabilidad.', icon: '\uD83D\uDCE6' },
    { href: '/subrecetas', titulo: 'Subrecetas', desc: 'Preparaciones base (salsas, fondos, masas) que se costean y se usan como ingredientes.', icon: '\uD83E\uDD63' },
    { href: '/recetas', titulo: 'Recetas', desc: 'Crea y costea recetas finales con food cost automatico y precio sugerido.', icon: '\uD83D\uDCD8' },
    { href: '/recetas/familias', titulo: 'Familias', desc: 'Organiza tus insumos, subrecetas y recetas por familia y subfamilia.', icon: '\uD83D\uDDC2\uFE0F' },
    { href: '/recetas/resumen', titulo: 'Panel Ejecutivo', desc: 'Indicadores clave: food cost promedio, recetas fuera de objetivo y rentabilidad.', icon: '\uD83D\uDCCA' },
    { href: '/analisis', titulo: 'An\u00e1lisis de Costos', desc: 'Inteligencia de negocios: variaci\u00f3n de precios, impacto en el men\u00fa, alertas y simulaci\u00f3n.', icon: '\uD83D\uDCC8' },
  ];

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-5xl flex-col items-center justify-center gap-12 px-6 py-16 text-center">
      <div className="space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1E3A5F] text-2xl font-bold text-white shadow-card">GC</div>
        <h1 className="font-display text-5xl font-bold tracking-tight text-[#1E3A5F]">GastroCore</h1>
        <p className="mx-auto max-w-xl text-base text-muted">
          ERP de costeo para restaurantes en tres niveles: Insumos, Subrecetas y Recetas finales.
          Cualquier cambio de costo se propaga automaticamente en tiempo real.
        </p>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {secciones.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="card card-hover group p-6 text-left"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EFF6FF] text-lg">{s.icon}</span>
            <h2 className="mt-3 font-display text-xl font-semibold text-[#1E3A5F]">
              {s.titulo}
            </h2>
            <p className="mt-1 text-sm text-muted">{s.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
