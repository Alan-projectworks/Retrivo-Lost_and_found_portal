# RETRIVO. – LPU CAMPUS RECOVERY NETWORK
### A Smart Campus Recovery Platform for Lovely Professional University (Punjab, India)
**Design Thinking Project: P04 – Lost on a 600-Acre Campus: Rethinking Lost and Found**

> *"Lost something? Let's bring it home."*

---

## Executive Overview

Across Lovely Professional University's massive 600-acre campus, students and faculty frequently misplace ID cards, laptops, chargers, water bottles, keys, wallets, and academic documents across hostels, food courts, libraries, and laboratories. 

Previously, lost and found inquiries were scattered across unverified WhatsApp groups, fragmented security posts, and word of mouth. **RETRIVO** solves this by establishing a centralized, verified digital recovery network connecting finders with legitimate owners while enforcing strict privacy safeguards, smart matching, and staff-verified physical handovers.

---

## Visual Identity & Design System

RETRIVO is built with a bespoke **Swiss Editorial & Campus Wayfinding** design language:
- **Palette**:
  - **Deep Forest Green** (`#142D26`): Navigation, headers, authority containers.
  - **Warm Ivory** (`#F5F2E9`): Warm editorial canvas background.
  - **Muted Sage** (`#A8B7A0`): Subtle badges, dividers, neutral states.
  - **Signal Orange** (`#F07845`): Action buttons, recovery alerts, progress highlights.
  - **Charcoal** (`#252925`): High-contrast typography and borders.
  - **White** (`#FFFFFF`): Card surfaces and readable data tables.
- **Typography**:
  - `Space Grotesk`: Editorial headings, section numbers (`01`, `02`), reference IDs.
  - `Inter`: Interface body, forms, tables, and badge pills.
- **No generic AI gradients or Bootstrap templates**: Clean asymmetric layout, subtle 1px structural borders, monospaced coordinate badges (`[LPU-ZONE-B34]`), and genuine responsive usability.

---

## Evaluation & Demonstration Accounts

The database comes pre-seeded with realistic campus test data and three dedicated role tiers:

| Role | Email / Identifier | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Student** | `student@lpu.in` | `Student@123` | File lost/found reports, track claims, personal dashboard |
| **Student (Alt)** | `priya.verma@lpu.in` | `Student@123` | Secondary student account for multi-user claim testing |
| **Staff / Security** | `staff.security@lpu.in` | `Staff@123` | Operational queue, secret comparison, physical handover logging |
| **Administrator** | `admin.recovery@lpu.in` | `Admin@123` | Complete user directory, collection points, audit logs, KPIs |

*(Tip: The login page includes 1-click **Quick Fill Demo** buttons to test any role instantly without typing.)*

---

## Quick Start & Local Setup

### Prerequisites
- Node.js (v18, v20, or v24)
- npm (v9+)

### Installation & Launch

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Seed Realistic Campus Database** *(Optional - database is already seeded)*:
   ```bash
   npm run seed
   ```

3. **Start the Application**:
   ```bash
   npm start
   ```
   Open your browser at: **`http://localhost:3000`**

4. **Run Automated Test Suite**:
   ```bash
   npm test
   ```
   *(Executes 12 comprehensive integration tests verifying authentication, smart matching, privacy masking, claims lifecycle, and QR poster generation).*

### Run the full app from VS Code

The **Go Live** button (Live Server) serves only the static HTML/CSS/JavaScript files. It does not start this app's Express API, so features such as sign-in, reporting, and database-backed listings will not work through that button alone.

After running `npm install` once, start the complete app using **Terminal → Run Task… → RETRIVO: Start full-stack server**. Open **`http://localhost:3000`** and leave the task's terminal running. The URL is local to your computer; it is not a permanent public link. To make the app available to others at any time, deploy it online.

### Hosting the full app on Render

The Express server already serves both the frontend and API, so the simplest deployment is one Node.js web service:

1. Push the project to a GitHub repository. The root `.gitignore` excludes the local SQLite database, generated uploads, and environment files.
2. Create a **Web Service** from that repository. Use `npm install` as the build command and `npm start` as the start command.
3. Configure a persistent disk mounted at `/var/data`, then set these environment variables:
   - `DATA_DIR=/var/data`
   - `NODE_ENV=production`
   - `SESSION_SECRET` to a strong, private random value
4. Deploy and open the public URL provided by Render. `PORT` is supplied by the host.
5. If you need demo records, run `npm run seed` once on the new database. The seed script deletes existing records before reseeding, so never rerun it after real data has been added.

The app refuses to start in production if `SESSION_SECRET` is missing. A persistent disk is required to retain the SQLite database and new uploads across redeploys. Some hosting plans sleep when idle or charge extra for persistent storage; check the selected plan if the app must remain continuously available.

The current Express session store is in-memory, so users may need to sign in again after a backend restart. This does not erase their accounts or reports, which are stored in SQLite.

### Optional: Netlify frontend with a separate backend

Netlify can host the static pages, but it cannot run this Express server or persist SQLite and uploaded files on its own. First deploy the backend using the Render steps above. Then copy its public URL and create `netlify.toml` in the project root, replacing the example host:

   ```toml
   [build]
     publish = "public"

   [[redirects]]
     from = "/api/*"
     to = "https://YOUR-BACKEND-HOST/api/:splat"
     status = 200
     force = true

   [[redirects]]
     from = "/uploads/*"
     to = "https://YOUR-BACKEND-HOST/uploads/:splat"
     status = 200
     force = true
   ```

