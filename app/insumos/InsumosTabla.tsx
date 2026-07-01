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
          className="flex-1 min-w-[220px] rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
        />
        <select
          value={sub}
          onChange={(e) => setSub(e.target.value)}
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
        >
          <option value="">Todas las subfamilias</option>
          {subfamilias.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <p className="mb-2 text-xs text-salvia-600">{filtrados.length} resultados</p>

      <div className="card overflow-hidden">
        <table className="erp-table">
          <thead>
            <tr>
              <th>Referencia</th>
              <th>Articulo</th>
              <th>Unidad</th>
              <th>Subfamilia</th>
              <th className="!text-right">Coste</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((i) => (
              <tr key={i.id}>
                <td className="font-mono text-xs text-muted">{i.referencia}</td>
                <td className="font-medium">{i.articulo}</td>
                <td className="text-muted">{i.unidad}</td>
                <td>
                  <span className="chip bg-slate-100 text-slate-600">{i.subfamilia}</span>
                </td>
                <td className="text-right fin-value text-[#1E3A5F]">{money(i.coste)}</td>
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
