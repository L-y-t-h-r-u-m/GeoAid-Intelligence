# GeoAid Intelligence

**GeoAid Intelligence** is a community-driven Disaster Response and Resource Allocation platform. It bridges the gap between field-reported needs and volunteer capabilities through a robust trust-based verification system and real-time intelligence gathering.

---

## Key Features

### Trust & Verification (Vouching System)
- **Community Vouching**: Tasks reported by volunteers require **4 community vouches** before becoming actionable. This ensures data accuracy and builds trust.
- **NGO Verification**: NGO Admins can manually verify, modify, and resolve tasks with higher authority.
- **Status Tracking**: Real-time status updates from `Pending` → `Verified` → `Resolved`.

### Intelligence & OCR
- **Field Digitization**: Uses **Tesseract.js** to extract intelligence from physical survey forms.
- **Auto-Triage**: Heuristic engine that automatically categorizes tasks (Medical, Logistics, Infrastructure) and sets priority based on content.

### Impact & Analytics
- **Live Dashboard**: Interactive map (Leaflet) with distance filtering and priority-coded markers.
- **Leaderboard**: Gamified system where volunteers earn points for vouching for needs and completing tasks.
- **Impact Stats**: Real-time visualization of resource distribution and resolution rates.

---

## Project Structure

```
GeoAid-Intelligence/
├── frontend/        # React 19 + Vite + Tailwind CSS (UI)
└── backend/         # Node.js + Express + MongoDB (API)
```

---

## Setup Instructions

### 1. Prerequisites
- **Node.js** (v18+)
- **MongoDB** (Local or Atlas)

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
```
Edit `.env` and provide your `MONGO_URI`.

**Start Backend:**
```bash
npm run dev
```
Running at: `http://localhost:5000`

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Running at: `http://localhost:5173` (or `5174`)

---

## Database Management

To clear all tasks and re-trigger the auto-seeder (to get a fresh set of mock data):

```bash
cd backend
node clearTasks.js
```
Then restart your server. The system will detect 0 tasks and insert the default seed dataset.

---

## API Endpoints

| Method | Route                | Description                          |
|--------|----------------------|--------------------------------------|
| GET    | `/api/tasks`         | Fetch tasks with location filtering  |
| POST   | `/api/tasks`         | Create a new report/task             |
| POST   | `/api/tasks/:id/vouch`| Vouch for a pending task             |
| PUT    | `/api/tasks/:id/verify`| NGO Admin verification              |
| POST   | `/api/tasks/:id/complete`| Complete an allocated task        |
| GET    | `/api/leaderboard`   | Fetch top volunteer rankings         |

---

## Tech Stack

- **Frontend**: React 19, Vite, Framer Motion, Tailwind CSS
- **Maps**: Leaflet & React-Leaflet
- **Icons**: Lucide React
- **Backend**: Node.js, Express, Mongoose
- **Database**: MongoDB
- **OCR**: Azure AI (The Extraction Engine), Google Gemini 1.5 Flash 
- **Auth**: JWT (JSON Web Tokens) & Bcrypt

---
