# Panetto móvil V1 — especificación y ruta de ejecución

Estado: implementación autorizada; se autorizó inicializar Git en el proyecto para habilitar rama de funcionalidad y commits de trabajo.
Objetivo: una app local de recetas y escalado de producción para iOS y Android con Expo/React Native, priorizando a quienes producen pan para vender.
Rama/entrega: crear `feat/panetto-mobile-v1`; runner aún por confirmar al inspeccionar el entorno móvil.

## Specs

### S1 — Plataformas, destinatario y límites

> “en este desarrollo y cuestiones de diseño nos enfocaremos para apps de iOS y Android y que efectivamente no sea una web empaquetada, queremos algo homogeneo pero que en cada plataforma tengo su personalidad”

> “es una app que le sacara mas provecho quien produce pan ya tanto en emprendimiento como en negocio, esa persona es la prioridad”

> “por ahora no trabajaremos la versión web pero se realizara sin duda alguna”

- Construir con Expo, React Native y TypeScript; no usar una WebView como interfaz del producto.
- Compartir identidad visual y comportamiento funcional, respetando navegación, botón atrás, áreas seguras, controles, teclado y accesibilidad de cada plataforma.
- Mantener intactos `Sources/`, `Resources/` y `scripts/build.sh` de la aplicación macOS.
- Preparar el dominio y los contratos de persistencia para reutilización futura en web, sin implementar web ni infraestructura exclusiva para ella.
- No añadir cuentas, servidor, sincronización, inventario, costos ni funciones comerciales.

### S2 — Recetas e ingreso de ingredientes

> “que pueda colocar su receta ya sea por porcentaje o peso, que eso se asigne con un boton o un switch luego vemos que es lo más conveniente”

> “por ahora no incluyamos eso, solo que coloque ingredientes, eso quede guardado y cada vez que se ocupe una cantidad de esa receta entregue la proporción correcta.”

- Cada receta tiene nombre e ingredientes; cada ingrediente tiene identidad estable, nombre, valor y la opción manual “Es harina”.
- Permitir agregar, editar y quitar ingredientes dentro del borrador de una receta.
- Dos modos de ingreso: gramos y porcentaje panadero, mediante un selector claramente etiquetado. La forma visual exacta del selector es una decisión de implementación.
- No incluir notas, procedimientos, tiempos, temperaturas ni categorías de ingredientes en V1.
- Ingresar gramos no cambia los gramos de los otros ingredientes: deriva los porcentajes respecto de la harina total.
- La fórmula persistida tiene porcentajes panaderos como representación canónica. Conservar además los valores base ingresados en gramos cuando corresponda, para no perder el contexto de edición; no usarlos como una segunda fórmula independiente.
- Una fórmula creada solamente por porcentajes no requiere inventar un peso base de harina para guardarse o calcularse. Si se pasa a gramos sin una base previa, solicitar la harina total base dentro de la interfaz; derivar desde ella los gramos sin alterar la fórmula. Esto no es una consulta de desarrollo al usuario.

### S3 — Harinas y porcentajes

> “la app transforme todo a porcentajes porque es más convenientes”

> “mira dejemoslo que se ajuste al 100%”

Confirmado posteriormente: cada ingrediente tendrá “Es harina”, marcada manualmente; para guardar o calcular debe existir al menos una harina con cantidad positiva.

- La suma de las harinas representa el 100 %, no la masa total.
- Al editar el porcentaje de una harina, conservar el total de harinas en 100 % redistribuyendo las demás proporcionalmente a sus participaciones anteriores.
- Si las demás harinas sumaban cero, distribuir entre ellas por partes iguales, como hace el código actual.
- Una única harina queda en 100 %.
- Los porcentajes de ingredientes no harina no se alteran al redistribuir las harinas.
- No admitir pesos o porcentajes negativos ni valores no finitos. Los ingredientes individuales pueden tener valor cero; la harina total debe ser positiva.
- Un porcentaje individual de harina debe estar entre 0 y 100. Los ingredientes no harina pueden superar el 100 %.
- Agregar, quitar o cambiar la condición de harina debe dejar una fórmula consistente: en modo gramos recalcular sobre los pesos base; en modo porcentajes normalizar proporcionalmente las harinas restantes. Si no queda una base positiva, mostrar validación y bloquear guardar/calcular hasta corregirla.
- Al rechazar una entrada inválida no modificar la fórmula guardada ni propagar valores inválidos al cálculo.

