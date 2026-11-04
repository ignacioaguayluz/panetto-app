# Panetto móvil V1 — especificación y ruta de ejecución

Estado: implementación autorizada y reanudada; T4 activo, la interfaz del producto aún debe implementarse.
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

- T0 [S1–S8] — Inicializar Git local y crear rama `feat/panetto-mobile-v1`; ruta: inline; estado: done, raíz y branch verificados; baseline commit `9705347`; sin remoto.
- T1 [S1] — Preparar y validar scaffold Expo aislado, identidad de app y dependencias generadas; ruta: inline (worker no disponible tras rechazo del estado publicado); estado: done; commit: `cb13417` (`feat: scaffold Panetto mobile app`); assessment high por escalación item 5, independent verifier aprobado; revisión nativa no debida (`reviewDue: false`).
- T2 [S2–S5] — Implementar dominio puro y validaciones con pruebas primero: ingreso, normalización de harinas y escalado; ruta: delegated to bounded worker due context backstop; estado: done; commit: `b657081` (`feat: add tested baker percentage domain`); RED/GREEN observado, test domain 10/10, domain/app typecheck pass; assessment medium, `reviewDue: false`, no verifier adicional requerido.
- T3 [S6–S8] — Implementar almacenamiento SQLite local, validación antes de persistir, lecturas corruptas explícitas, actualizaciones/eliminaciones y manejo de fallos con pruebas de interfaz pública; ruta: inline; estado: done; commits: `ea76092` (`feat: persist recipes locally with SQLite`), `f8f16f5` (`fix: reject malformed stored recipe fields`); 17/17 tests, typechecks, Expo Doctor and platform exports pass; assessment high item 1, independent verifier approved; native runtime proof T6.
- T4 [S1–S3, S6–S8] — Implementar recetario y editor móvil, guardado explícito, salida protegida y eliminación confirmada; ruta: inline; estado: in_progress (classification-toggle correction implemented; commit/assessment/independent verification pending; native simulator behavior assigned T6); commits: `1c74b8b`, `e9c4500`, `d2b609b`, fourth correction pending.
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

### L7 — Base Git y entorno móvil

Se capturó el estado inicial existente en el commit raíz `9705347` (`chore: capture existing Panetto baseline`) de `feat/panetto-mobile-v1`; el working tree quedó limpio. Comprobaciones de entorno: Node `v24.21.0`, npm `11.19.0`, Xcode disponible en `/Applications/Xcode.app/Contents/Developer`; simuladores iOS 27 disponibles (por ejemplo iPhone 18 Pro). `npx --yes create-expo-app@latest mobile --template blank-typescript` terminó con exit 0 y creó Expo SDK 58, TypeScript y React Native 0.88; el template terminó correctamente pese a imprimir una pregunta de inicialización Git. No se ejecutó aún una app Expo ni se verificó Android.

### L8 — Revisión de dependencias y avance del seguimiento

La auditoría detallada confirma 5 hallazgos moderados, todos derivados de `glob@13.0.6` y `minimatch@10.2.6` en el árbol de `expo@58.0.23`, `@expo/cli` y `@expo/fingerprint`; no hay hallazgos altos ni críticos. `npm audit fix --dry-run` solo propone instalar Expo 53.0.11 (downgrade major). El issue upstream `expo/expo#52735` describe el mismo problema en SDK 58 y está abierto; indica que forzar `minimatch@11` puede romper consumidores de `makeRe`. No se aplicó downgrade, `npm audit fix --force` ni overrides generales. Dejar registrada la limitación y continuar con SDK 58 si compatibilidad funcional permanece verificada; reevaluar si upstream publica parche antes del cierre.

Fuentes consultadas el 2026-11-03: Expo SDK 58 reference (`https://docs.expo.dev/versions/v58.0.0/`, requiere Node 22.13+ y React Native 0.88); Expo upstream issue `https://github.com/expo/expo/issues/52735`; advisories `https://github.com/advisories/GHSA-3g3m-2fjr-6pw4` y `https://github.com/advisories/GHSA-g3hv-75wg-m249` (fixed glob 14.0.2+, minimatch 11.0.1+). Node 24.21.0 cumple el requisito del SDK.

