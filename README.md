# Tam`i Shop

An online store for the Georgian market built on the MERN stack: a **React (Vite)** storefront and admin panel, a **Node.js + Express** REST API and **MongoDB**. The UI is available in Georgian, English and Russian.

> The brand name is written **Tam`i Shop**, with a backtick (`` ` ``, U+0060) between "Tam" and "i". It is defined once per app: `frontend/src/constants.js` (`BRAND`) and `backend/constants/brand.js` (emails).

---

## Overview

Customers browse a catalog of categories and products, choose product options (such as color or storage), add items to a cart and check out with free delivery across Georgia and **payment to the courier on delivery**. Accounts use email + password, with email verification by a one-time code, or Google sign-in. Staff manage products, categories, orders and users in an admin panel at `/admin`.

## Features

**Storefront**
- Home page: promo hero, perks, a category hub with quick filters, and product rails for Hot Deals (≥ 40% off), Best Sellers, New Products (last 14 days) and Recommended products (personalized by views, cart and purchases).
- Catalog (`/products`) and category pages (`/category/:slug`), with search, sorting (newest, name, price, discount), discount filters and pagination.
- Product page: image gallery, specifications, rich-text description, and option/variant selection with live price, stock and availability.
- Cart stored in `localStorage`, with each product + variant combination as its own line.
- Three-step checkout: delivery → payment → confirmation.
- Profile: personal data, a saved address, password change, and "My Orders" (status, payment state, items with their selected options).

**Accounts**
- Registration with email verification (4-digit code), login, Google sign-in, password recovery, password change and logout.

**Admin panel** (`/admin`)
- Products (including options and variants), categories (drag-and-drop ordering), orders (statistics, filters, a status workflow, cancellation, Excel export) and users (roles and activation).
- Content in three languages: **ქართული | English | Русский** tabs for products (name, description, specifications, options) and categories.

**Cross-cutting**
- Georgian (default), English and Russian UI, with a language switcher in the header.
- Light/dark themes and responsive layouts down to 320px, including a bottom navigation bar on mobile.
- Transactional emails: verification code, password recovery code and order confirmation.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, React Router 6, Vite 5, Axios, i18next + react-i18next, `@react-oauth/google`; plain CSS with design tokens (no UI framework) |
| Backend | Node.js, Express 4, Mongoose 8, JSON Web Tokens, bcryptjs, google-auth-library, Nodemailer, ExcelJS, express-async-handler |
| Database | MongoDB (local or MongoDB Atlas) |
| Dev tools | nodemon (backend), Vite dev server (frontend) |

## Project Structure

```text
ecommerce-mvp/
├── backend/
│   ├── server.js              # Express app, CORS, routes, error handling
│   ├── config/db.js           # MongoDB connection
│   ├── constants/             # brand, checkout config (cities, delivery, payment methods, banks), order status workflow
│   ├── controllers/           # auth, password, products, categories, orders, payments, users
│   ├── middleware/            # protect/optionalAuth (JWT), roles, rate limiting, error handler
│   ├── models/                # User, Product, Category, Order, Otp, PasswordResetCode
│   ├── routes/apiRoutes.js    # main API (/api/<resource>-<action>)
│   ├── services/
│   │   ├── email/             # shared email service: SMTP transport, layout, templates
│   │   ├── payments/          # bank payment providers (BOG, TBC, sandbox); card payments currently disabled
│   │   ├── adminOrders.js     # order workflow, statistics, Excel export
│   │   ├── productVariants.js # option/variant validation, atomic stock reservation
│   │   ├── recommendationService.js
│   │   └── verificationCodes.js  # one-time codes (registration + password recovery)
│   └── utils/                 # seed scripts, catalog data, makeAdmin, password policy, translations
└── frontend/
    ├── index.html
    ├── scripts/check-i18n.mjs # translation coverage check
    └── src/
        ├── api/axios.js       # API client (JWT + Accept-Language headers)
        ├── context/           # Auth, Cart, UI (toasts, confirm dialogs)
        ├── i18n/              # i18next setup, dynamic-content helpers, API error translation
        ├── locales/           # ka.json, en.json, ru.json
        ├── components/        # layout, product, checkout, admin and shared UI components
        ├── hooks/             # useVerificationCode, useDocumentMeta
        ├── pages/             # storefront pages + pages/admin/
        └── utils/             # variants, password policy, recently-viewed tracking
```

## Installation

Prerequisites:
- Node.js 18+
- A MongoDB instance (local or Atlas)
- A Google OAuth Client ID, for Google sign-in

```bash
cd backend  && npm install
cd ../frontend && npm install
```

## Environment Variables

