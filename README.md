# xerTransfer ⚡

**P2P Local File & Folder Transfer Web App**  
**Creator:** Mayank Mandrai

---

## Features
- **Zero Limits**: Unlimited file size & folder transfer powered by WebRTC (PeerJS).
- **Chunked Transfer**: Safe 64KB chunking with backpressure to prevent browser memory crashes on multi-GB files.
- **PIN & QR Pairing**: Fast 4-digit PIN or instant QR scan to establish a direct P2P link.
- **Liquid Glass UI**: Ultra-clean frosted glassmorphism with dynamic ambient light.
- **Glass On/Off Toggle**: Instant performance switch to solid mode for low-power devices.
- **3 Dynamic Themes**: Dark (Default), Light, and Neon (Cyberpunk).
- **Folder Tree Preservation**: Retains folder structure during transfer.

---

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open `http://localhost:3000` in your browser.

---

## Deployment

### 1. Render (Full Backend + Signaling)
- Repository ko Render par connect karein.
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- Render URL par aapka app 24/7 chalega with embedded PeerServer.

### 2. GitHub Pages (Static Frontend)
- Repository settings me jaakar **GitHub Pages** enable karein.
- Source branch `main` aur root `/` select karein.
- Frontend directly public PeerJS cloud stun servers ke saath direct P2P transfer chalayega.