### L9 — Normalización del scaffold y validación inicial

Se configuró `mobile/app.json` y `mobile/package.json` para Panetto, se quitó el comando web de alcance futuro y se eliminaron `mobile/AGENTS.md`, `mobile/.claude/` y `mobile/LICENSE` generados por la plantilla (incluía una MIT no elegida). Se regeneró lockfile con scripts deshabilitados. `npx tsc --noEmit` y `npx expo-doctor` pasan (20/20); `npx expo export --platform ios` terminó con exit 0 y compiló el bundle iOS de 618 módulos. T1 scaffold quedó implementado y comprobado; npm audit mantiene los 5 avisos moderados documentados en L8.

### L10 — Verificación independiente de T1

El commit `cb13417` (`feat: scaffold Panetto mobile app`) pasa comparación independiente contra `9705347`: Expo/RN/TS presente, sin WebView ni runtime web, metadatos Panetto correctos y `Sources/`, `Resources/`, `scripts/build.sh` sin cambios. Verifier observó typecheck e iOS export correctos en copia aislada, además Android export correcto (616 módulos); diff-check y tree limpio. Verdict S1 aceptado para alcance de scaffold; S2–S8 quedan fuera de esa unidad. El texto de plantilla en inglés de `mobile/App.tsx` se reemplazará en pantallas de producto. Assessment native: risk high por escalación item 5, `nativeRisk: medium`, `agentEscalation.applied: true`, plan requiere self-verification e independent verifier; `reviewDue: false`, outcome unknown, por tanto no se inició review nativa. El verifier reportó un scratch temporal externo a la raíz; no se inspeccionó ni modificó desde la sesión padre.

T2 (dominio y cálculos) pasa a in_progress por activarse el context backstop; se delega como unidad acotada en `mobile/src/domain/**`, `mobile/tests/**` y el runner declarado en `mobile/package.json`. Todo lo demás permanece pendiente.

### L11 — Cierre de scaffolding y siguiente ruta

El evento de finalización de `npx expo export --platform ios` fue exit 0; el bundle incluye 618 módulos. Se revisó el resultado del verifier para T1 y se aceptó S1 en su alcance. T1 queda cerrado en `cb13417`; T2 comienza con desarrollo test-first. Se intentará el worker; si el runtime vuelve a rechazarlo, se aplica fallback inline y se registra.

### L12 — Revisión del resultado delegado y estado del trabajo

Worker reportó TDD con 10 pruebas GREEN y focused typecheck GREEN después de ajustar comandos. La revisión del padre leyó todos los archivos del dominio, pruebas, README y package config; `npm run test:domain` efectivamente pasó 10/10. Sin embargo, `npm run typecheck:domain && npx tsc --noEmit` se detuvo con exit 2 y TS2591/TS5097 en tests (`node:assert/strict`, `node:test`, extensión `.ts`); por tanto no se verificó el `npx tsc` de la app en ese comando. T2 permanece in_progress; corregir y repetir comprobaciones. Se ensayó un test adicional de cambio de modo con harina en cero; falló porque la conversión requiere una fórmula válida, pero esa expectativa no está exigida y el usuario puede corregir el borrador en el modo actual. Se retirará ese test para no ampliar requisitos. Ajustar el typecheck para no incluir tests de Node dentro del build TypeScript de Expo y volver a ejecutar las verificaciones. No marcar tareas posteriores como completadas.

### L13 — Ajuste de compilación de tests

Se retiró el test de cambio de modo con fórmula inválida por asumir comportamiento no especificado. Se cambió `mobile/tsconfig.json` para excluir pruebas del build de aplicación y el script `typecheck:domain` para verificar solo el dominio puro, sin exigir tipos Node transitorios. La verificación final se registra en L14.

