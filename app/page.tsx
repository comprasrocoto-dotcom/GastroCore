import Link from 'next/link';

export default function Home() {
  const secciones = [
    { href: '/insumos', titulo: 'Insumos', desc: 'Catalogo maestro de insumos con costos en vivo.', icon: '\uD83D\uDCE6' },
    { href: '/recetas', titulo: 'Recetas', desc: 'Crea y costea recetas con food cost automatico.', icon: '\uD83D\uDCD8' },
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-12 px-6 py-16 text-center">
      <div className="space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1E3A5F] text-2xl font-bold text-white shadow-card">GC</div>
        <h1 className="font-display text-5xl font-bold tracking-tight text-[#1E3A5F]">GastroCore</h1>
        <p className="mx-auto max-w-md text-base text-muted">
          ERP de costeo de recetas para restaurantes. Controla insumos, recetas,
          food cost y precios sugeridos en un solo lugar.
        </p>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2">
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
