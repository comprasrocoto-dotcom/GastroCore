import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRecetaPublica } from '@/lib/recetario';
import { DetalleReceta } from '@/components/RecetarioGaleria';

export const metadata = { title: 'Receta · Rocoto Cocina Peruana' };

/**
 * Detalle público por URL directa (/recetario/REC-000011).
 * En la galería el detalle se abre como MODAL; esta página existe para los
 * enlaces directos — en especial el botón "👁 Ver como cocina" del admin — y
 * reutiliza EXACTAMENTE el mismo componente del modal con el tema Rocoto.
 */
export default async function RecetaPublicaPage({ params }: { params: { id: string } }) {
  const receta = await getRecetaPublica(params.id).catch(() => null);
  if (!receta) notFound();

  return (
    <main className="min-h-screen px-3 py-6 sm:px-6" style={{ background: '#F6F1E6' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,500&display=swap"
      />
      <div className="mx-auto max-w-2xl">
        <Link
          href="/recetario"
          className="mb-3 inline-block rounded-full border bg-white px-4 py-1.5 text-xs font-semibold shadow-sm hover:bg-neutral-50"
          style={{ color: '#1E3B2C', borderColor: '#DDD4C0' }}
        >
          ← Volver al recetario
        </Link>
        <DetalleReceta r={receta} />
      </div>
    </main>
  );
}
