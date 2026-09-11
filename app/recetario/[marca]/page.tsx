import { notFound, redirect } from 'next/navigation';
import { getRecetarioMarca, getMarcaPublica } from '@/lib/recetarioMarca';
import { temaPorId } from '@/lib/temasRecetario';
import RecetarioGaleria from '@/components/RecetarioGaleria';

// Render por petición: los datos siguen cacheados 5 min por etiquetas, pero al
// purgarse (guardar foto, ficha o estilo) el cambio se ve en el PRIMER refresco.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { marca: string } }) {
  const marca = await getMarcaPublica(params.marca).catch(() => null);
  const nombre = marca?.nombre || 'GastroCore';
  return { title: 'Recetario · ' + nombre, description: 'Recetario de cocina de ' + nombre };
}

/**
 * Recetario público de UNA marca (Fase 6).
 *
 * Página sin login (ver middleware). Los datos llegan de las vistas
 * `recetario_publico*`, que no traen costos ni precios: el navegador de la
 * cocina no puede ver la rentabilidad de la carta ni aunque inspeccione la
 * respuesta.
 */
export default async function RecetarioMarcaPage({ params }: { params: { marca: string } }) {
  const slug = params.marca;

  // Compatibilidad con los enlaces viejos: hasta la Fase 6 el detalle vivía en
  // /recetario/REC-000011. Esos enlaces están impresos en fichas y guardados en
  // los teléfonos de la cocina, así que en vez de darles 404 se redirigen al
  // detalle equivalente dentro de la marca por defecto.
  if (/^(REC|SUB)-/i.test(slug)) {
    redirect('/recetario/' + (process.env.GASTROCORE_MARCA || 'rocoto') + '/' + slug);
  }

  const marca = await getMarcaPublica(slug).catch(() => null);
  if (!marca) notFound();

  const tema = temaPorId(marca.tema);

  let recetas;
  try {
    recetas = await getRecetarioMarca(slug);
  } catch {
    return (
      <main
        className="flex min-h-screen items-center justify-center px-6 text-center"
        style={{ background: '#F6F1E6' }}
      >
        <div>
          <div className="mb-3 text-4xl">🌿</div>
          <h1 className="mb-2 text-xl font-bold" style={{ color: '#1E3B2C' }}>
            El recetario no está disponible
          </h1>
          <p className="text-sm text-neutral-500">
            No se pudo cargar la información de {marca.nombre}. Intenta de nuevo en unos minutos.
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,500&display=swap"
      />
      <RecetarioGaleria tema={tema} recetas={recetas} nombreNegocio={marca.nombre} />
    </>
  );
}
