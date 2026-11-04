# Panetto

Aplicación local de macOS para recetas de pan con porcentaje panadero y escalado de producción.

Ingresa los pesos de tu receta de referencia sin que Panetto modifique los demás ingredientes. Luego indica cuántos panes quieres y el peso de cada uno; **Calcular receta** muestra las cantidades que necesitas preparar.

## Crear el ejecutable

Desde Terminal, dentro de esta carpeta:

```zsh
./scripts/build.sh
```

El resultado es `build/Panetto.app`. Ábrelo con doble clic y, si te gusta, arrástralo a Aplicaciones.

Las recetas se guardan solo en tu Mac.

## Aplicación móvil

La app móvil de Expo se desarrolla en `mobile/` y guarda cada recetario localmente en el dispositivo. Las recetas no se sincronizan entre dispositivos ni con un servicio en línea. La desinstalación de la app o la pérdida del dispositivo puede implicar perderlas; no se promete que el sistema operativo conserve una copia de respaldo.
