# F# · Nombre de la funcionalidad

> Plantilla para nuevas specs. Copia este archivo como `F#-nombre-corto.md`, llénalo antes de escribir código y regístralo en `docs/tareas.md`.

## Historia
Como **[cliente | barbero | admin]**, quiero **[acción]** para **[beneficio]**.

## Comportamiento
1. Ruta y pantalla donde ocurre (`/ruta`), y componente principal (`components/<dominio>/Nombre.tsx`).
2. Qué ve el usuario al entrar.
3. Qué hace y qué Server Action o consulta se usa (ver `docs/contratos/api.md`).
4. Qué cambia en pantalla después.

## Criterios de aceptación
Cada criterio se comprueba en el navegador con un **sí** o un **no**. Nada de "rápido", "bonito" o "intuitivo".
- [ ] En `/ruta`, al [acción concreta], se muestra [resultado observable exacto, con texto literal si aplica].
- [ ] Si [dato inválido o caso límite], se muestra el mensaje `"..."` y no se guarda nada.
- [ ] Un usuario con rol [rol no permitido] que abre `/ruta` es redirigido a [ruta].

### Criterios con Supabase conectado [Back]
- [ ] [Back] El cambio se conserva al recargar y al entrar desde otro navegador.
- [ ] [Back] Un usuario sin permiso no puede ver ni modificar estos datos (RLS).

## Fuera de alcance
Lo que esta funcionalidad **no** hace en el MVP (revisar "Fuera del MVP" en `docs/producto.md`).
