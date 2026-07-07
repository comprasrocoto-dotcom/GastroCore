import { getRecetario } from '@/lib/recetario';
import RecetarioGaleria from '@/components/RecetarioGaleria';

export const metadata = {
  title: 'Recetario · Malanga',
  description: 'Recetario en línea del equipo de cocina',
};

// La página es pública (ver middleware). Los datos vienen cacheados 5 min
// desde el servidor; el navegador de cocina nunca toca la API con token.
export default async function RecetarioPage() {
  let recetas;
  try {
    recetas = await getRecetario();
  } catch {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAF7F0] px-6 text-center">
        <div>
          <div className="mb-3 text-4xl">🌿</div>
          <h1 className="mb-2 text-xl font-bold text-[#2B4D2E]">El recetario no está disponible</h1>
          <p className="text-sm text-[#6B7A6B]">
            No se pudo cargar la información. Intenta de nuevo en unos minutos.
          </p>
        </div>
      </main>
    );
  }
  return <RecetarioGaleria recetas={recetas} />;
}