5. In Netlify, import the same GitHub repository and deploy. The rewrite rules send API and uploaded-file requests to the backend; the frontend pages are served by Netlify.

Before sharing the site publicly, replace or remove the seeded demo accounts and passwords documented above. If you want Netlify alone to host the whole application, the Express routes must instead be adapted to Netlify Functions, and SQLite/local uploads must be replaced with managed database and file-storage services.

---

## 15 Connected Pages & Structure

1. **Landing Page** (`/` or `/index.html`): Editorial hero, live database counters (Total reported, Returned, Waiting to claim, Active reports), recent found inventory showcase, 4-step process, campus recovery hubs.
2. **Student Registration** (`/register.html`): Validates university email format, duplicate checking, password hashing with bcryptjs.
3. **Student / Staff Login** (`/login.html`): Role-based redirect with 1-click quick demo selectors.
4. **Student Dashboard** (`/dashboard.html`): Personalized stats, My Lost Reports, My Found Reports, Active Claims, live notification feed.
5. **Report Lost Item** (`/report-lost.html`): Multi-category reporting, campus zone selection, private proof fields, instant smart matching detection banner.
6. **Report Found Item** (`/report-found.html`): Good Samaritan form with Privacy Shield warning for ID cards and wallets, custody desk selection, hidden secret identifier storage.
7. **Browse Items Directory** (`/browse.html`): Searchable directory with live debounce search, Lost/Found toggle, category filters, campus zone filters, status filters, and pagination.
8. **Item Details Page** (`/item-detail.html?id=:id`): High-res photos, 5-stage recovery stepper (`Reported → Matched → Claim Filed → Verified → Returned`), "Claim This Item" modal, smart match suggestions.
9. **Ownership Claim Modal & System**: Claimant verification questions, secret answer input, optional purchase invoice upload, human review protection.
10. **My Reports** (`/my-reports.html`): Student's lost and found submissions with cancel / close options.
11. **My Claims** (`/my-claims.html`): Status tracker, staff feedback, and designated handover collection point instructions.
12. **Notifications Center** (`/notifications.html`): In-app notification inbox, unread badge counter, mark all as read.
13. **Administrator Dashboard** (`/admin.html`): Executive KPI stats, user directory with role switcher (student/staff/admin), global inventory, collection points editor, system audit logs.
14. **Staff Handover Desk** (`/staff.html`): Operational queue, side-by-side evidence comparison (claimant's secret answer vs item's confidential record), approval/rejection modal, physical ID verification, and handover registry.
15. **Campus QR Posters Hub** (`/qr-campus.html`): Dynamic vector SVG QR codes tailored for LPU zones (Central Library, Uni-Mall, Block 34, Unipolis, Hostels, Sports Complex) with `@media print` support for physical campus posters.

---

## Core Technical Features

### 1. Smart Matching Engine
When an item is reported, RETRIVO automatically scans items of the opposite type and scores similarity across 4 weighted dimensions:
- Exact Category Match: **35%**
- Campus Zone Proximity: **25%**
- Date Delta (within ±3 to 7 days): **20%**
- Title & Description Keyword Overlap: **20%**

Scores $\ge 55\%$ automatically trigger in-app notifications to both parties.

### 2. Privacy-First Sensitive Item Protection
For found ID cards, wallets, and confidential documents:
- Public listings mask student names, registration numbers, and internal card details.
- Good Samaritan contact info is shielded.
- Only authorized staff and the verified claimant can view or confirm secret identifiers.

### 3. Human Review & Physical Handover
Claims are **never** auto-approved. Staff compare the claimant's answers against the item's hidden identifiers, approve the claim, and assign a physical collection hub. During pickup, staff inspect the student's physical LPU ID card and record the student registration number and notes before marking the item as `Returned`.

---

## Database Architecture (`db/database.js`)

- `users`: `id`, `full_name`, `email`, `reg_number`, `phone`, `password_hash`, `role` (`student`, `staff`, `admin`), `department`, `hostel_block`.
- `items`: `id`, `reference_no` (`LST-26-XXXX`, `FND-26-XXXX`), `type`, `title`, `category`, `description`, `secret_identifiers`, `location`, `specific_spot`, `date_occurred`, `photo_url`, `status`, `is_sensitive`, `reporter_id`, `collection_point_id`.
- `claims`: `id`, `reference_no` (`CLM-26-XXXX`), `item_id`, `claimant_id`, `proof_description`, `secret_answers`, `proof_file_url`, `status`, `staff_notes`, `reviewed_by`, `handed_over_at`, `handover_notes`.
- `collection_points`: `id`, `name`, `zone`, `building`, `desk_incharge`, `contact_number`, `operating_hours`, `is_active`.
- `notifications`: `id`, `user_id`, `title`, `message`, `link`, `is_read`, `created_at`.
- `activity_logs`: `id`, `user_id`, `action`, `target_type`, `target_id`, `details`, `created_at`.

---

## Design Thinking Project Accreditation
- **Institution**: Lovely Professional University, Punjab, India
- **Problem Statement**: P04 – Lost on a 600-Acre Campus: Rethinking Lost and Found
- **Solution**: RETRIVO – LPU Campus Recovery Network
