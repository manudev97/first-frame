# FirstFrame 🎬

**FirstFrame** is a Telegram Mini App that protects intellectual property of audiovisual content through Story Protocol blockchain, gamifying access through interactive puzzles.

## 🎯 Problem It Solves

### The Challenge on Telegram

Telegram is an extremely popular platform for sharing content, but this has created a critical problem:

- **Massive penalties**: Streaming platforms and digital distributors constantly report users and channels that share movies and series videos publicly
- **Channel closures**: Thousands of channels are penalized or closed for sharing unauthorized content
- **Loss of access**: Users lose access to valuable content due to these penalties
- **Lack of monetization**: Creators and distributors don't receive compensation for the use of their content

### FirstFrame's Solution

**FirstFrame solves this problem through a coordinated royalty system:**

✅ **IP Registration on Blockchain**: Each video is registered as intellectual property on Story Protocol, creating an immutable record of authorship

✅ **Automatic Royalty System**: When users share content, royalties are automatically paid to rights holders through smart contracts

✅ **Controlled Access**: Videos are shared in private channels, accessible only after solving a puzzle, reducing the risk of penalties

✅ **Fair Monetization**: Creators and distributors receive compensation for the use of their content, encouraging collaboration instead of penalties

**Result**: If there was a way to pay coordinated royalties for copyright usage, these penalties might not occur. FirstFrame implements exactly this solution on Story Protocol, allowing Telegram to remain an easy platform to share content while respecting copyright and compensating creators.

## 🎯 Features

- ✅ IP registration on Story Protocol for original videos
- 🧩 Gamified puzzle system based on IMDB posters
- 💰 Automatic royalty and license management
- 🛡️ Dispute and penalty system for infringements
- 🎮 Integration with Verse8 to create games from IPs
- 💳 Integration with Halliday for frictionless payments
- 🎨 Modern UI with purple and lilac green colors

## 🏗️ Architecture

```
FirstFrame/
├── src/
│   ├── bot/           # Telegram Bot
│   ├── backend/       # API Backend
│   └── shared/       # Shared utilities
├── webapp/            # Mini App Frontend (React)
└── docs/              # Documentation
```

## 🚀 Installation

```bash
# Install dependencies
npm install

# Install webapp dependencies
cd webapp && npm install && cd ..

# Configure environment variables
cp env.example .env
# Edit .env with your credentials
```

## 🔧 Configuration

1. **Telegram Bot:**
   - Create a bot with [BotFather](https://t.me/botfather)
   - Get the token and configure it in `.env`
   - **IMPORTANT:** Telegram requires HTTPS for Mini Apps. See [docs/HTTPS_SETUP.md](docs/HTTPS_SETUP.md) to configure an HTTPS tunnel for development

2. **Story Protocol:**
   - Get your Story Protocol credentials
   - Configure `STORY_RPC_URL`, `STORY_CHAIN_ID` and `STORY_PRIVATE_KEY`
   - Configure `STORY_SPG_NFT_CONTRACT`:
     - **Option 1 (Recommended)**: Create your own contract with `npm run get-spg-contract` (more control, better for marketplace)
     - **Option 2**: Use the public testnet contract: `0xc32A8a0FF3beDDDa58393d022aF433e78739FAbc`
   - See [docs/CREAR_CONTRATO_PROPIO.md](docs/CREAR_CONTRATO_PROPIO.md) for more details

3. **IMDB API:**
   - Get an API key from [OMDB](http://www.omdbapi.com/apikey.aspx)
   - Configure it in `.env` (key only, not the full URL)

4. **IPFS (Optional for development):**
   - For production, configure `PINATA_API_KEY` and `PINATA_SECRET_KEY`
   - In development, simulated URIs are used if not configured

5. **Halliday (Optional):**
   - Get your Halliday API key
   - Configure it in `.env`

## 🎮 Usage

```bash
# Development (runs bot, backend and webapp)
npm run dev

# Bot only
npm run dev:bot

# Backend only
npm run dev:backend

# Webapp only
npm run dev:webapp
```

## 📱 Bot Commands

- `/start` - Start session
- `/upload` - Upload a video for registration
- `/puzzle` - Play puzzle
- `/profile` - View profile and registered IPs
- `/claim` - Claim royalties
- `/report` - Report infringement

## 📄 License

MIT
