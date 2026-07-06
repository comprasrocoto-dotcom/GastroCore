'use client';

/**
 * Galería pública del recetario — hereda la organización del Recetario Malanga:
 * sidebar de categorías, buscador, tarjetas con foto (recorte object-cover) y
 * costo/precio visibles (decisión del negocio, igual al recetario original).
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { RecetaPublica } from '@/lib/recetario';
import { cop, fotoConAncho } from '@/lib/recetario';

export default function RecetarioGaleria({ recetas }: { recetas: RecetaPublica[] }) {
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<string>('TODAS');

  const categorias = useMemo(() => {
    const set = new Map<string, number>();
    recetas.forEach((r) => set.set(r.categoria, (set.get(r.categoria) || 0) + 1));
    return Array.from(set.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [recetas]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return recetas.filter((r) => {
      if (categoria !== 'TODAS' && r.categoria !== categoria) return false;
      if (!q) return true;
      return (
        r.nombre.toLowerCase().includes(q) ||
        r.ficha.descripcion.toLowerCase().includes(q) ||
        r.ingredientes.some((i) => i.nombre.toLowerCase().includes(q))
      );
    });
  }, [recetas, busqueda, categoria]);

  return (
    <main className="min-h-screen bg-[#FAF7F0] text-[#25301F]">
      {/* Cabecera */}
      <header className="sticky top-0 z-10 border-b border-[#E5DFD2] bg-[#FAF7F0]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌿</span>
            <div>
              <h1 className="font-display text-lg font-bold leading-tight text-[#2B4D2E]">
                Recetario Malanga
              </h1>
              <p className="text-[11px] text-[#8A957F]">
                {recetas.length} recetas · actualizado en vivo desde la Base de Costos
              </p>
            </div>
          </div>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar receta o ingrediente…"
            className="ml-auto w-full max-w-xs rounded-full border border-[#D8D1BF] bg-white px-4 py-2 text-sm outline-none focus:border-[#2B4D2E] sm:w-64"
          />
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        {/* Sidebar de categorías (en móvil se vuelve una fila con scroll) */}
        <nav className="flex w-full gap-2 overflow-x-auto pb-2 md:block md:w-48 md:min-w-48 md:overflow-visible md:pb-0">
          <BotonCategoria
            activa={categoria === 'TODAS'}
            onClick={() => setCategoria('TODAS')}
            etiqueta="Toda la carta"
            n={recetas.length}
          />
          {categorias.map(([cat, n]) => (
            <BotonCategoria
              key={cat}
              activa={categoria === cat}
              onClick={() => setCategoria(cat)}
              etiqueta={cat}
              n={n}
            />
          ))}
        </nav>

        {/* Cuadrícula de tarjetas */}
        <section className="flex-1">
          {visibles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D8D1BF] bg-white p-10 text-center text-sm text-[#8A957F]">
              No hay recetas que coincidan con la búsqueda.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibles.map((r) => (
                <Link
                  key={r.id}
                  href={`/recetario/${r.id}`}
                  className="group overflow-hidden rounded-xl border border-[#E5DFD2] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  {/* Miniatura: recorte a propósito (object-cover) para uniformar la galería */}
                  <div className="flex h-40 items-center justify-center overflow-hidden bg-[#EFEAD9]">
                    {r.ficha.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={fotoConAncho(r.ficha.foto_url, 600)}
                        alt={r.nombre}
                        loading="lazy"
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-[#8A957F]">
                        <span className="text-3xl">🍽️</span>
                        <span className="text-[11px]">{r.categoria}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#B0552F]">
                      {r.categoria}
                    </p>
                    <h2 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">
                      {r.nombre}
                    </h2>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-[#6B7A6B]">Costo {cop(r.costo_porcion)}</span>
                      <span className="font-bold text-[#2B4D2E]">{cop(r.precio_real)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function BotonCategoria({
  activa,
  onClick,
  etiqueta,
  n,
}: {
  activa: boolean;
  onClick: () => void;
  etiqueta: string;
  n: number;
}) {
  return (
    <button
      onClick={onClick}
      className={
        'flex w-auto shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition md:mb-1 md:w-full ' +
        (activa
          ? 'bg-[#2B4D2E] text-white'
          : 'bg-white text-[#4A5443] hover:bg-[#EFEAD9] border border-[#E5DFD2]')
      }
    >
      <span className="truncate">{etiqueta}</span>
      <span className={activa ? 'text-white/70' : 'text-[#8A957F]'}>{n}</span>
    </button>
  );
}