### S4 — Cálculo de producción

> “la idea es que nos de el peso de cada ingrediente para obtener la(s) pieza(s) deseadas según el usuario.”

> “si se quiere hacer una prueba pequeña lo mejor es permitir pequeñas cantidades no solo kilos”

Confirmado posteriormente: cantidad de piezas entera y mayor que cero; peso por pieza positivo y con decimales, sin mínimo de kilos.

- Entradas: cantidad de piezas y gramos de masa cruda por pieza.
- Salidas: peso de cada ingrediente y peso total de masa cruda para la producción solicitada.
- No alterar ni sobrescribir la fórmula por calcular otra cantidad.
- Mantener precisión interna y mostrar gramos con hasta dos decimales.
- No redondear los valores intermedios. La suma de los valores mostrados puede diferir levemente del total por redondeo; no compensar modificando la fórmula.
- No presentar resultados anteriores como vigentes cuando se modificaron sus entradas. Usar una acción explícita “Calcular” como en la app actual.
- Mostrar errores comprensibles en entradas vacías, inválidas, no finitas o fuera de las reglas; no producir resultados inválidos.

Fórmulas:

- `porcentaje_i = gramos_i / gramos_totales_de_harina × 100`
- `masa_objetivo = cantidad_de_piezas × gramos_por_pieza`
- `gramos_i = masa_objetivo × porcentaje_i / suma_de_todos_los_porcentajes`

Ejemplo de aceptación: harina 100 %, agua 70 %, sal 2 %; una pieza de 400 g.

| Ingrediente | Resultado mostrado |
| --- | ---: |
| Harina | 232,56 g |
| Agua | 162,79 g |
| Sal | 4,65 g |
| Masa total | 400 g |

Para dos piezas de 400 g, el total es 800 g y los valores internos de cada ingrediente se duplican antes del redondeo.

### S5 — Masa madre, prefermentos y rendimiento

> “incluirlos solo como ingredientes directos”

> “tendremos una sección para modificar la hidratación de masa madre, pero para la v2”

> “la app por ahora dira solo peso en crudo final, luego podemos ahcer una sección para rendimiento.”

- Tratar masa madre y prefermentos como ingredientes directos, sin descomponerlos en harina y agua.
- No marcarlos automáticamente como harina ni inferir su composición a partir del nombre.
- No mostrar el porcentaje del agua directa como si fuera la hidratación real completa de la masa.
- V2: sección de modificación de hidratación de masa madre.
- Futuro sin versión asignada: rendimiento, merma y peso después del horneado.

### S6 — Recetario local

> “la idea es que cada telefono tenga sus propias recetas, como si fuera una app de notas pero algo más eleborada”

- Permitir listar, crear, abrir y editar múltiples recetas.
- Persistirlas localmente; funcionar sin conexión y conservarlas después de cerrar y reabrir la app.
- No exigir cuenta ni conexión a un servicio remoto.
- No incluir sincronización, exportación, importación, respaldos propios ni duplicado en V1.
- Advertir en la documentación que los datos no se sincronizan y que la desinstalación o pérdida del dispositivo puede implicar pérdida de recetas; no prometer políticas de respaldo del sistema operativo.
- Un fallo de lectura no debe reemplazar silenciosamente recetas existentes por ejemplos; un fallo de escritura no debe anunciar un guardado exitoso.

### S7 — Guardado y protección de cambios

> “mejor mediante un botón de guardar, que sea algo que se quiera hacer”

Confirmado: al salir con cambios sin guardar, ofrecer “Guardar”, “Descartar cambios” o “Seguir editando”.

- Editar sobre un borrador separado de la receta persistida.
- “Guardar” valida y persiste explícitamente; no hay autoguardado de fórmulas.
- “Descartar cambios” conserva intacta la versión persistida; si la receta era nueva, no crea un registro.
- “Seguir editando” mantiene el borrador y permanece en el editor.
- “Guardar” desde el aviso solo permite salir si la validación y la persistencia terminan correctamente.
- Aplicar la protección también al botón atrás y a los gestos de navegación pertinentes. No prometer recuperación de borradores tras cierre forzoso del proceso.
- Calcular una producción no equivale a guardar una receta ni marca por sí mismo su fórmula como modificada.

