# United Union Health — Enterprise NestJS Backend

A production-ready, HIPAA/PHI-safe NestJS backend service powering the **United Union Health** consumer mobile application (Flutter), future clinical admin portals, and continuous biometric sensor telemetry ingestion.

---

## 🏛️ Architecture & Technologies

- **Framework**: [NestJS 11](https://nestjs.com/) (TypeScript)
- **Database ORM**: [Prisma ORM 6](https://www.prisma.io/)
- **Database**: PostgreSQL 16 (with full relational model & migrations)
- **Authentication**: Dual JWT (short-lived access + sliding refresh tokens) with Bcrypt hashing
- **Authorization**: Role-Based Access Control (`MEMBER`, `DOCTOR`, `CLINIC_ADMIN`, `SUPER_ADMIN`)
- **API Documentation**: Interactive Swagger / OpenAPI 3.0 at `/api/docs`
- **Validation**: Strict `class-validator` and `class-transformer` pipes
- **Compliance**: PHI-safe exception sanitization filter & granular patient consent governance

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js >= 20 (Active: v22.18)
- PostgreSQL 16 running locally on port 5432 (or run `docker-compose up -d`)

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default connection string:
```env
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ehealth_db?schema=public"
JWT_SECRET="generate-a-long-random-secret"
JWT_REFRESH_SECRET="generate-a-different-long-random-secret"
API_PREFIX="v1"
```

### 3. Database Migration & Seeding
```bash
# Push schema to database
npx prisma db push

# Seed demo member (Elena Vance) and clinician (Dr. Sarah Jenkins)
npm run seed  # or npx prisma db seed
```

### 4. Running the Application
```bash
# Development mode with watch
npm run start:dev

# Production build
npm run build
npm run start:prod
```

The server will start on `http://localhost:3000/v1`.
Access the interactive OpenAPI / Swagger UI at:
👉 **[http://localhost:3000/api/docs](http://localhost:3000/api/docs)**

---

## 🧪 Testing

```bash
# Run unit test suites
npm run test

# Run full end-to-end (E2E) integration test suites
npm run test:e2e
```

All 12 E2E test suites validate the end-to-end flows: authentication, user demographics, biometric telemetry ingestion, paired devices, doctor consultation notes, active goals, AI advisor chat, nutrition scanning, and cellular eSIM data plans.

---

## 📋 Default Seeded Demo Accounts

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Member** | `member@unitedunionhealth.com` | `Password123!` | **Elena Vance** (Global Tier, baseline vitals & paired wristband) |
| **Doctor** | `doctor@unitedunionhealth.com` | `Password123!` | **Dr. Sarah Jenkins, MD** (Cardiovascular Medicine, license `MD-89241-US`) |

---

## 📡 API Contract Alignment (Matches Flutter Mobile App)

| Feature Module | Method & Path | Description |
| :--- | :--- | :--- |
| **Auth** | `POST /v1/auth/register` | Register new member account |
| | `POST /v1/auth/login` | Email/password sign in |
| | `POST /v1/auth/refresh` | Exchange refresh token |
| | `POST /v1/auth/logout` | Revoke active session |
| | `POST /v1/auth/forgot-password` | Password reset trigger |
| | `POST /v1/auth/verify-email` | Confirm verification code |
| **User Profile** | `GET /v1/user/profile` | Member demographics & subscription tier |
| | `PUT /v1/user/profile` | Update demographics & emergency info |
| **Health Telemetry** | `GET /v1/health/metrics/summary` | Core vitals for dashboard cards (HR, SpO2, Sleep, Steps) |
| | `GET /v1/health/metrics` | Filtered historical telemetry points |
| | `GET /v1/health/heart-rate/latest` | Most recent heart rate observation |
| | `GET /v1/health/spo2/latest` | Most recent blood oxygen observation |
| | `GET /v1/health/sleep/latest` | Most recent sleep staging summary |
| | `GET /v1/health/activity/today` | Today's active calories & distance |
| | `GET /v1/health/steps/today` | Today's step goal progress |
| | `POST /v1/health/metrics` | Log single metric observation |
| | `POST /v1/health/metrics/batch` | High-frequency telemetry batch ingestion |
| **Devices** | `GET /v1/devices` | Paired sensors & platform health sync |
| | `POST /v1/devices/register` | Register new hardware / BLE source |
| | `POST /v1/devices/sync` | Update device sync status & timestamp |
| | `DELETE /v1/devices/:id` | Unbind device |
| **Doctor & Care** | `GET /v1/doctor/overview` | Assigned clinician overview & review schedule |
| | `GET /v1/doctor/notes` | Clinician clinical consultation notes |
| | `POST /v1/doctor/notes` | Create clinical note (Doctor/Admin role) |
| | `GET /v1/doctor/reports` | Shared diagnostic laboratory reports |
| | `GET /v1/doctor/consent` | Patient data access boundaries |
| | `PUT /v1/doctor/consent` | Update patient sharing boundaries |
| **Goals** | `GET /v1/goals` | Active personal & clinical goals |
| | `POST /v1/goals` | Create new health goal |
| | `PATCH /v1/goals/:id` | Update target progress |
| | `DELETE /v1/goals/:id` | Archive health goal |
| **AI Advisor** | `POST /v1/ai-advisor/chat` | Context-aware AI companion with disclaimer |
| | `GET /v1/ai-advisor/suggestions` | Automated lifestyle recommendations |
| **Mental Wellness** | `GET /v1/mental-wellness/moods` | Private daily mood reflection logs |
| | `POST /v1/mental-wellness/moods` | Log daily mood & notes |
| | `GET /v1/mental-wellness/sessions` | Restorative breathwork & NSDR audio sessions |
| **Nutrition** | `GET /v1/nutrition/targets` | Macro targets and today's consumed total |
| | `PUT /v1/nutrition/targets` | Update daily protein, carbs, fat, calories |
| | `GET /v1/nutrition/guidance` | Clinical meal timing recommendations |
| | `POST /v1/nutrition/scan` | Computer Vision AI food recognition |
| | `POST /v1/nutrition/log` | Log meal intake |
| **Notifications** | `GET /v1/notifications` | In-app alerts & clinical updates |
| | `PATCH /v1/notifications/:id/read`| Mark notification as read |
| | `PATCH /v1/notifications/read-all`| Mark all notifications as read |
| **eSIM** | `GET /v1/esim/status` | Global cellular telemetry plan & data usage |
| | `POST /v1/esim/activate` | Provision global eSIM profile |
