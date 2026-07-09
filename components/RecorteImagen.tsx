'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Recorte y rotación de imagen SIN librerías (canvas puro, ~0 KB añadidos).
 * Marco fijo 4:3; la foto se arrastra para encuadrar, se acerca con el
 * deslizador y se rota en pasos de 90°. Exporta JPEG máx. 1600 px.
 */
export function RecorteImagen({ src, onListo, onCancelar }:
  { src: string; onListo: (base64: string, mime: string) => void; onCancelar: () => void }) {
  const lienzoRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [rot, setRot] = useState(0);          // 0 | 90 | 180 | 270
  const [zoom, setZoom] = useState(1);        // 1 .. 3
  const [off, setOff] = useState({ x: 0, y: 0 });
  const arrastre = useRef<{ x: number; y: number } | null>(null);
  const [listo, setListo] = useState(false);

  const ANCHO = 640, ALTO = 480; // vista 4:3

  useEffect(() => {
    const img = new Image();
    img.onload = () => { imgRef.current = img; setOff({ x: 0, y: 0 }); setListo(true); };
    img.src = src;
  }, [src]);

  // Dibuja la imagen en un contexto dado, con la misma matemática para
  // la vista previa y para la exportación (así lo que ves es lo que sale).
  function dibujar(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const img = imgRef.current;
    if (!img) return;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((rot * Math.PI) / 180);
    const rotada = rot % 180 !== 0;
    const iw = rotada ? img.height : img.width;
    const ih = rotada ? img.width : img.height;
    // Escala base: la imagen CUBRE el marco; el zoom multiplica.
    const escala = Math.max(w / iw, h / ih) * zoom;
    const fx = (off.x * w) / ANCHO, fy = (off.y * h) / ALTO; // offset proporcional
    if (rotada) ctx.translate(fy, -fx); else ctx.translate(fx, fy);
    // Deshacer la rotación del offset no aplica: off se aplica en el marco.
    ctx.rotate(0);
    ctx.scale(escala, escala);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  }

  useEffect(() => {
    const c = lienzoRef.current;
    const ctx = c?.getContext('2d');
    if (c && ctx && listo) dibujar(ctx, c.width, c.height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rot, zoom, off, listo]);

  function empezar(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    arrastre.current = { x: e.clientX - off.x, y: e.clientY - off.y };
  }
  function mover(e: React.PointerEvent) {
    if (!arrastre.current) return;
    setOff({ x: e.clientX - arrastre.current.x, y: e.clientY - arrastre.current.y });
  }
  function soltar() { arrastre.current = null; }

  function exportar() {
    const c = document.createElement('canvas');
    c.width = 1600; c.height = 1200;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    dibujar(ctx, c.width, c.height);
    onListo(c.toDataURL('image/jpeg', 0.85).split(',')[1], 'image/jpeg');
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" onClick={onCancelar}>
      <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-2 text-base font-bold text-slate-800">Encuadra la foto</h3>
        <canvas
          ref={lienzoRef}
          width={ANCHO}
          height={ALTO}
          onPointerDown={empezar}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerLeave={soltar}
          className="w-full cursor-move touch-none rounded-lg border border-slate-300"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button onClick={() => setRot((r) => (r + 270) % 360)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">⟲ Rotar</button>
          <button onClick={() => setRot((r) => (r + 90) % 360)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">⟳ Rotar</button>
          <label className="flex flex-1 items-center gap-2 text-xs text-slate-600">
            Zoom
            <input type="range" min={1} max={3} step={0.02} value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" />
          </label>
          <button onClick={() => { setRot(0); setZoom(1); setOff({ x: 0, y: 0 }); }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-500">Reiniciar</button>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">Arrastra la imagen para encuadrarla dentro del marco.</p>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onCancelar} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancelar</button>
          <button onClick={exportar} className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white">Usar esta foto</button>
        </div>
      </div>
    </div>
  );
}