### S8 — Eliminación

> “si incluyamos esa eliminacion en v1”

La propuesta aceptada fue eliminar recetas con confirmación.

- Pedir confirmación antes de eliminar una receta persistida.
- Cancelar conserva la receta y sus datos sin cambios.
- Confirmar elimina solamente la receta elegida y actualiza la lista después de un resultado exitoso.
- Si falla el almacenamiento, informar el error sin presentar la eliminación como completada.
- Permitir un recetario vacío sin recrear automáticamente una receta de ejemplo.

## Tasks

La implementación está autorizada. El usuario autorizó inicializar un repositorio Git local en el proyecto existente para continuar, sin crear un remoto.

- T0 [S1–S8] — Inicializar Git local y crear rama `feat/panetto-mobile-v1`; ruta: inline; estado: done, `git init -b feat/panetto-mobile-v1` confirmado y raíz/branch verificados; commit: pendiente.
- T1 [S1] — Preparar proyecto móvil aislado de macOS, estructura y herramientas de pruebas; ruta: inline (worker no disponible tras rechazo del estado publicado); estado: in_progress; commit: pendiente.
- T2 [S2–S5] — Implementar dominio puro y validaciones con pruebas primero: ingreso, normalización de harinas y escalado; ruta: inline; estado: pendiente; commit: pendiente.
- T3 [S6–S8] — Implementar almacenamiento local y operaciones de recetas con manejo de fallos y pruebas; ruta: inline; estado: pendiente; commit: pendiente.
- T4 [S1–S3, S6–S8] — Implementar recetario y editor móvil, guardado explícito, salida protegida y eliminación confirmada; ruta: inline; estado: pendiente; commit: pendiente.
- T5 [S4–S5, S7] — Implementar calculadora y resultados conectados al dominio, sin modificar la fórmula guardada; ruta: inline; estado: pendiente; commit: pendiente.
- T6 [S1–S8] — Verificar integración en iOS y Android, accesibilidad, persistencia, documentación y límites conocidos; ruta: inline más verificación independiente cuando el riesgo lo requiera; estado: pendiente; commit: pendiente.

### Criterios técnicos para ejecutar sin nuevas consultas de diseño

- Crear el proyecto móvil bajo `mobile/`; mantener la app SwiftUI existente en sus rutas actuales.
- Separar dominio TypeScript puro, casos de uso, contrato de repositorio, adaptador local e interfaz móvil.
- Usar una solución local compatible con Expo; preferencia inicial: SQLite mediante Expo SQLite. Verificar compatibilidad con la versión estable elegida antes de instalar.
- Evitar dependencias sin necesidad, abstracciones para funciones futuras, backend o monorepo complejo solo para una web todavía inexistente.
- Usar componentes nativos, diseño adaptable a teléfonos, etiquetas accesibles, contraste legible y tamaños de texto compatibles con ajustes del sistema.
- Mantener la interfaz en español, como la app actual. Identificadores técnicos y código nuevo en inglés.
- Admitir coma y punto decimal en entradas numéricas, normalizando sin ambigüedad; no interpretar separadores de miles en estos campos.
- No generar cambios en la app macOS ni migrar sus recetas automáticamente al teléfono.
- Elegir detalles visuales, librerías menores y estructura interna conforme a estos criterios sin pedir aprobación por cada transición.
- Si aparece una contradicción de producto, una acción destructiva, consentimiento obligatorio o falta de prueba necesaria, detenerse e informar el bloqueo concreto. Este documento no elimina esas restricciones.

### Orden de verificación

