import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRecetaPublica } from '@/lib/recetario';
import { DetalleReceta } from '@/components/RecetarioGaleria';

export const metadata = { title: 'Receta · Malanga' };

/**
 * Detalle público por URL directa (/recetario/REC-000011).
 * En la galería el detalle se abre como MODAL; esta página existe para los
 * enlaces directos — en especial el botón "👁 Ver como cocina" del admin — y
 * reutiliza EXACTAMENTE el mismo componente del modal (cabecera verde,
 * ingredientes sin costos, pasos numerados).
 */
export default async function RecetaPublicaPage({ params }: { params: { id: string } }) {
  const receta = await getRecetaPublica(params.id).catch(() => null);
  if (!receta) notFound();

  return (
    <main className="min-h-screen px-3 py-6 sm:px-6" style={{ background: '#FBF0EE' }}>
      <div className="mx-auto max-w-2xl">
        <Link
          href="/recetario"
          className="mb-3 inline-block rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-xs font-semibold shadow-sm hover:bg-neutral-50"
          style={{ color: '#2F5233' }}
        >
          ← Volver al recetario
        </Link>
        <DetalleReceta r={receta} />
      </div>
    </main>
  );
}