### L14 — Verificación final del dominio

El padre ejecutó después de los ajustes: `cd mobile && npm run test:domain` — exit 0, 10/10; `cd mobile && npm run typecheck:domain` — exit 0; `cd mobile && npx tsc --noEmit` — exit 0. Node emite el warning no fatal `MODULE_TYPELESS_PACKAGE_JSON` al ejecutar los tests TypeScript como ESM sin cambiar el modo del paquete. No quedaron fallos en estas comprobaciones.

### L15 — Commit y assessment de dominio

T2 quedó en `b657081` (`feat: add tested baker percentage domain`), 415 líneas modificadas, con tests, documentación y dominio juntos. Native ASSESS contra `cb13417`: risk medium, `reviewDue: false` (`under_budget`), outcome unknown, ningún high-risk item escalado; plan pide self-verification sin verifier independiente. El self-verification padre está registrado en L14; no se inició review nativa. T2 done. T3 (almacenamiento local) queda in_progress.

### L16 — Decisión de persistencia

La referencia oficial de Expo SQLite para SDK 58 confirma soporte iOS/Android, `runAsync` con parámetros para escapar valores de usuario y `withExclusiveTransactionAsync` para evitar que otras escrituras se mezclen en una transacción. Se elige Expo SQLite, con schema versionado y transacciones explícitas para inicialización; los CRUD serán statements con valores enlazados. La capa de repositorio será portable y testeable tras interfaz pública con SQLite en memoria para tests, y el adaptador nativo Expo se probará en simuladores. Corrupt JSON/schema genera error visible; jamás se sustituye por receta de ejemplo. S6–S8 pruebas cubrirán persistencia, fallo, empty state, edición y eliminación.

### L17 — Instalación de Expo SQLite

`npx expo install expo-sqlite` terminó con exit 0 y fijó `expo-sqlite@~58.0.15`, compatible con SDK 58. Expo añadió el config plugin `expo-sqlite` a `mobile/app.json`. Persisten los cinco advisories moderados de glob/minimatch ya registrados; no se aplicó arreglo forzado.

### L18 — RED de persistencia

Se añadieron tests para repositorio SQLite público sobre DB SQLite en memoria, cubriendo lista vacía sin seed, persistencia/reapertura, valores hostiles, validación, update/delete acotados, fallos de read/write, datos corruptos y versión de esquema futura. `cd mobile && npm run test:domain` falló con exit 1 esperado: las 10 pruebas de dominio pasan y `tests/storage.test.ts` no puede importar `src/storage/recipeRepository.ts`, aún no creado (`ERR_MODULE_NOT_FOUND`). Esto registra el RED antes de implementar. T3 sigue in_progress; repo y adaptador Expo ya están escritos, pero una ejecución GREEN todavía no se obtuvo.

### L19 — Primer intento GREEN de persistencia

