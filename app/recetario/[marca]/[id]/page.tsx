import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRecetaPublicaMarca, getMarcaPublica } from '@/lib/recetarioMarca';
import { temaPorId } from '@/lib/temasRecetario';
import { DetalleReceta } from '@/components/RecetarioGaleria';

// Render por petición: los datos siguen cacheados 5 min por etiquetas, pero al
// purgarse (guardar foto, ficha o estilo) el cambio se ve en el PRIMER refresco.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { marca: string } }) {
  const marca = await getMarcaPublica(params.marca).catch(() => null);
  return { title: 'Receta · ' + (marca?.nombre || 'GastroCore') };
}

/**
 * Detalle público por URL directa (/recetario/rocoto/REC-000011).
 *
 * En la galería el detalle se abre como MODAL; esta página existe para los
 * enlaces directos — en especial el botón "👁 Ver como cocina" del admin — y
 * reutiliza EXACTAMENTE el mismo componente del modal.
 *
 * La receta se busca SIEMPRE dentro de la marca de la URL: pedir
 * /recetario/malanga/REC-000011 cuando esa receta es de Rocoto da 404, no la
 * receta de otra marca. Ese es el aislamiento de la Fase 6.
 */
export default async function RecetaPublicaPage({
  params,
}: {
  params: { marca: string; id: string };
}) {
  const receta = await getRecetaPublicaMarca(params.marca, params.id).catch(() => null);
  if (!receta) notFound();

  const marca = await getMarcaPublica(params.marca).catch(() => null);
  const tema = temaPorId(marca?.tema || 'rocoto');

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
          href={'/recetario/' + params.marca}
          className="mb-3 inline-block rounded-full border bg-white px-4 py-1.5 text-xs font-semibold shadow-sm hover:bg-neutral-50"
          style={{ color: '#1E3B2C', borderColor: '#DDD4C0' }}
        >
          ← Volver al recetario
        </Link>
        <DetalleReceta tema={tema} r={receta} />
      </div>
    </main>
  );
}
