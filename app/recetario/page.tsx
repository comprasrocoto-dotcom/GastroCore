import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRecetaPublica, cop, fotoConAncho } from '@/lib/recetario';

export const metadata = { title: 'Receta · Malanga' };

/** Convierte un texto multilínea en una lista de líneas no vacías. */
function lineas(texto: string): string[] {
  return String(texto || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export default async function RecetaPublicaPage({ params }: { params: { id: string } }) {
  const receta = await getRecetaPublica(params.id).catch(() => null);
  if (!receta) notFound();

  const prep = lineas(receta.ficha.preparacion);
  const empl = lineas(receta.ficha.emplatado);

  return (
    <main className="min-h-screen bg-[#FAF7F0] text-[#25301F]">
      <header className="border-b border-[#E5DFD2] bg-[#FAF7F0]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            href="/recetario"
            className="rounded-full border border-[#D8D1BF] bg-white px-3 py-1.5 text-xs font-medium text-[#2B4D2E] hover:bg-[#EFEAD9]"
          >
            ← Recetario
          </Link>
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#B0552F]">
            {receta.categoria}
          </span>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-2xl font-bold text-[#2B4D2E]">{receta.nombre}</h1>
        {receta.ficha.descripcion && (
          <p className="mt-1.5 text-sm leading-relaxed text-[#4A5443]">{receta.ficha.descripcion}</p>
        )}

        {/* FOTO: comportamiento universal heredado del Recetario Malanga —
            la imagen se ve COMPLETA en su proporción natural, limitada solo
            por el ancho del contenedor y ~60% de la pantalla. Se adapta a
            cualquier resolución (vertical, horizontal, cuadrada). */}
        {receta.ficha.foto_url && (
          <div className="mt-5 flex w-full items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fotoConAncho(receta.ficha.foto_url, 1200)}
              alt={receta.nombre}
              className="block h-auto w-auto rounded-xl"
              style={{ maxWidth: '100%', maxHeight: 'min(60vh, 560px)' }}
            />
          </div>
        )}

        {/* Datos rápidos */}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Dato etiqueta="Costo plato" valor={cop(receta.costo_porcion)} />
          <Dato etiqueta="Precio venta" valor={cop(receta.precio_real)} destacado />
          {receta.ficha.tiempo_min ? (
            <Dato etiqueta="Tiempo" valor={`${receta.ficha.tiempo_min} min`} />
          ) : (
            <Dato etiqueta="Food cost" valor={`${((receta.food_cost || 0) * 100).toFixed(1)}%`} />
          )}
          {receta.ficha.gramaje_porcion ? (
            <Dato etiqueta="Gramaje" valor={String(receta.ficha.gramaje_porcion)} />
          ) : (
            <Dato etiqueta="Rendimiento" valor={`${receta.rendimiento} porción(es)`} />
          )}
        </div>

        {/* Ingredientes */}
        <section className="mt-7">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#B0552F]">
            Ingredientes
          </h2>
          <div className="overflow-hidden rounded-xl border border-[#E5DFD2] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5DFD2] bg-[#F4F0E4] text-left text-[11px] uppercase tracking-wide text-[#6B7A6B]">
                  <th className="px-3 py-2 font-semibold">Ingrediente</th>
                  <th className="px-3 py-2 text-right font-semibold">Cant.</th>
                  <th className="px-3 py-2 font-semibold">Und</th>
                  <th className="px-3 py-2 text-right font-semibold">Costo</th>
                </tr>
              </thead>
              <tbody>
                {receta.ingredientes.map((ing, i) => (
                  <tr key={i} className="border-b border-[#F0EBDD] last:border-0">
                    <td className="px-3 py-2">{ing.nombre}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{ing.cantidad}</td>
                    <td className="px-3 py-2 text-[#6B7A6B]">{ing.unidad}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{cop(ing.costo_linea)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#F4F0E4] font-semibold">
                  <td className="px-3 py-2" colSpan={3}>
                    Costo total receta
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#2B4D2E]">
                    {cop(receta.costo_total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* Preparación */}
        <Pasos titulo="Preparación" items={prep} vacio="La preparación aún no ha sido registrada." />

        {/* Emplatado */}
        <Pasos titulo="Emplatado" items={empl} vacio="" />

        {receta.ficha.notas && (
          <section className="mt-7 rounded-xl border border-[#E9D9A8] bg-[#FBF6E3] p-4">
            <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[#8A6D1D]">
              Notas
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-[#4A5443]">
              {receta.ficha.notas}
            </p>
          </section>
        )}
      </article>
    </main>
  );
}

function Dato({ etiqueta, valor, destacado }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <div className="rounded-xl border border-[#E5DFD2] bg-white px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-[#8A957F]">{etiqueta}</p>
      <p className={'mt-0.5 text-sm font-bold tabular-nums ' + (destacado ? 'text-[#2B4D2E]' : '')}>
        {valor}
      </p>
    </div>
  );
}

function Pasos({ titulo, items, vacio }: { titulo: string; items: string[]; vacio: string }) {
  if (items.length === 0 && !vacio) return null;
  return (
    <section className="mt-7">
      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#B0552F]">{titulo}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-[#8A957F]">{vacio}</p>
      ) : (
        <ol className="space-y-2">
          {items.map((paso, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-xl border border-[#E5DFD2] bg-white px-4 py-3 text-sm leading-relaxed"
            >
              <span className="whitespace-pre-line">{paso}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
