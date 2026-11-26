# NOVA MARKET

Sistema local para la gestión de minimarket con frontend React/Vite, API Express y PostgreSQL. Conserva la arquitectura y las relaciones descritas en `docs/ARQUITECTURA.md` y `docs/MODELO-Y-DECISIONES.md`.

## Requisitos

- Windows 10/11 con Docker Desktop iniciado y acceso al engine.
- Node.js 20 o superior y Corepack (incluido con Node).
- pnpm 10.34.3, fijado en los `package.json`; se puede invocar con `corepack pnpm`.
- PostgreSQL no necesita instalarse localmente: Compose ejecuta PostgreSQL 16.
- Para usar respaldos desde la API, instala herramientas cliente PostgreSQL (`pg_dump`, `pg_restore`) y agrégalas a `PATH`.

## Preparación inicial

Abre PowerShell en la carpeta raíz del proyecto. Instala las dependencias siguiendo los lockfiles existentes:

```powershell
cd backend
corepack pnpm install --frozen-lockfile
Copy-Item .env.example .env
cd ..\frontend
corepack pnpm install --frozen-lockfile
Copy-Item .env.example .env
cd ..
Copy-Item .env.example .env
```

Edita los dos archivos `.env` (raíz y `backend`) antes de iniciar. Define el mismo `DB_PASSWORD` fuerte y local en ambos; en `backend/.env` también define un `JWT_SECRET` aleatorio de al menos 24 caracteres, `SEED_ADMIN_PASSWORD` de al menos 8 caracteres y `DEMO_USER_PASSWORD` para la cuenta local de demostración. Esa cuenta solo se crea fuera de producción. Son configuraciones locales, no guardes esos archivos en el proyecto compartido. `DATABASE_URL` puede quedar vacío; si se configura prevalece sobre `DB_*`.

## PostgreSQL

Desde la raíz:

```powershell
docker compose up -d
docker compose ps
docker compose logs postgres
```

El servicio `postgres` publica el puerto de `DB_PORT` (5432 por defecto), reporta salud mediante `pg_isready` y mantiene los datos en el volumen nombrado `nova-market-postgres-data`. El backend ejecutado en Windows usa `DB_HOST=localhost`; otro contenedor conectado a `nova-market-network` debe usar `DB_HOST=postgres` y puerto 5432.

En esta computadora NOVA MARKET usa actualmente `DB_PORT=5433` porque otro contenedor ya ocupa 5432. Ese ajuste está en los `.env` locales; los `.env.example` mantienen el valor estándar 5432.

Para apagar PostgreSQL conservando los datos:

```powershell
docker compose down
```

No uses `docker compose down -v` si quieres conservar el volumen.

## Migraciones, datos de demostración y API

En una terminal PowerShell:

```powershell
cd backend
corepack pnpm migrate
corepack pnpm seed
corepack pnpm dev
```

Las migraciones se aplican en orden y registran cada archivo para no repetirlo. El seed es idempotente y usa registros ficticios; la contraseña común de los usuarios locales la toma de `SEED_ADMIN_PASSWORD`. La cuenta de demostración local `yimi` usa `DEMO_USER_PASSWORD`; esa variable no se incluye en este documento ni en el ejemplo con un valor.

Health check: <http://localhost:4000/api/health>. Una respuesta 200 confirma API y PostgreSQL; 503 indica que la API está activa pero la base no responde.

### Fixtures de demostración

Desde `backend`, ejecuta `corepack pnpm seed:demo` para cargar fixtures locales de catálogo, alertas, compras, venta, caja y comprobante. El comando usa identificadores `DEMO` / `DEMO-SEED`, no reinicia el stock existente y puede repetirse. Crea el usuario `demo_cajero` en desarrollo usando el valor local de `DEMO_USER_PASSWORD`; no documentes esa contraseña ni la uses en producción. La caja demo puede quedar abierta para probar el POS; ciérrala desde la aplicación al terminar. La serie `D001` y el comprobante de muestra son locales y no se envían ni se aceptan en SUNAT.

## Frontend

En otra terminal:

```powershell
cd frontend
corepack pnpm dev
```

Abre <http://localhost:5173>. `frontend/.env` usa `VITE_API_URL=http://localhost:4000/api`; actualízala si cambias el puerto del backend. El backend permite ese origen mediante `CORS_ORIGINS`.

## Pruebas y build

```powershell
cd backend
corepack pnpm test
cd ..\frontend
corepack pnpm test
corepack pnpm build
```

Las pruebas backend usan `pg-mem`; no sustituyen la validación contra un PostgreSQL real. El health check del API valida la conexión activa.

Con PostgreSQL y backend iniciados, comprueba la conexión real API → PostgreSQL con:

```powershell
cd backend
corepack pnpm test:smoke
```

## Respaldos

Define `BACKUP_DIR` en `backend/.env` (por defecto `./backups`, ignorado por Git) e instala `pg_dump` y `pg_restore`. El respaldo se solicita desde la API autenticada de administración; las herramientas reciben la contraseña mediante `PGPASSWORD`, sin imprimirla. La restauración ejecuta `pg_restore --clean --if-exists`, por lo que reemplaza los objetos incluidos en el respaldo. Solo restaures intencionalmente sobre una base cuyo contenido quieras reemplazar. Conserva también una copia externa del archivo `.dump`.

## Problemas habituales

- **Docker engine no disponible:** inicia Docker Desktop y espera que indique que está ejecutándose; `docker info` debe mostrar versión del servidor.
- **Puerto 5432 ocupado:** cambia `DB_PORT` en el `.env` raíz y `DB_PORT` en `backend/.env` al mismo puerto publicado. Compose mantiene 5432 dentro de la red.
- **Error de autenticación PostgreSQL:** asegúrate de que `DB_PASSWORD`, `DB_NAME` y `DB_USER` coincidan entre los dos `.env`. Si un volumen anterior ya fue inicializado con otras credenciales, cambiar el `.env` no cambia las credenciales guardadas; no borres el volumen para “arreglarlo”.
- **Error de conexión del backend:** confirma que `docker compose ps` muestre `healthy`, `DB_HOST=localhost` y que las migraciones se hayan aplicado.
- **pnpm no está en PATH:** usa `corepack pnpm` desde la carpeta del paquete, con Corepack instalado junto a Node.js.
- **CORS:** confirma que `CORS_ORIGINS` incluya el origen real del frontend.

## Funcionalidades e integraciones

El estado por funcionalidad sigue el Excel `docs/NOVA_MARKET_Inventario_y_Plan_Actualizacion.xlsx`. SUNAT, RENIEC y pasarelas financieras permanecen deshabilitadas si no hay proveedor y credenciales configurados; no se declara aceptación externa real. Las decisiones de negocio pendientes están en `docs/PENDIENTES.md`.

## Documentación

- [Arquitectura](docs/ARQUITECTURA.md)
- [API y roles](docs/API.md)
- [Modelo y decisiones](docs/MODELO-Y-DECISIONES.md)
- [Pruebas](docs/PRUEBAS.md)
- [Auditoría funcional F01–F37](docs/AUDITORIA-FUNCIONAL.md)
- [Pendientes y progreso](docs/PENDIENTES.md)
