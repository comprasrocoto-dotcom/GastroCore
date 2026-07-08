'use client';

/**
 * Recetario público — réplica visual del Recetario Malanga original:
 *  - Tarjetas con foto (recorte) o placeholder rosado con hojita 🌿 y categoría.
 *  - Pie de tarjeta: "N ingredientes" / "N pasos".
 *  - Toggle cuadrícula / lista (esquina superior derecha).
 *  - Al hacer clic se abre un MODAL con cabecera verde: ingredientes
 *    (Artículo / Unidad de Medida / Cantidad), PREPARACIÓN y EMPLATADO con
 *    pasos numerados en círculos verdes. SIN costos ni precios.
 */
import { useEffect, useMemo, useState } from 'react';
import type { RecetaPublica } from '@/lib/recetario';
import { fotoConAncho } from '@/lib/recetario';

/* ══ TOKENS DE MARCA ROCOTO ══════════════════════════════════════════════
   Paleta tomada de rocotorestaurante.com: verde botella del header (logo
   blanco sobre verde), crema natural de fondo, y rojo rocoto como acento.
   Si algún hex difiere del manual de marca oficial, se ajusta SOLO aquí. */
const VERDE = '#1E3B2C';        // verde botella Rocoto (cabeceras, botones)
const VERDE_HOJA = '#41654A';   // verde secundario (hovers, detalles)
const CREMA = '#F6F1E6';        // fondo general crema natural
const ROSA = '#EDE6D3';         // placeholder de tarjetas sin foto
const ROJO = '#B93A2B';         // rojo rocoto (categorías y títulos de sección)
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif"; // display del sitio

/** Divide un texto multilínea en pasos no vacíos. */
function pasos(texto: string): string[] {
  return String(texto || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export default function RecetarioGaleria({ recetas }: { recetas: RecetaPublica[] }) {
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<string>('TODAS');
  const [modo, setModo] = useState<'grid' | 'list'>('grid');
  const [abierta, setAbierta] = useState<RecetaPublica | null>(null);

  const categorias = useMemo(() => {
    const m = new Map<string, number>();
    recetas.forEach((r) => m.set(r.categoria, (m.get(r.categoria) || 0) + 1));
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [recetas]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return recetas.filter((r) => {
      if (categoria !== 'TODAS' && r.categoria !== categoria) return false;
      if (!q) return true;
      return (
        r.nombre.toLowerCase().includes(q) ||
        r.ingredientes.some((i) => i.nombre.toLowerCase().includes(q))
      );
    });
  }, [recetas, busqueda, categoria]);

  // Cerrar el modal con Escape.
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && setAbierta(null);
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  // Bloquear el scroll del fondo mientras el modal está abierto.
  useEffect(() => {
    document.body.style.overflow = abierta ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [abierta]);

  const titulo =
    categoria === 'TODAS' ? 'Recetario' : categoria.charAt(0) + categoria.slice(1).toLowerCase();

  return (
    <main className="min-h-screen" style={{ background: CREMA, color: '#26291F' }}>
      {/* Barra de marca: verde botella con el nombre en blanco, eco del header del sitio */}
      <div className="w-full px-4 py-3 text-center" style={{ background: VERDE }}>
        <p className="text-lg font-bold tracking-wide text-white" style={{ fontFamily: SERIF }}>
          Rocoto <span className="mx-1.5 font-normal text-white/50">·</span>
          <span className="font-normal italic text-white/90">Recetario de Cocina</span>
        </p>
      </div>
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        {/* Sidebar de categorías */}
        <nav className="hidden w-52 min-w-52 md:block">
          <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: ROJO }}>
            Secciones
          </p>
          <CategoriaBtn activa={categoria === 'TODAS'} onClick={() => setCategoria('TODAS')} nombre="Todas" n={recetas.length} />
          {categorias.map(([cat, n]) => (
            <CategoriaBtn key={cat} activa={categoria === cat} onClick={() => setCategoria(cat)} nombre={cat} n={n} />
          ))}
        </nav>

        {/* Contenido */}
        <section className="min-w-0 flex-1">
          {/* Cabecera: título + contador + toggle */}
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: SERIF, color: VERDE }}>
                {titulo}
              </h1>
              <p className="mt-0.5 text-sm text-neutral-500">{visibles.length} recetas</p>
            </div>
            <div className="flex gap-1.5 pt-1">
              <ToggleBtn activo={modo === 'grid'} onClick={() => setModo('grid')} title="Cuadrícula">▦</ToggleBtn>
              <ToggleBtn activo={modo === 'list'} onClick={() => setModo('list')} title="Lista">☰</ToggleBtn>
            </div>
          </div>

          {/* Selector de categoría en móvil */}
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
            <ChipCat activa={categoria === 'TODAS'} onClick={() => setCategoria('TODAS')} nombre="Todas" />
            {categorias.map(([cat]) => (
              <ChipCat key={cat} activa={categoria === cat} onClick={() => setCategoria(cat)} nombre={cat} />
            ))}
          </div>

          {/* Buscador */}
          <div className="mb-5 flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 shadow-sm" style={{ borderColor: '#DDD4C0' }}>
            <span>🔍</span>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar receta o ingrediente..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
            />
          </div>

          {/* Tarjetas */}
          {visibles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center text-sm text-neutral-400">
              No hay recetas que coincidan con la búsqueda.
            </div>
          ) : (
            <div className={modo === 'grid' ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5' : 'flex flex-col gap-3'}>
              {visibles.map((r) => (
                <Tarjeta key={r.id} r={r} modo={modo} onOpen={() => setAbierta(r)} />
              ))}
            </div>
          )}
        </section>
      </div>

      {abierta && <ModalReceta r={abierta} onClose={() => setAbierta(null)} />}
    </main>
  );
}

