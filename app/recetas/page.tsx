import Link from 'next/link';
import { getRecetas } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
const pct = (n: number) => (n ? (n * 100).toFixed(1) + '%' : '-');

export default async function RecetasPage() {
  let recetas: any[] = [];
  let error: string | null = null;
  try {
    recetas = await getRecetas();
  } catch (e) {
    error = e instanceof Error ? e.message : 'Error desconocido';
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ambar-700">Recetas</h1>
          <p className="text-sm text-salvia-700">Recetas y su costeo, sincronizadas con la base.</p>
        </div>
        <Link href="/recetas/nueva" className="btn-primary">+ Nueva receta</Link>
      </header>

      {error ? (
        <div className="rounded-md border border-dashed border-ambar-300 bg-ambar-50 p-6 text-sm text-ambar-800">
          <p className="font-semibold">No se pudo cargar la informacion.</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : recetas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-salvia-200 p-10 text-center text-salvia-600">
          <p>Aun no hay recetas. Crea la primera.</p>
          <Link href="/recetas/nueva" className="btn-primary mt-4">+ Nueva receta</Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-salvia-100">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-salvia-50 text-left text-salvia-700">
                <th className="px-3 py-2 font-medium">Receta</th>
                <th className="px-3 py-2 text-right font-medium">Costo porcion</th>
                <th className="px-3 py-2 text-right font-medium">Precio venta</th>
                <th className="px-3 py-2 text-right font-medium">Food cost</th>
              </tr>
            </thead>
            <tbody>
              {recetas.map((r: any) => (
                <tr key={r.id} className="border-t border-salvia-50 hover:bg-ambar-50/40">
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/recetas/${r.id}`} className="text-ambar-700 hover:underline">
                      {r.nombre}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{money(Number(r.costo_porcion))}</td>
                  <td className="px-3 py-2 text-right font-mono">{money(Number(r.precio_real))}</td>
                  <td className="px-3 py-2 text-right font-mono text-ambar-700">{pct(Number(r.food_cost))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