Se implementaron `mobile/src/storage/recipeRepository.ts` y `mobile/src/storage/expoRecipeRepository.ts`. `cd mobile && npm run test:domain` continúa en exit 1: las 10 pruebas de dominio pasan; el runner aborta al cargar `RepositoryError` porque Node 24 `--experimental-strip-types` no admite parameter properties (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`). Corregir esa sintaxis compatible con strip-only y repetir suite, typechecks y verificaciones Expo. T3 sigue in_progress; no marcar almacenamiento completo.

### L20 — GREEN de persistencia

Se cambió `RepositoryError` a sintaxis TypeScript compatible con Node strip-only y se agregó extensión `.ts` al import del dominio para que Node ESM resuelva el módulo. `cd mobile && npm run test:domain` ahora termina exit 0: 17/17 pruebas (10 dominio, 7 SQLite repository). Continúan dos warnings no fatales `MODULE_TYPELESS_PACKAGE_JSON`. Falta completar typechecks de dominio/app y verificar el adaptador SQLite en runtime antes de cerrar T3.

### L21 — Verificación plataforma y bloqueo TypeScript

Resultados: `cd mobile && npm run test:domain` exit 0, 17/17; `npx expo-doctor` exit 0, 20/20; `npx expo export --platform ios` exit 0 (618 módulos); `npx expo export --platform android` exit 0 (616 módulos). El comando `npm run typecheck:domain && npx tsc --noEmit` falló con exit 2 por TS5097: el import explícito `.ts` necesario para Node ESM no está habilitado en TypeScript. Corregir configuración y repetir ambos typechecks. Los exports no equivalen a probar runtime SQLite en un simulador; verificación nativa se hará en T6 cuando la UI use el repositorio.

### L22 — Typecheck y nuevo caso RED de storage

Se agregó `allowImportingTsExtensions` a `mobile/tsconfig.json`. `npm run typecheck:domain` y `npx tsc --noEmit` ahora pasan; los 17 tests habían pasado antes. Se amplió la suite para verificar escritura fallida, identificador vacío y versión futura sin inspeccionar storage interno. RED observado: `npm run test:domain` exit 1, 16/17 pasan; el caso de ID vacío falla porque el código devuelve `not_found` en vez de una categoría para ID inválido. Cambiar el error a `invalid_id`, correr GREEN y mantener el runtime SQLite en T6, no bloquear la finalización de T3 por una prueba nativa que corresponde a integración.

### L23 — GREEN y chequeos de almacenamiento

`cd mobile && npm run test:domain` — exit 0, 17/17 (10 domain, 7 SQLite); `npm run typecheck:domain` y `npx tsc --noEmit` — exit 0; `npx expo-doctor` — exit 0, 20/20; `npx expo export --platform ios` — exit 0, 618 módulos; Android — exit 0, 616 módulos. Se corrigió error code `invalid_id`. Dos warnings de Node sobre MODULE_TYPELESS_PACKAGE_JSON siguen siendo no fatales. Native SQLite runtime permanece en T6 y no se declara cubierto por bundle export. T3 no se cerrará hasta completar la verificación independiente requerida por assessment.

### L24 — Commit y assessment de persistencia

T3 se registró en `ea76092` (`feat: persist recipes locally with SQLite`). Native ASSESS contra `b657081`: risk high por escalación item 1, `nativeRisk: medium`, `reviewDue: false` (`under_budget`), `agentEscalation.applied: true`, plan `independentVerifier: true`; native review no debida. Self-check padre: 17/17, typechecks, Expo Doctor 20/20, iOS export 618, Android export 616; diff-check limpio al commit. El verifier independiente revisó ea76092 contra b657081 y encontró un bloqueo S6: un ingrediente persistido con `isFlour: "false"` se acepta en vez de `corrupt_data`; S7/S8 storage portions accepted, UI obligations remain T4. La corrección requiere un nuevo test RED, validación de forma estricta en el límite de lectura y nueva verificación. Runtime SQLite por plataforma sigue asignado a T6.

### L25 — Hallazgo independiente de corrupción

El verifier inyectó el payload `{"name":"Pan","ingredients":[{"id":"f","name":"Harina","isFlour":"false","percentage":100}]}`. `repository.get(id)` resolvió y mantuvo `isFlour` como string, que JS trata como truthy. Baseline domain validator también tolera ese tipo inválido, pero no existía reader de almacenamiento; el nuevo límite S6 debe rechazar datos corruptos sin mutarlos. El verifier no cambió archivos. T3 sigue in_progress; reproducir con test RED y corregir antes de cerrar.

### L26 — Reproducción de corrupción en storage

Se amplió el test público de lectura corrupta con el payload exacto señalado por el verifier. `cd mobile && npm run test:domain` produjo RED exit 1: 16/17 pasan; `repository.get('bad-flag')` no rechaza `isFlour: "false"`. Queda reproducido en la rama del padre. Corregir la validación runtime de cada ingrediente dentro del límite de decode/lectura y volver a obtener GREEN; no cambiar la validación de dominio preexistente ni aceptar coerciones.

### L27 — Corrección RED/GREEN del payload corrupto

Se validan al decodificar los tipos runtime de `id`, `name`, `isFlour` boolean y `percentage` finito; los campos malformados ahora llegan a `corrupt_data` sin coerción. Tras el test RED 16/17 de L26, `cd mobile && npm run test:domain` volvió a exit 0, 17/17; `npm run typecheck:domain` y `npx tsc --noEmit` terminaron exit 0, `git diff --check` limpio.

### L28 — Commit y assessment de corrección

La corrección está en `f8f16f5` (`fix: reject malformed stored recipe fields`), 42 líneas incluyendo test regresión y registro. ASSESS contra `ea76092`: high por escalación item 1, `nativeRisk: medium`, `reviewDue: false` (`under_budget`), `agentEscalation.applied: true`, plan requiere self-verification e independent verifier. No se inició review nativa. Self-verification GREEN consta en L27.

### L29 — Verificación independiente de corrección

`gentle-ai-verify` leyó la especificación completa y comparó `ea76092..f8f16f5`. El payload `isFlour: "false"` ahora se rechaza como `corrupt_data`; reads corruptos no mutan el JSON ni la DB; registros válidos permanecen legibles. Probe aislado: RED en base, GREEN en corrección; storage 7/7, suite total con probe 18/18, typechecks y diff-check pasan. T3 storage scope aprobado S6/S7/S8, sin bloqueadores; UI de guardar/descartar/confirmación sigue T4 y runtime SQLite nativo sigue T6. Assessment high item 1 y verifier completados; native review no debida. T3 done; T4 pasa a in_progress.

### L30 — Pausa y transferencia solicitadas por el usuario

> “hey hay alguna forma de parar lo que tienes hecho resumirlo, y continuar en otra sesión?”

El usuario ordenó pausar y transferir la implementación a otra sesión. En esta fase solo terminó `npx expo install react-native-safe-area-context` (exit 0; versión `5.11.1`), además del código de storage previo ya cerrado. No se llegó a escribir `App.tsx` ni pantallas. Estado Git al detener: cambios sin commit en `mobile/package.json`, `mobile/package-lock.json` por la nueva dependencia, y este documento. El usuario autorizó después reanudar desde T4, conservando esos cambios.

### L31 — Reanudación autorizada

> “puedes proseguir con la implementación por favor”

Se reanuda T4 en la rama actual. Primero implementar el recetario/editor con borrador independiente, guardado explícito, diálogo de salir Guardar/Descartar/Seguir editando, confirmación de eliminación, soporte de safe areas y navegación atrás. T5 y pruebas nativas de T6 siguen pendientes.

### L32 — RED/GREEN del modelo de edición

Se añadieron pruebas de T4 para restaurar modo/contexto de recetas guardadas, rechazar entradas numéricas incompletas y mapear las tres decisiones al salir del editor. El focused test dio RED antes de implementar el módulo (`ERR_MODULE_NOT_FOUND`); luego pasó primero 4/4 y luego 5/5 al añadir `mobile/src/ui/recipeEditorModel.ts` y `editorExitAction`. La prueba de salida también dio RED cuando se añadió y GREEN después de implementar y conectar la decisión en `App.tsx`.

### L33 — Primera UI del recetario y editor

`mobile/App.tsx` reemplaza la plantilla con biblioteca local vacía por defecto, editor de nombre/ingredientes, modo gramos/porcentajes, marca de harina manual, conversiones usando el dominio existente, almacenamiento solo en botón explícito, guardia de salida nativa Guardar/Descartar/Seguir editando, BackHandler Android y confirmación nativa antes de eliminar. Se añadió `SafeAreaProvider` para safe areas. Autoverificación final: test suite 22/22, focused model tests 5/5, `npm run typecheck:domain` y `npx tsc --noEmit` exit 0; Expo Doctor 20/20; exports iOS 662 módulos y Android 660 módulos, exit 0; `git diff --check` limpio. Los warnings no fatales MODULE_TYPELESS_PACKAGE_JSON persisten. No se ejecutó en simuladores ni se verificó la interacción visual/gestual nativa; corresponde a T6. T4 continúa in_progress hasta commit, assessment y verificación independiente.

### L34 — RED de decisiones de salida

Se añadió test de flujo para mapear sin ambigüedad una sesión limpia a salir, y cambios pendientes a confirmar, guardar, descartar o seguir editando. `cd mobile && node --experimental-strip-types --experimental-sqlite --test tests/recipeEditorModel.test.ts` dio RED exit 1: el helper `editorExitAction` aún no existe.

### L35 — GREEN final y verificación estática T4

El helper `editorExitAction` y el handler de `App.tsx` ahora cubren Guardar, Descartar y Seguir editando; Discard descarta un editor nuevo sin crear registro y Save cierra solamente después de `repository.save` exitoso. Final checks: 22/22 tests, domain/app typechecks exit 0, Expo Doctor 20/20, iOS export 662 módulos, Android 660, `git diff --check` limpio. Sin ejecución en dispositivo/simulador (deferred T6). Los cinco advisories moderados transitivos ya registrados no se modificaron. Commit T4 `1c74b8b`; assessment item 1 y verifier independiente documentados en L36.

### L36 — Commit y assessment T4

El work unit quedó en `1c74b8b` (`feat: build local recipe library and guarded editor`). ASSESS de rango comprometido contra `f8f16f5`: risk high por escalación item 1, `nativeRisk: medium`, `reviewDue: false` (`under_budget`), `agentEscalation.applied: true`; plan requiere self-verification e independent verifier. Native review no debida. La verificación independiente encontró un bloqueo S3/S7; T4 sigue in_progress. Las pruebas en simuladores y flujos visuales de UI siguen T6.

### L37 — Hallazgo independiente de guardado obsoleto

El verifier probó el callback real: al abrir una receta 500 g harina/350 g agua, escribir `1,` para agua y después cambiar harina a 600, `App.tsx` reemplaza todos los textos editables con valores del borrador anterior; se borra la entrada inválida y Guardar persiste 350 g de agua sin avisar. Esto viola S3/S7, aunque guardar inmediatamente después de `1,` sí falla. La verificación probó que la edición original no contemplaba ese caso. El padre agregó una prueba RED para el flujo y observó el rechazo inicial por helpers no implementados. Una prueba AST ad hoc no transpila anotaciones TypeScript dentro del VM; no se contabilizó como reproducción padre. Se corrigió según la evidencia del callback aislado del verifier.

### L38 — Corrección y verificación propia de guardado obsoleto

`updateEditorIngredientValue` conserva el texto inválido (`1,`) mientras una edición válida de harina cambia el borrador; `syncRawValuesWithDraft` mantiene entradas inválidas en add/remove/toggle y `draftWithRawValues` rechaza el cambio de modo si cualquier campo es inválido. `persistEditorDraft` valida antes de llamar al repositorio. La regresión pública del modelo reproduce el orden editar agua → harina, confirma que Guardar rechaza con `RecipeValidationError`, que `repository.save` se invoca cero veces y que la receta persistida sigue intacta. RED/GREEN observado; focused 6/6, suite 23/23, domain/app typechecks, iOS/Android exports (662/660 módulos) y diff-check pasan. Correction commit `e9c4500`; assessment y nueva verificación independiente registrados en L40.

### L40 — Commit y assessment de corrección T4

La corrección está en `e9c4500` (`fix: retain invalid editor input until corrected`), con test de regresión y task log. ASSESS del rango comprometido `1c74b8b..e9c4500`: risk high por escalación item 1, `nativeRisk: medium`, `reviewDue: false` (`under_budget`), `agentEscalation.applied: true`, plan requiere independent verifier; native review no debida. Self-verification completa en L38. La verificación independiente está pendiente. Tras su veredicto, cerrar T4 si no hay bloqueos, dejar T5 pausado para otra sesión conforme L39 y detenerse sin implementar T5.

### L39 — Pausa tras T4 solicitada

> “hey apenas este listo el paso 5 Construir recetario y editor móvil, detente y deja todo para el paso 6 Integrar calculadora y verificar iOS/Android, continuarlo en otra sesión por favor, deja todo listo para que sigas justo donde lo dejarás”

Continuar solo hasta cerrar T4 con commit de corrección y verificación independiente. Luego no iniciar T5 ni T6 en esta sesión; actualizar task file, Engram y TODO con T5 como próximo paso pausado, y dejar branch/working tree y evidencias listos para reanudar.

### L41 — Segunda corrección de guardado obsoleto

El verifier encontró que `101` en harina es rechazado por `editIngredient` con el error `El porcentaje de una harina debe estar entre 0 y 100.`, pero `syncRawValuesWithDraft` solo verificaba `parseDecimal`; al cambiar agua el campo se reemplazaba con `100` y guardaba. Se añadió test S3/S7, RED exacto observado: `'100' !== '101'`. Ahora la sincronización además aplica `editIngredient` como validación de cada input antes de reemplazar su texto; valores rechazados por reglas de dominio permanecen visibles y `persistEditorDraft` los bloquea antes de escribir. GREEN focused 7/7, suite 24/24, domain/app typechecks, Expo iOS 662/Android 660 exports y diff-check pass. Fix committed as `d2b609b`, assessment high/item1; independent verifier found a further classification-toggle case.

### L42 — Hallazgo en cambio de clasificación y pausa solicitada

El verifier probó en el candidato `d2b609b`: en una receta solo porcentaje, harina 100%/agua 70%, ingresar harina `101` produce el error esperado; marcar el agua como harina y luego desmarcar la harina original puede reemplazar `101` por `58.82352941176471` y permitir guardar ese valor obsoleto. La prueba reproduce el comportamiento también en `1c74b8b`; sigue violando S2/S3/S7. Aún no se añadió ni ejecutó corrección para este caso.

El usuario pidió:

> “hey para un momento y dime que estas realizando que estas tardando tanto”

Se pausó el código para explicar el bloqueo; próximo paso T4: test RED del rango rechazado seguido por cambios de clasificación, conservar el campo y bloquear Save sin escrituras; luego commit, assessment item1 y verifier. No iniciar T5 hasta T4 completo; después detenerse según L39. La app nativa/touch y SQLite real siguen T6.

### L43 — Reanudación con preferencia de entrega rápida

> “perfecto continua, intenta no demorarte mucho más, al final es una primera versión luego haremos pruebas”

Se reanuda T4. Priorizar la corrección puntual y su test de regresión, typechecks y verificación independiente requerida por el riesgo de datos; no ampliar a una batería de pruebas nativas ahora. La UI/SQLite de dispositivo siguen asignadas a T6, y la implementación debe detenerse al cerrar T4 antes de T5 conforme L39.

### L44 — GREEN de texto rechazado a través de cambios de clasificación

La prueba de regresión reprodujo RED (7/8): harina `101` rechazada, agregar agua como harina y quitar harina original convertía el texto en `58.82352941176471`. Se agregó `invalidInputs` por ingrediente; el rechazo persiste aunque una reclasificación haga numéricamente válido el campo. Save y cambio de modo siguen rechazados con el mismo mensaje hasta que el usuario corrija el valor; eliminar el ingrediente elimina su error. La prueba verifica raw visible, cero llamadas a `repository.save` y datos almacenados intactos. GREEN focused 8/8, full suite 25/25, domain/app typechecks, iOS export 662 módulos, Android 660, diff-check limpios. Sin pruebas nativas (deferred T6). Commit, ASSESS item1 e independent verifier pendientes; tras aprobación, cerrar T4 y detenerse antes de T5 según L39.
