import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMarcasPublicas } from '@/lib/recetarioMarca';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Recetario', description: 'Recetarios de cocina' };

/**
 * Portada del recetario público (Fase 6).
 *
 * Con UNA sola marca activa —la situación de hoy, solo Rocoto— redirige
 * directo a ella. Eso es deliberado: la cocina tiene /recetario guardado en
 * los teléfonos y no tiene por qué aprender una URL nueva ni elegir de una
 * lista de un solo elemento. El selector aparece solo cuando de verdad haya
 * algo que seleccionar.
 */
export default async function RecetarioIndexPage() {
  const marcas = await getMarcasPublicas().catch(() => []);

  if (marcas.length === 1) redirect('/recetario/' + marcas[0].slug);

  if (!marcas.length) {
    return (
      <main
        className="flex min-h-screen items-center justify-center px-6 text-center"
        style={{ background: '#F6F1E6' }}
      >
        <div>
          <div className="mb-3 text-4xl">🌿</div>
          <h1 className="mb-2 text-xl font-bold" style={{ color: '#1E3B2C' }}>
            No hay recetarios disponibles
          </h1>
          <p className="text-sm text-neutral-500">
            No se pudo cargar la lista de marcas. Intenta de nuevo en unos minutos.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-16" style={{ background: '#F6F1E6' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,500&display=swap"
      />
      <div className="mx-auto max-w-lg">
        <h1
          className="mb-8 text-center text-3xl font-bold"
          style={{ color: '#1E3B2C', fontFamily: '"Playfair Display", serif' }}
        >
          Recetarios
        </h1>
        <ul className="space-y-3">
          {marcas.map((m) => (
            <li key={m.slug}>
              <Link
                href={'/recetario/' + m.slug}
                className="block rounded-xl border bg-white px-5 py-4 text-lg font-semibold shadow-sm transition hover:shadow-md"
                style={{ color: '#1E3B2C', borderColor: '#DDD4C0' }}
              >
                {m.nombre}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
