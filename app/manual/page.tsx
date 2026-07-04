import Link from 'next/link';

export const metadata = {
  title: 'Manual de uso — GastroCore',
  description: 'Guía paso a paso de GastroCore: cada módulo, cómo se usa y la lógica de costeo.',
};

const toc = [
  { href: '#logica', label: 'Cómo funciona GastroCore' },
  { href: '#insumos', label: '1. Insumos' },
  { href: '#subrecetas', label: '2. Subrecetas' },
  { href: '#recetas', label: '3. Recetas' },
  { href: '#familias', label: '4. Familias' },
  { href: '#panel', label: '5. Panel Ejecutivo' },
  { href: '#analisis', label: '6. Análisis de Costos' },
  { href: '#glosario', label: 'Glosario de términos' },
];

export default function ManualPage() {
  return (
    <main className="app-shell py-10">
      <header className="mb-8 max-w-3xl">
        <span className="eyebrow">Centro de ayuda</span>
        <h1 className="mt-2 text-4xl font-bold text-[#1E3A5F]">Manual de uso</h1>
        <p className="mt-3 text-base text-muted">
          Guía paso a paso de GastroCore: qué hace cada módulo, cómo se usa y por qué los números se calculan como se calculan.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="h-fit lg:sticky lg:top-20">
          <nav className="card p-4 text-sm">
            <p className="eyebrow mb-3">Contenido</p>
            <ul className="space-y-1">
              {toc.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="block rounded-lg px-2.5 py-1.5 font-medium text-[#1E3A5F] hover:bg-[#EFF6FF]">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="space-y-8">
          <section id="logica" className="card scroll-mt-24 p-6">
            <h2 className="text-2xl font-semibold">Cómo funciona GastroCore</h2>
            <p className="mt-3 text-[15px] leading-relaxed">
              GastroCore organiza el costeo de un restaurante en tres niveles que se alimentan uno del otro. El primer nivel son los <strong>insumos</strong>: las materias primas que se compran (verduras, carnes, licores, abarrotes, etc.), cada una con un costo por unidad de medida. El segundo nivel son las <strong>subrecetas</strong>: preparaciones intermedias como salsas, fondos, masas o mixes, armadas combinando insumos, cuyo resultado (costo por unidad producida) puede usarse como si fuera un insumo más. El tercer nivel son las <strong>recetas finales</strong>: los platos que se venden, que pueden combinar insumos y subrecetas en cualquier proporción.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed">
              La clave del sistema es la propagación automática de costos: si el precio de un insumo cambia, ese cambio recalcula al instante el costo de toda subreceta o receta que lo utilice, sin que nadie tenga que actualizar nada a mano. Por eso, mantener actualizado el precio de los insumos en la sección Insumos es lo que garantiza que el food cost de todo el menú sea correcto.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed">
              El indicador central del sistema es el <strong>food cost</strong>: el porcentaje que representa el costo de un plato sobre su precio de venta (costo del plato dividido por precio de venta). Cada receta tiene un food cost objetivo (35% por defecto) contra el cual se compara el food cost real. Según ese resultado, el sistema asigna un semáforo:
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="chip chip-success">Verde · Rentable: el food cost está dentro del objetivo</span>
              <span className="chip chip-warning">Amarillo · Vigilar: el food cost está cerca del límite</span>
              <span className="chip chip-danger">Rojo · Acción inmediata: el food cost supera el objetivo</span>
            </div>
            <p className="mt-4 text-[15px] leading-relaxed">
              Además del food cost, el sistema calcula automáticamente el <strong>precio sugerido de venta</strong> (el precio necesario para lograr el food cost objetivo), la <strong>utilidad</strong> (precio de venta menos costo del plato), el <strong>margen bruto</strong>, el impacto de la <strong>merma</strong> (pérdida de producto al preparar un ingrediente) y el <strong>desvío de mercancía</strong> (un porcentaje adicional que cubre diferencias de inventario no explicadas por la merma normal).
            </p>
          </section>

          <section id="insumos" className="card scroll-mt-24 p-6">
            <h2 className="text-2xl font-semibold">1. Insumos</h2>
            <p className="mt-3 text-[15px] leading-relaxed">
              Es el catálogo maestro de materias primas. Cada insumo tiene una referencia, un nombre, una unidad de medida, una subfamilia y un costo. Desde aquí se mantiene actualizado el precio real de compra de cada producto, que es el dato que alimenta todo el resto del sistema.
            </p>
            <h3 className="mt-5 text-lg font-semibold">Paso a paso</h3>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed">
              <li>Entra a <strong>Insumos</strong> desde el menú superior.</li>
              <li>Usa el buscador para encontrar un insumo por nombre o referencia, o filtra por subfamilia con el desplegable.</li>
              <li>Para actualizar un precio, haz clic en <strong>Editar</strong> en la fila del insumo, ingresa el nuevo precio (y opcionalmente un motivo del cambio) y guarda. El cambio se propaga automáticamente a todas las subrecetas y recetas que usan ese insumo.</li>
              <li>Para saber en qué preparaciones se usa un insumo antes de cambiar su precio, haz clic en <strong>Dónde se usa</strong>: se abre la lista de subrecetas y recetas que lo incluyen, con acceso directo a cada una.</li>
              <li>Desde la ventana de edición también puedes consultar el <strong>historial de precios</strong> del insumo.</li>
            </ol>
          </section>

          <section id="subrecetas" className="card scroll-mt-24 p-6">
            <h2 className="text-2xl font-semibold">2. Subrecetas</h2>
            <p className="mt-3 text-[15px] leading-relaxed">
              Las subrecetas son preparaciones base (salsas, fondos, masas, mixes) que luego se agregan como ingrediente dentro de otras recetas o subrecetas. Sirven para no repetir la misma preparación en el costeo de cada plato: se costea una sola vez y su costo por unidad se reutiliza donde haga falta.
            </p>
            <h3 className="mt-5 text-lg font-semibold">Paso a paso para crear una subreceta</h3>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed">
              <li>Entra a <strong>Subrecetas</strong> y haz clic en <strong>+ Nueva subreceta</strong>.</li>
              <li>Completa el nombre, el rendimiento producido (cuánto rinde la preparación) y su unidad (gramos, kilos, mililitros, litros, onza, copa o unidades).</li>
              <li>Define el porcentaje de desvío de mercancía y clasifica la subreceta por familia y subfamilia (puedes crear una familia nueva desde el mismo formulario con "Administrar familias").</li>
              <li>Agrega los ingredientes uno por uno con <strong>+ Agregar ingrediente</strong>: elige el insumo (u otra subreceta), la cantidad usada y el porcentaje de merma. El costo unitario y el costo total de cada ingrediente se calculan solos.</li>
              <li>Revisa el resumen de costeo (costo de ingredientes, desvío de mercancía, costo final, costo por unidad, food cost y precio sugerido) y guarda con <strong>Guardar receta</strong>.</li>
              <li>Desde ese momento, la subreceta queda disponible como ingrediente al armar cualquier receta o subreceta nueva.</li>
            </ol>
          </section>

          <section id="recetas" className="card scroll-mt-24 p-6">
            <h2 className="text-2xl font-semibold">3. Recetas</h2>
            <p className="mt-3 text-[15px] leading-relaxed">
              Es el recetario final: los platos que se venden en el menú. La lista se agrupa por familia y muestra, para cada receta, el costo por porción, el precio de venta, el precio sugerido y el food cost con su semáforo de color.
            </p>
            <h3 className="mt-5 text-lg font-semibold">Consultar una receta</h3>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed">
              <li>Entra a <strong>Recetas</strong> y filtra por familia, subfamilia, rango de food cost o estado si lo necesitas.</li>
              <li>Haz clic en el nombre de una receta para ver su ficha completa: ingredientes con cantidad, merma, costo unitario y costo total; resumen de costos; y botones para descargar la ficha en PDF o ver la trazabilidad completa.</li>
              <li>Desde la ficha puedes entrar a <strong>Editar receta</strong> para modificar sus ingredientes, cantidades o clasificación.</li>
            </ol>
            <h3 className="mt-5 text-lg font-semibold">Paso a paso para crear una receta nueva</h3>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed">
              <li>Haz clic en <strong>+ Nueva receta</strong>.</li>
              <li>Completa el nombre, el rendimiento en porciones, el desvío de mercancía y la clasificación por familia y subfamilia.</li>
              <li>Agrega los ingredientes (insumos o subrecetas) uno por uno, indicando cantidad y merma.</li>
              <li>Define el precio real de venta para que el sistema calcule el food cost real y la utilidad, y guarda la receta.</li>
            </ol>
          </section>

          <section id="familias" className="card scroll-mt-24 p-6">
            <h2 className="text-2xl font-semibold">4. Familias</h2>
            <p className="mt-3 text-[15px] leading-relaxed">
              Las familias y subfamilias son la forma de clasificar y ordenar insumos, subrecetas y recetas (por ejemplo Entradas, Arroces, Fruver, Licores). Se usan como filtro en todas las demás secciones y en los reportes del Panel y de Análisis.
            </p>
            <h3 className="mt-5 text-lg font-semibold">Paso a paso</h3>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed">
              <li>Entra a <strong>Familias</strong> desde el menú.</li>
              <li>Para crear una familia nueva, escribe el nombre en "Nueva familia" y haz clic en <strong>Crear familia</strong>.</li>
              <li>Para crear una subfamilia, elige primero la familia a la que pertenecerá y haz clic en <strong>Crear subfamilia</strong>.</li>
              <li>Desde el listado "Familias existentes" puedes <strong>editar</strong> el nombre de una familia o subfamilia, o <strong>desactivarla</strong> si ya no se usa.</li>
            </ol>
          </section>

          <section id="panel" className="card scroll-mt-24 p-6">
            <h2 className="text-2xl font-semibold">5. Panel Ejecutivo</h2>
            <p className="mt-3 text-[15px] leading-relaxed">
              Es el tablero de indicadores para revisar la salud del menú de un vistazo: recetas activas, food cost promedio, utilidad potencial y recetas fuera de precio, además de alertas de rentabilidad separadas en "acción inmediata" y "a vigilar".
            </p>
            <p className="mt-3 text-[15px] leading-relaxed">
              Incluye un ranking de las recetas más rentables, un ranking de las que más se alejan del objetivo, el food cost promedio por familia y una tabla detallada donde se puede simular un precio sugerido editable y ver de inmediato el food cost resultante y la utilidad, además de activar, desactivar o actualizar el precio de cada receta directamente desde ahí. Todo el panel se puede exportar a Excel con el botón correspondiente.
            </p>
          </section>

          <section id="analisis" className="card scroll-mt-24 p-6">
            <h2 className="text-2xl font-semibold">6. Análisis de Costos</h2>
            <p className="mt-3 text-[15px] leading-relaxed">
              Esta sección muestra cómo varían los precios de los insumos a lo largo del tiempo y cuánto afecta esa variación al menú. En la parte superior aparecen el insumo más inflacionario, la receta más afectada, la variación promedio de costos y alertas automáticas cuando un insumo sube mucho de precio o una receta supera su food cost objetivo.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed">
              Tiene tres pestañas: <strong>Variación de costos</strong> (top de insumos que más subieron o bajaron y variación por familia), <strong>Impacto en el menú</strong> (qué recetas se ven afectadas por cada variación de insumo) y <strong>Simulación</strong>, donde puedes elegir un insumo, escribir un precio hipotético y ver qué pasaría con el food cost y el precio sugerido de las recetas afectadas, sin guardar ningún cambio real. También puedes descargar reportes en Excel o exportar la vista completa en PDF.
            </p>
          </section>

          <section id="glosario" className="card scroll-mt-24 p-6">
            <h2 className="text-2xl font-semibold">Glosario de términos</h2>
            <dl className="mt-3 divide-y divide-line">
              <div className="py-3">
                <dt className="font-semibold">Food cost</dt>
                <dd className="text-muted">Porcentaje que representa el costo de un plato sobre su precio de venta.</dd>
              </div>
              <div className="py-3">
                <dt className="font-semibold">Food cost objetivo</dt>
                <dd className="text-muted">El porcentaje máximo de food cost que la receta debería tener (35% por defecto).</dd>
              </div>
              <div className="py-3">
                <dt className="font-semibold">Precio sugerido</dt>
                <dd className="text-muted">El precio de venta necesario para alcanzar el food cost objetivo.</dd>
              </div>
              <div className="py-3">
                <dt className="font-semibold">Merma</dt>
                <dd className="text-muted">Porcentaje de producto que se pierde al preparar un ingrediente (limpieza, cocción, corte).</dd>
              </div>
              <div className="py-3">
                <dt className="font-semibold">Desvío de mercancía</dt>
                <dd className="text-muted">Porcentaje adicional que cubre diferencias de inventario no explicadas por la merma normal.</dd>
              </div>
              <div className="py-3">
                <dt className="font-semibold">Margen bruto</dt>
                <dd className="text-muted">Porcentaje de utilidad sobre el precio de venta (utilidad dividida por precio de venta).</dd>
              </div>
              <div className="py-3">
                <dt className="font-semibold">Utilidad</dt>
                <dd className="text-muted">Diferencia entre el precio de venta y el costo total del plato.</dd>
              </div>
            </dl>
          </section>

          <div className="text-center">
            <Link href="/" className="btn-secondary">Volver al inicio</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
