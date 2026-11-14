# F1 · Catálogo público y autenticación por roles

## Historia
Como visitante de JM Barber Studio, quiero explorar el catálogo de servicios con sus precios y tiempos en la página de inicio, y poder registrarme o iniciar sesión para que el sistema me dirija automáticamente a mi panel según mi rol (`cliente`, `barbero` o `admin`).

## Comportamiento
1. En la página principal (`/`), el usuario visualiza la barra superior con acceso a **Iniciar sesión** (`/login`) y **Reservar Cita** (`/registro`) y la cuadrícula de hasta 6 servicios activos con foto, nombre, precio en COP, descripción y duración.
2. Al hacer clic en cualquier tarjeta de servicio o en **Reservar**, el sistema redirige a `/login` conservando en la URL el destino (`/cliente#booking-flow`) y el `serviceId` seleccionado.
3. En `/login`, el usuario ingresa su correo y su contraseña (Supabase Auth no inicia sesión con teléfono); el Server Action `loginAction` valida las credenciales y redirige a `/admin` si el rol es `admin` o `barbero`, o a `/cliente` si es `cliente` (respetando `return_url` cuando aplica).
4. En `/registro`, el cliente completa nombre, apellido, correo, teléfono (+57), contraseña y confirmación; al enviarlo, `registerAction` crea la cuenta, inicia sesión automáticamente y redirige a `/cliente`.
5. El middleware (`lib/supabase/proxy.ts`) bloquea el acceso sin sesión a `/cliente` y `/admin` redirigiendo a `/login`, e impide que un usuario con rol `cliente` entre a rutas bajo `/admin`.

## Criterios de aceptación
- [ ] En `/` se muestran únicamente los servicios marcados como activos (`is_active = true`), cada uno con su nombre, descripción, duración y precio formateado en pesos colombianos (ej. `$ 25.000`).
- [ ] Al intentar navegar a `/cliente` o `/admin` sin haber iniciado sesión, el navegador redirige automáticamente a `/login` incluyendo el parámetro `return_url`.
- [ ] Si en `/login` se envían credenciales incorrectas, se muestra en pantalla un recuadro de error con el texto `"Credenciales incorrectas. Verifica tu correo y contraseña o regístrate si aún no tienes cuenta."` sin recargar ni perder la página.
- [ ] En `/registro`, si las contraseñas ingresadas no coinciden, se muestra el mensaje `"Las contraseñas no coinciden."` y no se crea el usuario.
- [ ] Si un usuario autenticado con rol `cliente` intenta abrir `/admin` en la barra de direcciones, es redirigido inmediatamente a `/cliente`.
- [ ] La portada (`/`) no muestra ningún botón hacia el panel administrativo. El admin y el barbero entran con **Iniciar sesión** y la app los lleva a `/admin` según su rol.
- [ ] En el menú del perfil (arriba a la derecha), la opción **"Panel Principal"** solo aparece para `admin` y `barbero`. Un `cliente` no la ve. *(Pedido del estudiante: los clientes no necesitan ese acceso.)*

### Criterios con Supabase conectado [Back]
- [ ] [Back] Al registrarse en `/registro`, aparece un usuario nuevo en Supabase → Authentication y una fila en `profiles` con `role = 'cliente'`.
- [ ] [Back] La cuenta creada puede iniciar sesión desde otro navegador o dispositivo con el mismo correo y contraseña.
- [ ] [Back] Con Supabase conectado, la portada `/` carga el catálogo sin errores para un visitante sin sesión y para un usuario con sesión de cada rol.
- [ ] [Back] Un usuario promovido a `admin` en la tabla `profiles` entra a `/admin` en su siguiente visita, y un `cliente` sigue siendo redirigido a `/cliente` aunque tenga una cookie `jm_user_session=user-admin`.
- [ ] [Back] Un servicio desactivado en la tabla `services` (`is_active = false`) deja de aparecer en `/` tras recargar.

## Fuera de alcance
Inicio de sesión con proveedores OAuth externos (Google/Facebook) y recuperación automática de contraseña por correo sin Supabase Auth.
