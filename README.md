# XerTransfer — Instant File Transfer

Transfer files, photos, documents, and entire folders instantly between any device — no size limits, no cables, no signup. Powered by WebRTC direct peer-to-peer technology.

**Made by Mayank Mandrai**

---

## Features

- **Instant Transfer (Turbo Engine)** — Raw WebRTC DataChannel streaming with in-memory buffer slicing
- **Folder Upload & Transfer** — Upload entire folders with subdirectories preserved
- **No Size Limits** — Send files of any size (100MB, 10GB, 100GB+)
- **End-to-End Encrypted** — WebRTC DTLS encryption keeps your data 100% private
- **Cross Platform** — Works on Android, iOS (iPhone/iPad), Windows, Mac, Linux
- **QR Code & 6-Digit Code** — Quick pairing with receiver device
- **Connection Diagnostics** — Real-time detection of Direct P2P vs Relayed network connections
- **100% Free** — No signup, no server costs, 24/7 online

## 🛠️ Tech Stack

- **Frontend**: HTML, CSS, JavaScript (no framework)
- **P2P Transfer**: [PeerJS](https://peerjs.com/) (WebRTC)
- **QR Code**: [QRCode.js](https://github.com/davidshimjs/qrcodejs) + [html5-qrcode](https://github.com/mebjas/html5-qrcode)
- **Hosting**: Vercel (static deployment)

## 🚀 How It Works

1. **Sender** opens XerTransfer and selects files
2. A unique **6-digit code** and **QR code** is generated
3. **Receiver** enters the code or scans the QR code
4. Files transfer **directly** via WebRTC — no server involved
5. Both devices must have the page open during transfer

## 📦 Deploy to Vercel (Free)

### Step 1: Push to GitHub

```bash
cd xertransfer
git init
git add .
git commit -m "Initial commit - XerTransfer"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/xertransfer.git
git push -u origin main
```

### Step 2: Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub
2. Click **"Add New Project"**
3. Import your `xertransfer` repository
4. Framework Preset: **Other** (it's a static site)
5. Click **Deploy**
6. Your site is live at `https://xertransfer.vercel.app` (or similar)

### Alternative: Deploy with Vercel CLI

```bash
npm i -g vercel
cd xertransfer
vercel --prod
```

## 🌐 Deploy to GitHub Pages (Alternative)

1. Push code to GitHub
2. Go to repo **Settings** → **Pages**
3. Source: **Deploy from a branch**
4. Branch: `main`, folder: `/ (root)`
5. Click **Save**
6. Your site is live at `https://YOUR_USERNAME.github.io/xertransfer`

## 📝 Important Notes

- Both sender and receiver must keep the page open during transfer
- Works best when both devices are on the same network (fastest speed)
- Works across different networks too (via STUN servers)
- No files are stored on any server — everything is peer-to-peer
- Uses PeerJS cloud for signaling (connection setup only, not file data)

## 📄 License

MIT License — Free to use, modify, and distribute.

---

Made with ❤️ by **Mayank Mandrai**
