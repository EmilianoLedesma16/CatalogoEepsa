# Catálogo Interactivo EEPSA

Bienvenido al repositorio del Catálogo de Productos y Asistente Virtual (Nexi) de EEPSA.
Este proyecto es un monorepo que contiene tanto el Frontend (React) como el Backend (Node.js/Express) y la Base de Datos (PostgreSQL), todo orquestado fácilmente mediante Docker.

## 🚀 Requisitos Previos

Para desarrollar y correr este proyecto en tu entorno local solo necesitas dos cosas:
1. [Git](https://git-scm.com/) (para clonar el repositorio).
2. [Docker Desktop](https://www.docker.com/products/docker-desktop/) (debe estar corriendo en tu computadora).

No necesitas instalar Node.js ni PostgreSQL localmente, Docker se encargará de todo.

## 🛠️ Cómo iniciar el proyecto por primera vez

Sigue estos pasos para levantar el entorno de desarrollo:

### 1. Clonar el repositorio
```bash
git clone https://github.com/BzSaur/CatalogoEepsa.git
cd CatalogoEepsa
```

### 2. Configurar la carpeta de imágenes locales
El backend necesita una carpeta de donde servir las imágenes del catálogo. Esta carpeta está ignorada en Git por su peso, así que debes crearla:

- Crea una ruta de carpetas llamada `assets/img/` en la raíz del proyecto.
- Coloca cualquier imagen de prueba dentro de `assets/img/` (por ejemplo, `prueba1.jpg`).
- *Nota: Si no haces esto, Docker creará la carpeta automáticamente, pero estará vacía y los productos no tendrán fotos.*

### 3. Levantar los contenedores
Asegúrate de que Docker Desktop esté abierto y ejecuta:

```bash
docker-compose up -d --build
```

¡Eso es todo! Docker descargará las imágenes, instalará las dependencias (Node_modules), creará la base de datos e inyectará los datos semilla (sembrado) automáticamente.

## 🔗 Conexión con el SINV (inventario)

El catálogo **ya no tiene inventario ni precios propios**: los toma del SINV (Sistema de Inventario RAM3) en tiempo real, y las cotizaciones se crean allá con folio `EEPSA-###`, donde Telemarketing las recibe al instante.

```
Navegador ──/api/productos, /api/categorias, /api/cotizaciones──► backend (este repo)
                                     │ API key + firma HMAC (servidor a servidor)
                                     ▼
                     SINV /api/v1/integrations/eepsa/v1/*
```

Variables del backend (en `.env`, **nunca en git**; las llaves se piden al equipo del SINV por canal seguro):

```env
SINV_BASE_URL=http://host.docker.internal:3000   # local: SINV corriendo en tu máquina · prod: https://sinv.<dominio>
SINV_API_KEY=...                                  # = EEPSA_API_KEY del SINV
SINV_HMAC_SECRET=...                              # = EEPSA_HMAC_SECRET del SINV
```

- `GET /api/productos[?tags=Línea,Categoría]` y `GET /api/categorias`: catálogo del SINV (caché de 5 s; si el SINV no responde se sirve la última copia).
- `POST /api/cotizaciones` `{ idempotencyKey, cart:[{sku,cantidad}], contacto:{nombre, telefono|correo, empresa?, notas?} }` → `{ folio }`. Reintentar con la misma `idempotencyKey` no duplica.
- Si el SINV está caído, la cotización se guarda en la tabla `cola_sinv` y se reenvía sola cada minuto (respuesta `202` con `referencia`). Revisar `estado = 'RECHAZADA'` a mano.
- `GET /api/cotizaciones/EEPSA-###`: estado público (sin datos del cliente). `GET /api/health`: conectividad con el SINV y pendientes en cola.
- Los servidores del catálogo y del SINV deben tener la hora sincronizada (NTP): la firma tolera ±5 min.

## 🌐 URLs de Acceso

- **Frontend (Aplicación Web):** [http://localhost](http://localhost)
- **Backend (API):** [http://localhost:3001](http://localhost:3001)
- **Base de Datos:** Puerto `5432` (Usuario: `eepsa_user` | Pass: `eepsa_password` | BD: `eepsa_catalog`)

## 💻 Entorno de Desarrollo y Hot-Reload

El proyecto está configurado para tener una experiencia de desarrollo fluida (Hot Module Replacement activado con Polling para Windows).

- Cualquier cambio que hagas en los archivos dentro de la carpeta `frontend/src/` se verá reflejado **instantáneamente** en el navegador al guardar (sin necesidad de reiniciar Docker).
- Cualquier cambio que hagas en el código del `backend/` o en el archivo `docker-compose.yml` sí requerirá que reconstruyas el contenedor correspondiente:
  ```bash
  docker-compose up -d --build backend
  ```

## 📂 Estructura del Proyecto

```text
CatalogoEepsa/
├── frontend/           # Proyecto React (Vite + Tailwind CSS + Framer Motion)
├── backend/            # API REST (Node.js + Express + pg)
├── db/                 # Archivos SQL (init.sql se corre automáticamente al crear la BD)
├── assets/img/         # (Carpeta local ignorada en git para imágenes de prueba)
├── docker-compose.yml  # Orquestador de servicios
└── README.md           # Este archivo
```

## ✨ Mejoras UI/UX Recientes (Versión Actual)

La aplicación ha recibido una importante capa de pulido visual y de experiencia de usuario:
- **Catálogo Fluido:** Se implementó `AnimatePresence (wait)` de Framer Motion en la cuadrícula de productos, eliminando deformaciones al filtrar categorías y ofreciendo transiciones suaves de "fade-out/fade-in".
- **Asistente Virtual Mejorado:** Aumento de legibilidad en los mensajes de chat. Las opciones de respuestas rápidas ahora tienen un diseño resaltado (borde y fondo turquesa) que impide que se pierdan visualmente en la conversación.
- **Carrusel de Productos (Nexi):** Las flechas de navegación del carrusel en el chat fueron re-centradas a la mitad de las tarjetas para una interacción más ergonómica.
- **Branding en Alta Calidad:** Se integró el logotipo vectorizado de EEPSA (`LogoEepsaVectorizado.png`) tanto en la barra de navegación principal como en el Favicon (`index.html`), asegurando máxima nitidez en cualquier resolución.

## 🧹 Comandos Útiles

**Ver los logs (errores/consolas) de todos los servicios:**
```bash
docker-compose logs -f
```

**Reiniciar la base de datos desde cero (Borra los volúmenes y vuelve a correr init.sql):**
```bash
docker-compose down -v
docker-compose up -d --build db
```
