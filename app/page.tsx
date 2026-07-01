import Link from 'next/link';

export default function Home() {
  const secciones = [
    { href: '/insumos', titulo: 'Insumos', desc: 'Catalogo maestro de insumos con costos en vivo.' },
    { href: '/recetas', titulo: 'Recetas', desc: 'Crea y costea recetas con food cost automatico.' },
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <div className="space-y-3">
        <h1 className="font-display text-5xl font-bold text-ambar-700">GastroCore</h1>
        <p className="mx-auto max-w-md text-base text-salvia-700">
          ERP de costeo de recetas para restaurantes. Controla insumos, recetas,
          food cost y precios sugeridos en un solo lugar.
        </p>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2">
        {secciones.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group rounded-xl border border-salvia-100 bg-white p-6 text-left shadow-sm transition-all hover:border-ambar-300 hover:shadow-md"
          >
            <h2 className="font-display text-xl font-semibold text-ambar-700 group-hover:text-ambar-600">
              {s.titulo}
            </h2>
            <p className="mt-1 text-sm text-salvia-600">{s.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
