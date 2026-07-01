import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <h1 className="font-display text-5xl font-bold text-ambar">GastroCore</h1>
        <p className="max-w-md text-base text-salvia-700">
          ERP de costeo de recetas para restaurantes. Controla insumos, recetas,
          food cost y precios sugeridos en un solo lugar.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/login" className="btn-primary">
          Iniciar sesion
        </Link>
        <Link href="/dashboard" className="btn-secondary">
          Ir al dashboard
        </Link>
      </div>
    </main>
  );
}