Both apps read a `.env` file, which is git-ignored. Start from the `.env.example` file in each folder:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Backend (`backend/.env`)

```env
# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173          # frontend origin (CORS, links in emails)

# Database
MONGO_URI=mongodb://127.0.0.1:27017/your_database

# Auth
JWT_SECRET=your_long_random_secret
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# Email (SMTP via Nodemailer)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
# EMAIL_REPLY_TO=support@your-domain.ge   # optional
# EMAIL_DELIVERY=log                       # print emails to the console instead of sending

# Development access gate (code required to open the site; see "Security")
DEV_ACCESS_CODE=your_access_code

# Card payments (disabled; see "Cart & Checkout")
CARD_PAYMENTS_ENABLED=false
# PUBLIC_API_URL=https://api.your-domain.ge   # public URL for bank callbacks
# ALLOW_SANDBOX_PAYMENTS=false
# BOG_CLIENT_ID= / BOG_CLIENT_SECRET= / BOG_AUTH_URL= / BOG_API_URL=
# TBC_API_KEY= / TBC_CLIENT_ID= / TBC_CLIENT_SECRET= / TBC_API_URL=
```

Emails are sent only when `SMTP_HOST`, `SMTP_USER` and `SMTP_PASS` are all set and `EMAIL_DELIVERY` is not `log`. Otherwise each email (including codes) is printed to the server console, which is meant for local development only.

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

For Google sign-in, create an OAuth Client ID (type "Web application") in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), add `http://localhost:5173` under **Authorized JavaScript origins**, and use the same Client ID in both `.env` files.

## Running the Project

**Backend** (`backend/`):

| Command | Description |
|---|---|
| `npm run dev` | Start the API with nodemon on `http://localhost:5000` |
| `npm start` | Start the API with node |
| `npm run seed:catalog` | Add or update the sample catalog (9 categories with EN/RU names, plus products), matched by slug. Deletes nothing and is safe to re-run. Add `-- --dry-run` to validate without writing. |
| `npm run seed` | **Deletes all categories and products**, then inserts a small demo set. Never run it against a real database. |
| `npm run migrate:translations` | Fill missing EN/RU translations of existing content (idempotent, `-- --dry-run` / `-- --force`) |
| `node utils/makeAdmin.js user@example.com` | Give an existing user the `admin` role |

**Frontend** (`frontend/`):

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server on `http://localhost:5173` |
| `npm run i18n:check` | Check that every translation key used in the code exists in `ka`/`en`/`ru` (including plural forms) |

To create the first admin, register (or sign in with Google), run `makeAdmin.js` with that email, then log in again. The **Panel** link appears in the header.

Health check: `GET /api/health`.

## Build / Production

```bash
cd frontend
npm run build      # outputs frontend/dist (static files)
npm run preview    # serve the build locally
```

The backend runs with `npm start`. In production, set `NODE_ENV=production`, a strong `JWT_SECRET`, real SMTP credentials and `CLIENT_URL` (your frontend origin), and serve `frontend/dist` from any static host. `VITE_*` variables are embedded at build time.

## Authentication

- **Email + password.** Registration requires email verification first. A 4-digit code is emailed; it is valid for **3 minutes**, can be resent after **30 seconds**, and allows **5 attempts**. The UI restores the timers after a page refresh. A verified email must complete registration within 30 minutes.
- **Google sign-in** via Google Identity Services. The backend verifies the ID token with `google-auth-library` and creates or links the account by email.
- **Password recovery** (`/forgot-password`): email → 4-digit code → new password. A verified code yields a single-use reset token valid for 10 minutes. Google-only accounts can set a password this way.
- **Password change** (Profile): requires the current password. All other sessions are revoked, and the current device receives a new token.
- **Password policy** (identical on client and server): 8–64 characters, with upper- and lowercase Latin letters, a digit and a special character.
- **Sessions**: a JWT (`Authorization: Bearer`) stored in `localStorage`. Logout is available in the account menu (desktop and mobile).
- **Roles**: `customer`, `manager`, `admin`. Managers can manage the catalog and orders; only admins can delete products or manage users.

## Products & Variants

- A product has a name, slug, rich-text description, informational **specifications** (key/value), images (main image plus gallery), a category, price, an optional sale price (`onSale` + `oldPrice`), stock, and an active flag.
- **Options** (optional) are customer-selectable parameters with any name (e.g. Color, Storage, Size). Each option is required or optional and is displayed as text chips or color swatches. Its **values** keep stable IDs, so renaming a value does not break variants.
- **Variants** are the allowed combinations of option values, each with its own **price, old price, stock, SKU and active flag**. Not every combination has to exist. For products with variants, the server derives the product-level price ("from" the cheapest available variant), sale price and `inStock` automatically.
- On the product page, the customer chooses options. Price, discount and stock update to match the selected variant. Unavailable, sold-out and conflicting values are indicated, and the cart requires a complete selection.
- The admin variant editor can generate all combinations and validates duplicates, prices and SKUs. The server re-validates everything (`services/productVariants.js`).

