# FirstFrame 🎬

**FirstFrame** es una aplicación Telegram Mini App que protege la propiedad intelectual de contenido audiovisual mediante blockchain Story Protocol, gamificando el acceso mediante rompecabezas interactivos.

## 🎯 Características

- ✅ Registro de IP en Story Protocol para videos originales
- 🧩 Sistema de rompecabezas gamificado basado en pósteres de IMDB
- 💰 Gestión automática de regalías y licencias
- 🛡️ Sistema de disputas y penalizaciones para infracciones
- 🎮 Integración con Verse8 para crear juegos a partir de IPs
- 💳 Integración con Halliday para pagos sin fricción
- 🎨 UI moderna con colores morado y verde lila

## 🏗️ Arquitectura

```
FirstFrame/
├── src/
│   ├── bot/           # Bot de Telegram
│   ├── backend/       # API Backend
│   └── shared/        # Utilidades compartidas
├── webapp/            # Mini App Frontend (React)
└── docs/              # Documentación
```

## 🚀 Instalación

```bash
# Instalar dependencias
npm install

# Instalar dependencias de la webapp
cd webapp && npm install && cd ..

# Configurar variables de entorno
cp env.example .env
# Editar .env con tus credenciales
```

## 🔧 Configuración

1. **Telegram Bot:**
   - Crea un bot con [BotFather](https://t.me/botfather)
   - Obtén el token y configúralo en `.env`
   - **IMPORTANTE:** Telegram requiere HTTPS para Mini Apps. Ver [docs/HTTPS_SETUP.md](docs/HTTPS_SETUP.md) para configurar un túnel HTTPS en desarrollo

2. **Story Protocol:**
   - Obtén tus credenciales de Story Protocol
   - Configura `STORY_RPC_URL`, `STORY_CHAIN_ID` y `STORY_PRIVATE_KEY`
   - Configura `STORY_SPG_NFT_CONTRACT`:
     - **Opción 1 (Recomendada)**: Crea tu propio contrato con `npm run get-spg-contract` (más control, mejor para marketplace)
     - **Opción 2**: Usa el contrato público de testnet: `0xc32A8a0FF3beDDDa58393d022aF433e78739FAbc`
   - Ver [docs/CREAR_CONTRATO_PROPIO.md](docs/CREAR_CONTRATO_PROPIO.md) para más detalles

3. **IMDB API:**
   - Obtén una API key de [OMDB](http://www.omdbapi.com/apikey.aspx)
   - Configúrala en `.env` (solo la key, no la URL completa)

4. **IPFS (Opcional para desarrollo):**
   - Para producción, configura `PINATA_API_KEY` y `PINATA_SECRET_KEY`
   - En desarrollo, se usan URIs simuladas si no está configurado

5. **Halliday (Opcional):**
   - Obtén tu API key de Halliday
   - Configúrala en `.env`

## 🎮 Uso

```bash
# Desarrollo (ejecuta bot, backend y webapp)
npm run dev

# Solo bot
npm run dev:bot

# Solo backend
npm run dev:backend

# Solo webapp
npm run dev:webapp
```

## 📱 Comandos del Bot

- `/start` - Iniciar sesión
- `/upload` - Subir un video para registro
- `/puzzle` - Jugar rompecabezas
- `/profile` - Ver perfil y IPs registrados
- `/claim` - Reclamar regalías
- `/report` - Reportar infracción

## 📄 Licencia

MIT