/* ============================ TARJETA ==================================== */
function Tarjeta({ r, modo, onOpen }: { r: RecetaPublica; modo: 'grid' | 'list'; onOpen: () => void }) {
  const nIng = r.ingredientes.length;
  const nPasos = pasos(r.ficha.preparacion).length + pasos(r.ficha.emplatado).length;
  const horizontal = modo === 'list';

  return (
    <button
      onClick={onOpen}
      className={
        'group overflow-hidden rounded-xl border border-neutral-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ' +
        (horizontal ? 'flex items-stretch' : '')
      }
    >
      {/* Miniatura: recorte a propósito (object-cover) para uniformar la galería */}
      <div
        className={
          'flex items-center justify-center overflow-hidden ' +
          (horizontal ? 'h-24 w-28 min-w-28' : 'h-40 w-full')
        }
        style={{ background: ROSA }}
      >
        {r.ficha.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fotoConAncho(r.ficha.foto_url, 600)}
            alt={r.nombre}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-neutral-500">
            <span className="text-3xl">🌿</span>
            {!horizontal && (
              <span className="text-[10px] font-medium uppercase tracking-wide">{r.categoria}</span>
            )}
          </div>
        )}
      </div>

      <div className={'flex min-w-0 flex-1 flex-col ' + (horizontal ? 'px-4 py-2.5' : 'p-3.5')}>
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ROJO }}>
          {r.categoria}
        </p>
        <h2 className="mt-0.5 line-clamp-2 text-sm font-semibold uppercase leading-snug">{r.nombre}</h2>
        <div className="mt-auto flex items-center justify-between border-t border-neutral-100 pt-2 text-[11px] text-neutral-500">
          <span>{nIng} ingredientes</span>
          {nPasos > 0 && <span className="font-semibold">{nPasos} pasos</span>}
        </div>
      </div>
    </button>
  );
}