## Cart & Checkout

1. **Cart**: lines are `product + variant`, with quantities limited by variant stock. Checkout requires login.
2. **Delivery**: recipient name, phone, a searchable list of Georgian cities (Latin names shown in EN/RU), and a street address. Delivery is **free across Georgia** with an estimated 2–6 business days.
3. **Payment**: **Pay to courier (cash on delivery)** is the active payment method. Card payment is shown as **"Coming soon"** and disabled. The bank integration code (Bank of Georgia / TBC hosted payment pages, plus a sandbox) exists but is turned off by `CARD_PAYMENTS_ENABLED=false` and is not a live payment option.
4. **Confirmation**: an order number, delivery and payment summary, and an order confirmation email.

The server never trusts client prices. Prices, discounts and totals are recalculated from the database, and variant stock is reserved atomically when an order is placed (so concurrent orders cannot oversell). Each order stores a snapshot of item names, prices and the selected options, so later product edits don't change past orders.

## Orders

- Customers see their orders under **Profile → My Orders**: order number, date, status, payment method/state, items with selected options, and total.
- Status lifecycle (controlled by the server, `constants/orderStatus.js`):

  `Pending → Processing → Shipped → Completed`

  Only the next step is allowed. **Cancellation** is a separate action (from Pending, Processing or Shipped). Cancelling releases any reserved variant stock.
- Order statuses are stored as English enum keys (`pending`, `processing`, …) and translated in the UI.

## Admin Panel

Available at `/admin` to `admin` and `manager` users (the user list is admin-only).

- **Products**: create, edit and delete products. Includes search and filters, images, specifications, discounts, options/variants, and optional EN/RU translations.
- **Categories**: create, edit and delete categories, reorder them by drag and drop, and add optional EN/RU name and description.
- **Orders**:
  - Statistics by status and revenue (confirmed orders).
  - Search by order number, plus filters by status, date range, price range, phone and customer.
  - 10 orders per page.
  - A "Manage" dialog that moves an order to its next status, with a separate confirmed cancellation.
  - Product names open the product page in a new tab, and still work for historical orders.
  - **Excel export** (`Tami Orders - <date>.xlsx`) of the filtered orders.
- **Users**: list users, create staff accounts (`admin`/`manager`), edit them, change roles, activate/deactivate, and delete.

## Email / Verification

The shared email service (`backend/services/email/`) sends multipart (plain text + HTML) messages from `"Tam`i Shop" <SMTP_USER>`, with an optional Reply-To:
- registration verification code
- password recovery code
- order confirmation (customer)

Send results are logged without codes, passwords or tokens. Verification codes are stored hashed and never returned by the API. Sending a new code invalidates the previous one, and a failed SMTP send is reported as an error instead of a false success.

For deliverability in production, configure SPF/DKIM/DMARC for the sending domain at your mail provider.

## Internationalization

- Supported languages: **Georgian (`ka`)**, which is the default and fallback, plus **English (`en`)** and **Russian (`ru`)**.
- Library: **i18next + react-i18next**. All UI texts live in `frontend/src/locales/{ka,en,ru}.json` (with Russian plural forms). Components use `t('section.key')`.
- **Switching**: a flag dropdown in the header (compact on mobile). The UI updates instantly without a reload. The choice is saved in `localStorage` (`lang`), and `<html lang>`, the page title, meta description and `og:locale` follow it. The browser language is **not** auto-detected, so first-time visitors see Georgian.
- **Fallback**: a missing translation falls back to Georgian. Raw keys are never shown, and missing keys are logged to the console in development.
- **Dynamic content** — one pattern everywhere: the base fields (`name`, `description`, `specifications`, option `name`, value `label`) are Georgian, and translations live in `translations.en` / `translations.ru` on the same document (products, categories, options, option values). Specification translations are index-aligned with the Georgian rows. Language-neutral values (`128 GB`, `USB-C`, brand/model names) are not duplicated. Resolution: requested language → Georgian.
- **Existing catalog**: all current products and categories have English and Russian translations: names, descriptions, specifications (keys and values) and options/values. The translations are stored in `backend/utils/contentTranslations/` and applied by an idempotent migration that only writes `translations` fields and never touches IDs, prices, stock, variants or SKUs:
  ```bash
  cd backend
  npm run migrate:translations -- --dry-run   # report only
  npm run migrate:translations               # fill missing translations (re-running is a no-op)
  ```
  `npm run seed:catalog` applies them automatically.
