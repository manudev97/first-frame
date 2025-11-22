# FirstFrame - Resumen del Proyecto

## 🎯 Nombre del Proyecto

**FirstFrame** - Protección de Propiedad Intelectual para Contenido Audiovisual en Telegram

## 📋 Descripción

FirstFrame es una aplicación Telegram Mini App (TWA) que protege la propiedad intelectual de videos de películas y series mediante blockchain Story Protocol. El sistema gamifica el acceso mediante rompecabezas interactivos basados en pósteres de IMDB, donde los primeros usuarios en resolver el puzzle obtienen acceso exclusivo y registran el póster como un IP derivado en la blockchain.

## 🎨 Paleta de Colores

- **Morado Principal**: `#8B5CF6`
- **Verde Lila**: `#A78BFA`
- **Morado Claro**: `#C4B5FD`
- **Fondo Oscuro**: `#0F0F23`
- **Superficie**: `#1A1A2E`

## 🏗️ Arquitectura

### Componentes Principales

1. **Telegram Bot** (`src/bot/`)
   - Comandos: `/start`, `/upload`, `/puzzle`, `/profile`, `/claim`, `/report`
   - Lanza la Mini App mediante botones inline

2. **Backend API** (`src/backend/`)
   - Integración con Story Protocol SDK
   - API de IMDB para metadatos
   - Sistema de generación de puzzles
   - Gestión de IPFS para metadata

3. **Frontend Mini App** (`webapp/`)
   - React + Vite + TypeScript
   - Sistema de puzzle interactivo
   - Integración con Telegram WebApp SDK
   - Integración con Halliday Payments

## 🔄 Flujos Principales

### 1. Registro de Video Original
1. Usuario sube video o link
2. Sistema obtiene metadata de IMDB (título, año, póster)
3. Se crea metadata y se sube a IPFS
4. Se registra como IP Asset en Story Protocol con licencia PIL
5. Se genera puzzle del póster

### 2. Gamificación con Puzzle
1. Usuario accede al puzzle desde la Mini App
2. Resuelve el rompecabezas del póster
3. Si es de los primeros, obtiene acceso al canal privado
4. El póster se registra automáticamente como IP derivado

### 3. Sistema de Regalías
1. Cuando se genera ingreso por un IP derivado
2. Las regalías se distribuyen automáticamente según PIL
3. El dueño original puede reclamar sus regalías
4. Sistema de disputas para infracciones

## 🔧 Tecnologías Utilizadas

- **Frontend**: React, Vite, TypeScript, Telegram WebApp SDK
- **Backend**: Node.js, Express, TypeScript
- **Blockchain**: Story Protocol SDK, viem, ethers
- **Storage**: IPFS (Pinata)
- **APIs**: OMDB (IMDB), Halliday Payments
- **Bot**: Telegraf (Telegram Bot Framework)

## 📦 Instalación y Uso

```bash
# Instalar dependencias
npm install
cd webapp && npm install && cd ..

# Configurar variables de entorno
cp env.example .env
# Editar .env con tus credenciales

# Desarrollo
npm run dev

# Producción
npm run build
npm start
```

## 🎮 Características Principales

✅ Registro de IP en Story Protocol
✅ Sistema de rompecabezas gamificado
✅ Integración con IMDB para pósteres
✅ Gestión automática de regalías
✅ Sistema de disputas para infracciones
✅ Integración con Halliday para pagos sin fricción
✅ UI moderna con colores morado y verde lila
✅ Experiencia Web3 sin fricciones (gasless)

## 🚀 Próximos Pasos

1. Integración completa con Verse8 para crear juegos a partir de IPs
2. Sistema de base de datos para persistencia
3. Dashboard de administración
4. Sistema de notificaciones
5. Analytics y métricas

## 📝 Notas de Desarrollo

- El proyecto está optimizado para ser conciso y eficiente
- Se eliminan logs innecesarios en producción
- Código modular y reutilizable
- Documentación completa en `/docs`

## 🤝 Contribución

Este proyecto fue desarrollado para el Hackathon de Encode de Story Protocol.

