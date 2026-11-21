# Despliegue del Backend Spring Boot en Render · JM Barber Studio

> Guía operativa (tarea `4.15`) para publicar `backend/` (Spring Boot 4.2 + Java 21) en **Render (plan Free)** y conectarlo al frontend en **Vercel**, manteniendo total compatibilidad con el flujo de trabajo en local y las migraciones Flyway (`V1`, `V2`, `V3`).

---

## 1. Requisitos previos (sin exponer secretos)

Render ejecuta el contenedor Docker (`backend/Dockerfile`) en su plan Free (`512 MB RAM`), pero **no incluye MySQL gratuito**. Necesitas dos piezas:
1. **Base de datos MySQL 8 en la nube** (elige una):
   - **Opción A · MySQL 8 estándar (cero cambios en migraciones):** Railway MySQL, AWS RDS MySQL (capa gratuita / AWS Academy) o un servidor MySQL 8 administrado. Las migraciones `V1`, `V2` y `V3` corren tal cual sin ajustes.
   - **Opción B · TiDB Cloud Serverless (\$0 sin tarjeta):** compatible con protocolo MySQL. *Nota técnica:* antes de usarlo, verifica en tu clúster que soporte `utf8mb4_0900_ai_ci` y la columna generada `STORED` de `V1`; añade `?sslMode=VERIFY_IDENTITY&useSSL=true&serverTimezone=America/Bogota` en `DB_URL`.
2. **Cuenta en Render** (https://render.com, inicia sesión con tu GitHub).

---

## 2. Subir el backend a Render (2 formas)

### Forma rápida (Blueprint automático con `render.yaml`)
1. En Render → **New +** → **Blueprint**.
2. Selecciona el repositorio `juanramosnn17/jm-barber-studio` (rama `main`).
3. Render detecta `render.yaml` (`rootDir: backend`, `Dockerfile`, `healthCheckPath: /api/v1/health`) y te pide las 4 variables secretas (`sync: false`):

| Variable | Ejemplo / Descripción |
|---|---|
| `DB_URL` | `jdbc:mysql://<HOST>:<PUERTO>/<BASE>?serverTimezone=America/Bogota&useSSL=true` |
| `DB_USER` | Usuario de la base MySQL remota |
| `DB_PASSWORD` | Contraseña del usuario MySQL remoto |
| `JWT_SECRET` | Secreto aleatorio de **mínimo 32 caracteres** (nunca lo subas a Git) |

### Forma manual (Web Service)
1. Render → **New +** → **Web Service** → conecta `juanramosnn17/jm-barber-studio`.
2. **Root Directory:** `backend` · **Language / Runtime:** `Docker` · **Instance Type:** `Free`.
3. **Health Check Path:** `/api/v1/health`.
4. Agrega las 4 variables de entorno de la tabla anterior + `TZ=America/Bogota`.
5. Pulsa **Create Web Service**.

---

## 3. Verificación del despliegue en Render

1. Espera a que el build de Docker termine (el primer build tarda 3–5 min mientras Maven descarga dependencias; los siguientes son más rápidos).
2. Al arrancar, **Flyway aplica automáticamente `V1`, `V2` y `V3`** en la base remota y carga el horario y los 6 servicios semilla.
3. Abre en tu navegador:
   ```text
   https://<tu-servicio>.onrender.com/api/v1/health
   ```
   Debe responder `200 OK`:
   ```json
   {"service":"jm-barber-api","status":"ok"}
   ```
4. Prueba el catálogo público:
   ```text
   https://<tu-servicio>.onrender.com/api/v1/services
   ```
   Debe devolver los 6 servicios activos en JSON.

---

## 4. Conectar Vercel al backend de Render y crear el primer Admin

1. En **Vercel** → proyecto `jm-barber-studio` → **Settings → Environment Variables**:
   - Agrega **`API_URL`** = `https://<tu-servicio>.onrender.com` (**sin** barra `/` al final y **sin** prefijo `NEXT_PUBLIC_`, porque es una variable solo del servidor).
2. En Vercel → **Deployments** → **Redeploy** sobre el último despliegue de `main`.
3. Abre `https://jm-barber-studio-delta.vercel.app/registro` y registra tu cuenta de administrador.
4. En tu cliente SQL conectado a la base MySQL remota, promueve esa cuenta a `ADMIN`:
   ```sql
   UPDATE users SET role = 'ADMIN' WHERE email = 'tu-correo@ejemplo.com';
   ```
5. Recarga la app: al iniciar sesión entrarás directo a `/admin` y `/admin/contabilidad/ganancias` usando Spring Boot + MySQL en la nube.

---

## 5. Consideraciones del plan Free de Render
- **Hibernación por inactividad:** tras 15 minutos sin tráfico, Render apaga el contenedor. La primera petición después de dormir tarda entre **30 y 60 segundos** mientras arranca Java/Spring Boot. Antes de una demo o sustentación, abre `/api/v1/health` 1 minuto antes para despertarlo.
- **Límite de memoria (512 MB):** `backend/Dockerfile` configura `-XX:+UseContainerSupport -XX:MaxRAMPercentage=70.0` para evitar errores `OutOfMemoryError` dentro del contenedor.
- **Seguridad:** `backend/.dockerignore` excluye `.env`, `target/` y `scripts/`, garantizando que ninguna credencial local entre en la imagen Docker.
