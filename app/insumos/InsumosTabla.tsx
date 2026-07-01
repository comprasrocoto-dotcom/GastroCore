'use client';

import { useMemo, useState } from 'react';
import type { Insumo } from '@/lib/api/gastrocore';

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

export function InsumosTabla({ insumos }: { insumos: Insumo[] }) {
  const [q, setQ] = useState('');
  const [sub, setSub] = useState('');

  const subfamilias = useMemo(() => {
    const set = new Set<string>();
    insumos.forEach((i) => i.subfamilia && set.add(i.subfamilia));
    return Array.from(set).sort();
  }, [insumos]);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    return insumos.filter((i) => {
      const matchQ =
        !term ||
        i.articulo?.toLowerCase().includes(term) ||
        i.referencia?.toLowerCase().includes(term);
      const matchSub = !sub || i.subfamilia === sub;
      return matchQ && matchSub;
    });
  }, [insumos, q, sub]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por articulo o referencia..."
          className="flex-1 min-w-[220px] rounded-md border border-salvia-200 bg-white px-3 py-2 text-sm focus:border-ambar-400 focus:outline-none focus:ring-2 focus:ring-ambar-100"
        />
        <select
          value={sub}
          onChange={(e) => setSub(e.target.value)}
          className="rounded-md border border-salvia-200 bg-white px-3 py-2 text-sm focus:border-ambar-400 focus:outline-none"
        >
          <option value="">Todas las subfamilias</option>
          {subfamilias.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <p className="mb-2 text-xs text-salvia-600">{filtrados.length} resultados</p>

      <div className="overflow-x-auto rounded-lg border border-salvia-100">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-salvia-50 text-left text-salvia-700">
              <th className="px-3 py-2 font-medium">Referencia</th>
              <th className="px-3 py-2 font-medium">Articulo</th>
              <th className="px-3 py-2 font-medium">Unidad</th>
              <th className="px-3 py-2 font-medium">Subfamilia</th>
              <th className="px-3 py-2 text-right font-medium">Coste</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((i) => (
              <tr key={i.id} className="border-t border-salvia-50 hover:bg-ambar-50/40">
                <td className="px-3 py-2 font-mono text-xs text-salvia-600">{i.referencia}</td>
                <td className="px-3 py-2">{i.articulo}</td>
                <td className="px-3 py-2 text-salvia-600">{i.unidad}</td>
                <td className="px-3 py-2">
                  <span className="rounded bg-salvia-50 px-2 py-0.5 text-xs text-salvia-700">{i.subfamilia}</span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-ambar-700">{money(i.coste)}</td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-salvia-500">
                  No se encontraron insumos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
