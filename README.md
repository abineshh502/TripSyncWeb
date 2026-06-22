# TripSyncWeb — Standalone Frontend App

This is the standalone React/Next.js frontend application for **TripSync**. It is completely portable and can be run independently of the original workspace structure.

---

## 🛠️ System Requirements
* **Node.js:** `v18.17.0` or higher (Recommended: `v20.x` or latest LTS)
* **npm:** `v9.x` or higher

---

## ⚙️ Environment Configuration
Create a `.env.local` file at the root of `TripSyncWeb/` with the following variables:

```env
# Local / Production FastAPI Backend endpoint
NEXT_PUBLIC_API_URL=http://localhost:8000/api

# Firebase Project Configuration (Client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDpBTv3re8BuZR-i25ZeuKsUykN1DYcxNo
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tripsync-8e63e.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tripsync-8e63e
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tripsync-8e63e.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=167694267883
NEXT_PUBLIC_FIREBASE_APP_ID=1:167694267883:web:61bd7d4f75be2ad2a915ae
```

---

## 🚀 Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

---

## 📦 Production Deployment

### 1. Build the Application
```bash
npm run build
```

### 2. Run Production Server
```bash
npm start
```