/* ============================ MODAL ====================================== */
export function DetalleReceta({ r, onClose }: { r: RecetaPublica; onClose?: () => void }) {
  const prep = pasos(r.ficha.preparacion);
  const empl = pasos(r.ficha.emplatado);

  return (
    <div
      className="flex w-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
      // En modal (onClose presente) la altura se limita contra el VIEWPORT
      // (88vh) — max-h-full en cadena no aplica cuando el padre no tiene
      // altura fija, que era el bug que dejaba el panel sin scroll.
      style={onClose ? { maxHeight: '88vh' } : undefined}
    >
      {/* Cabecera verde */}
      <div className="flex shrink-0 items-start justify-between gap-4 px-6 py-4" style={{ background: VERDE }}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">{r.categoria}</p>
          <h2 className="mt-0.5 text-2xl font-bold leading-tight text-white" style={{ fontFamily: SERIF }}>
            {r.nombre}
          </h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >
            ✕
          </button>
        )}
      </div>

      {/* Cuerpo */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto bg-white px-6 py-5">
        {/* FOTO: se ve COMPLETA en su proporción natural, adaptándose a
            cualquier resolución (tope ~60% de pantalla / 560px). */}
        {r.ficha.foto_url && (
          <div className="flex w-full items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fotoConAncho(r.ficha.foto_url, 1200)}
              alt={r.nombre}
              className="block h-auto w-auto rounded-lg"
              style={{ maxWidth: '100%', maxHeight: 'min(60vh, 560px)' }}
            />
          </div>
        )}

        {/* Ingredientes: Artículo / Unidad de Medida / Cantidad (sin costos) */}
        <section>
          <TituloSeccion>Ingredientes</TituloSeccion>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                <th className="py-2 pr-2 font-semibold">Artículo</th>
                <th className="py-2 pr-2 font-semibold">Unidad de Medida</th>
                <th className="py-2 text-right font-semibold">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {r.ingredientes.map((ing, i) => (
                <tr key={i} className="border-b border-neutral-100 last:border-0">
                  <td className="py-2 pr-2 font-medium uppercase">{ing.nombre}</td>
                  <td className="py-2 pr-2 text-neutral-500">{abreviarUnidad(ing.unidad)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums" style={{ color: VERDE_HOJA }}>
                    {ing.cantidad}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {prep.length > 0 && <Pasos titulo="Preparación" items={prep} />}
        {empl.length > 0 && <Pasos titulo="Emplatado" items={empl} />}

        {/* Datos operativos: solo aparecen cuando tienen información registrada */}
        {(r.ficha.tiempo_min || r.ficha.gramaje_porcion) && (
          <section className="flex flex-wrap gap-3">
            {r.ficha.tiempo_min ? (
              <DatoOperativo etiqueta="Tiempo de preparación" valor={`${r.ficha.tiempo_min} min`} />
            ) : null}
            {r.ficha.gramaje_porcion ? (
              <DatoOperativo etiqueta="Gramaje por porción" valor={String(r.ficha.gramaje_porcion)} />
            ) : null}
          </section>
        )}

        {r.ficha.notas && (
          <section>
            <TituloSeccion>Notas</TituloSeccion>
            <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-600">{r.ficha.notas}</p>
          </section>
        )}
      </div>
    </div>
  );
}

function ModalReceta({ r, onClose }: { r: RecetaPublica; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      onClick={onClose}
    >
      <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <DetalleReceta r={r} onClose={onClose} />
      </div>
    </div>
  );
}

/* ============================ PIEZAS ===================================== */
function TituloSeccion({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: ROJO }}>
      {children}
    </h3>
  );
}

function Pasos({ titulo, items }: { titulo: string; items: string[] }) {
  return (
    <section>
      <TituloSeccion>{titulo}</TituloSeccion>
      <ol className="space-y-2.5">
        {items.map((paso, i) => (
          <li key={i} className="flex items-start gap-3 text-sm leading-relaxed">
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ background: VERDE }}
            >
              {i + 1}
            </span>
            <span style={{ color: '#3B4034' }}>{paso}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DatoOperativo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2">
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: VERDE }}>
        {etiqueta}
      </p>
      <p className="mt-0.5 text-sm font-semibold">{valor}</p>
    </div>
  );
}

function abreviarUnidad(u: string): string {
  const s = String(u || '').toUpperCase();
  if (s === 'GRAMOS') return 'g';
  if (s === 'UNIDADES') return 'uds';
  if (s === 'ONZA') return 'oz';
  if (s === 'COPA') return 'copa';
  return u || '';
}

function CategoriaBtn({ activa, onClick, nombre, n }: { activa: boolean; onClick: () => void; nombre: string; n: number }) {
  return (
    <button
      onClick={onClick}
      className={
        'mb-1 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition ' +
        (activa ? 'text-white' : 'bg-white text-neutral-600 hover:bg-neutral-50 border border-neutral-200')
      }
      style={activa ? { background: VERDE } : undefined}
    >
      <span className="truncate uppercase">{nombre}</span>
      <span className={activa ? 'text-white/70' : 'text-neutral-400'}>{n}</span>
    </button>
  );
}

function ChipCat({ activa, onClick, nombre }: { activa: boolean; onClick: () => void; nombre: string }) {
  return (
    <button
      onClick={onClick}
      className={
        'shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase transition ' +
        (activa ? 'text-white' : 'bg-white text-neutral-600 border border-neutral-200')
      }
      style={activa ? { background: VERDE } : undefined}
    >
      {nombre}
    </button>
  );
}

function ToggleBtn({ activo, onClick, title, children }: { activo: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={
        'flex h-9 w-9 items-center justify-center rounded-lg border text-base transition ' +
        (activo ? 'border-transparent text-white' : 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50')
      }
      style={activo ? { background: VERDE } : undefined}
    >
      {children}
    </button>
  );
}