1. Observar RED antes de implementar reglas deterministas y luego GREEN en las pruebas correspondientes.
2. Probar ingreso por gramos y porcentajes, múltiples harinas, una sola harina, redistribución con otras en cero y cambios de la condición de harina.
3. Probar producción pequeña, ejemplo de 400 g, múltiples piezas, entradas inválidas y precisión de presentación sin redondeo intermedio.
4. Probar guardar, reabrir, editar, descartar y cada salida del aviso de cambios pendientes, sin sobrescrituras accidentales.
5. Probar eliminación confirmada y cancelada, recetario vacío, reinicio y fallos de almacenamiento, verificando que las operaciones rechazadas no alteren datos guardados.
6. Realizar controles funcionales reales en iOS y Android: teclado decimal, navegación/gestos, botón atrás, áreas seguras, tamaño de texto y uso sin conexión.
7. Ejecutar comprobación de tipos, pruebas y controles estáticos disponibles; informar exactamente los controles fallidos, omitidos o no disponibles. No afirmar validación de dispositivos sin haberla realizado.
8. Aplicar evaluación/revisión nativa según el interruptor RDD y el riesgo del candidato; no sustituye pruebas funcionales.

### Entrega y cuestiones no autorizadas

- Implementar por unidades revisables, con pruebas y documentación junto al comportamiento y evidencia de commits cuando corresponda al flujo de implementación.
- No publicar, hacer push, abrir PR, subir a tiendas ni desplegar sin autorización específica.
- El objetivo es open source, pero aún no se eligió licencia. Esto no bloquea construir localmente; sí queda pendiente antes de presentar el proyecto públicamente como software con licencia open source. No escoger una licencia legal en nombre del usuario.
- No comprometer soporte de una versión específica de iOS/Android ni una versión concreta de Expo sin comprobar compatibilidad del entorno al iniciar.

## Log

### L1 — Pedido original

> “No ejecute código, primero vamos a determinar lo que quiero y todos los requermientos necesarios para ello, trazar una ruta y todo lo demás. Así que primero analiza el código y dime si entiendes todo lo que sucede. El objetivo es crear una app open source que funcione de forma nativa, y en app con Expo React native que es mi stack.”

### L2 — Alcance de esta entrega

> “Me parece antes de implementar deja redactado todo lo que ejecutaremos para que solo lo leas y lo ejecutes de una sin consultar nada porque esta todo claro, pero si incluyamos esa eliminacion en v1”

### L3 — Evidencia de exploración

Se leyeron `README.md`, `Sources/PanettoApp.swift`, `Resources/Info.plist`, `scripts/build.sh` y `.gitignore`. Se inspeccionaron listados de archivos sin ejecutar código ni compilaciones.

El código actual es SwiftUI para macOS, conserva recetas mediante JSON en UserDefaults, calcula porcentajes respecto de las harinas, redistribuye sus porcentajes y escala la receta por peso total objetivo. No existe todavía proyecto Expo en la raíz inspeccionada. Su guardado automático no se trasladará al móvil: S7 requiere guardado explícito.

### L4 — Estado y criterio de continuidad

Esta entrega solo crea la especificación. No se implementó, instaló, compiló, probó ni publicó la app móvil. Las frases citadas en Specs conservan las decisiones del usuario; los criterios técnicos y reglas de borde explicitan cómo ejecutarlas sin inventar funciones adicionales.

### L5 — Autorización y bloqueo inicial

> “Perfecto. Ejecuta la aplicación avisame cuando este lista”

La solicitud autoriza implementar y ejecutar la app móvil conforme a esta especificación. La comprobación de `git status --short --branch`, `git branch --show-current` y `git rev-parse --show-toplevel` falló con `fatal: not a git repository`; `pwd` confirmó `/Users/nacho/Aplicaciones/panetto-app`, y la búsqueda hasta tres niveles del directorio padre no encontró `.git`. RDD está activo. Se detuvo antes de escribir código mientras faltaba la autorización para crear el repositorio local.

### L6 — Resolución de bloqueo

> “no hay una actualmente, puedes ejecutarla tu mismo para no frenar la implementación?”

Autorización explícita para inicializar Git local y continuar la implementación. `git init -b feat/panetto-mobile-v1` tuvo éxito en la raíz del proyecto; `git status --short --branch` confirmó la rama y `git rev-parse --show-toplevel` confirmó la raíz. No se configuró remoto. T0 completo. Se intentó delegar T1 al worker por el aviso de context backstop; el runtime rechazó la tarea con `invalid-published-state`, por lo que se ejecuta inline como fallback. El resto queda pendiente y ninguna de esas tareas se marca como terminada.