- **Admin**: product and category forms have **ქართული | English | Русский** tabs (name and description; the EN/RU tabs also cover specifications and options). A dot marks an incomplete language, and the Georgian name is required.
- **Search** works in all three languages: names, descriptions and specification values in ka/en/ru, category names, and a small cross-language synonym table (e.g. `ტელეფონი` / `phone` / `телефон`). **Name sorting** uses the selected language (`Accept-Language`) with a Georgian fallback.
- **Cart, checkout and orders** show names and options in the selected language. Orders store a snapshot of the item-name and option translations plus the customer's `language`. Status values stay stable English enums (`pending`, `processing` …) and are translated in the UI.
- **Emails** (verification code, password recovery, order confirmation) are sent in the customer's language: the request language for codes and `order.language` for order confirmations, with a Georgian fallback. One template set and one message dictionary are used (`services/email/messages.js`).
- **API errors**: the backend returns stable error `code`s, and the UI shows them in the selected language.
- **Formatting**: dates follow the selected locale. Prices are always in GEL (`₾`).
- The admin panel UI itself is in Georgian.
- The Google sign-in button is rendered by Google and picks its own language.

## Responsive UI / Themes

- Mobile-first layouts, verified at 320–430px with no horizontal page scrolling. Mobile adds a bottom navigation bar, an accordion for My Orders and compact header controls. Admin tables switch to a card layout on narrow screens.
- **Light and dark themes** (header toggle, persisted), built on CSS design tokens.

## Security

- Passwords are hashed with **bcrypt**, never returned by the API (`toJSON` strips them) and never logged.
- **JWT** authentication. Tokens issued before a password change or reset are rejected.
- Server-side authorization for every protected route (`protect` + role checks). Frontend route guards (`PrivateRoute`, `AdminRoute`) only affect UX.
- Google ID tokens are verified on the server against `GOOGLE_CLIENT_ID`.
- One-time codes are hashed, expire after 3 minutes, have a 30-second resend cooldown (enforced on the server) and are limited to 5 attempts. Password reset tokens are single-use and short-lived. Auth endpoints are rate-limited.
- Server-side order validation: prices and stock come from the database, and variant stock is reserved atomically.
- No card data is handled or stored by the shop. The planned card flow uses the bank's hosted page.
- Secrets come only from environment variables, and `.env` files are git-ignored.
- `DEV_ACCESS_CODE` gates the whole site behind an access code (`AccessGate`, verified by `POST /api/dev-access/verify`) while it is a test environment. It is not an authentication mechanism.

## API

All endpoints use the format `/api/<resource>-<action>` and are defined in `backend/routes/apiRoutes.js`. For example:

| Method | Route | Access |
|---|---|---|
| POST | `/api/auth-register`, `/api/auth-login`, `/api/auth-google-login` | Public |
| POST | `/api/auth-verification-code-send`, `/api/auth-verification-code-verify` | Public |
| POST | `/api/auth-password-reset-code-send`, `/api/auth-password-reset-code-verify`, `/api/auth-password-reset` | Public |
| POST | `/api/auth-password-change` | Private |
| GET / PUT | `/api/auth-profile`, `/api/auth-profile-update` | Private |
| GET | `/api/product-list`, `/api/product-details/:id`, `/api/product-best-sellers`, `/api/product-recommended` | Public |
| POST / PUT / DELETE | `/api/product-create`, `/api/product-update/:id`, `/api/product-delete/:id` | Staff (delete: Admin) |
| GET / POST / PUT / DELETE | `/api/category-list`, `/api/category-create`, `/api/category-update/:id`, `/api/category-reorder`, `/api/category-delete/:id` | Public / Staff |
| GET | `/api/order-checkout-options` | Public |
| POST / GET | `/api/order-create`, `/api/order-my-list`, `/api/order-cancel/:id` | Private |
| GET / PUT / POST | `/api/order-list`, `/api/order-export`, `/api/order-status-update/:id`, `/api/order-admin-cancel/:id` | Staff |
| GET / POST / PUT / DELETE | `/api/user-list`, `/api/user-create`, `/api/user-update/:id`, `/api/user-role-update/:id`, `/api/user-status-update/:id`, `/api/user-delete/:id` | Admin |

The older REST paths (`/api/products`, `/api/orders`, …) still respond for compatibility, with a `Deprecation: true` header. `/api/payments/callback/:bank` and `/api/payments/sandbox/...` are reserved for the (disabled) bank integration.
