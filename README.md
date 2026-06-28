# 🏘️ LandLink

### 🚀 Intro
LandLink is a modern Micro SaaS platform that helps **land owners and brokers manage plot sales transparently** — from layout upload to booking, commission tracking, and real-time updates. Built as a full-stack MERN application with role-based dashboards for owners and brokers.

---

### 🛠️ Technologies
- **Frontend:** React 18, Vite, Tailwind CSS v4, React Router
- **Backend:** Node.js, Express 5, MongoDB, Mongoose
- **OCR:** Python
- **Auth:** JWT 
- **Real-time:** Socket.io
- **File Storage:** Cloudinary
- **Payments:** Razorpay (dev upgrade available)

---

### ✨ Features
| Feature | Owner | Broker |
|---------|-------|--------|
| Create projects & upload layout | ✅ | — |
| Draw plot boundaries on map | ✅ | — |
| Interactive plot map (SVG) | ✅ | ✅ |
| Hold / book plots | — | ✅ |
| Approve / reject bookings | ✅ | — |
| Invite brokers & co-owners | ✅ | — |
| Document vault | ✅ | View shared docs |
| Commission tracking | ✅ (Pro) | ✅ |
| Analytics | ✅ (Pro) | — |
| Real-time notifications | ✅ | ✅ |

---

### 🧩 The Process
LandLink was built around a simple problem: land transactions between owners and brokers are often messy, undocumented, and hard to track. The goal was to bring structure to that process.

**Approach:**
1. Designed the data model first — `Project`, `Plot`, `Booking`, `Document`, and `Notification` as core entities
2. Built role-based access (Owner vs Broker) into auth and middleware from day one, instead of retrofitting it later
3. Implemented AI-powered OCR to auto-detect plots from uploaded layout images, cutting manual setup time significantly
4. Added Socket.io for real-time booking and notification updates, so both owners and brokers stay in sync instantly
5. Structured the backend into clear layers — `models`, `routes`, `middleware`, and `services` — to keep business logic (like commission calculation) separate from request handling

```
backend/src/
  models/       User, Project, Plot, Booking, Document, Notification
  routes/       auth, projects, plots, bookings, documents, notifications
  middleware/   auth, roleCheck, planLimits
  services/     pdfProcessor, notificationService, commissionService
frontend/src/
  components/   PlotMap, BookingModal, StatsBar, NotificationBell
  pages/        Landing, Login, owner/*, broker/*
  context/      AuthContext, SocketContext
```

---

### 📚 What I Learned
- How to design **role-based access control** cleanly using middleware instead of scattering checks across routes
- Working with **Socket.io** for real-time features and managing socket state alongside React context
- Integrating **OCR for plot detection**, including handling edge cases in image processing
- Structuring a MERN backend into services/middleware layers for maintainability as the app scaled
- Handling **OTP-based authentication** flows and securing JWT sessions properly
- Balancing free vs Pro feature gating (`planLimits` middleware) without overcomplicating the codebase

---

### 🔧 How It Can Be Improved
- Add automated testing (unit + integration) for routes and services
- Improve OCR accuracy for irregularly shaped or low-quality layout images
- Add a proper production-grade rate limiter on auth/OTP routes
- Move from dev OTP (`123456`) to a real SMS gateway by default, with dev mode behind a flag
- Add role-based analytics dashboards with more detailed commission breakdowns
- Containerize with Docker for easier local setup (currently requires local MongoDB)
- Add pagination and search/filtering on large plot/project lists

---

### ▶️ Running the Project

**Prerequisites**
- Node.js 18+
- MongoDB running locally (`mongodb://localhost:27017`)

**Backend**
```bash
cd backend
cp .env.example .env   # already has dev defaults in .env
npm install
npm run dev
```
API runs at `http://localhost:5000`

**Frontend**
```bash
cd frontend
npm install
npm run dev
```
App runs at `http://localhost:5173`

**Dev Login**
1. Open `/login`
2. Enter any 10-digit phone (e.g. `9876543210`)
3. Choose **Land Owner** or **Broker**
4. OTP is always **`123456`** in development

**Environment Variables**
See `backend/.env.example` for Cloudinary, Firebase, Resend, and Razorpay keys. Without Cloudinary, layout images are stored in the system temp folder and served from `/uploads`.

**Deployment**
- **Frontend:** Vercel — set `VITE_API_URL` and `VITE_SOCKET_URL`
- **Backend:** Railway — set `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`

---

### 🎥 Video
🎥 [Demo video link here] *(add your YouTube/Loom link once recorded)*

---

### 📄 License
MIT
