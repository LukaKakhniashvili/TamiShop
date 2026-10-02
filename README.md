# Tam\`i Shop

**[🇬🇪 ქართული](#ka)** · **[🇬🇧 English](#en)**

---

<a id="ka"></a>

## 🇬🇪 ქართული

**სარჩევი:**
[მიმოხილვა](#ka-overview) ·
[სტატუსი](#ka-status) ·
[ფუნქციები](#ka-features) ·
[როლები](#ka-roles) ·
[ტექნოლოგიები](#ka-stack) ·
[სტრუქტურა](#ka-structure) ·
[არქიტექტურა](#ka-architecture) ·
[მონაცემთა ბაზა](#ka-database) ·
[შეკვეთის workflow](#ka-orders) ·
[შეფასებები](#ka-reviews) ·
[შეტყობინებები](#ka-notifications) ·
[ანალიტიკა](#ka-analytics) ·
[მრავალენოვნება](#ka-i18n) ·
[API](#ka-api) ·
[გარემოს ცვლადები](#ka-env) ·
[ლოკალური გაშვება](#ka-dev) ·
[სკრიპტები და მიგრაციები](#ka-maintenance) ·
[Deployment](#ka-deploy) ·
[უსაფრთხოება](#ka-security) ·
[ხარისხი](#ka-quality) ·
[Roadmap](#ka-roadmap)

<a id="ka-overview"></a>

### მიმოხილვა

Tam\`i Shop არის full-stack ელექტრონული კომერციის აპლიკაცია ქართული ბაზრისთვის: **React (Vite)** მაღაზია და ადმინ-პანელი, **Node.js + Express** REST API და **MongoDB**.

მომხმარებელს შეუძლია:

- დაათვალიეროს კატეგორიები და პროდუქტები და აირჩიოს პროდუქტის ვარიანტი (ფერი, მეხსიერება...);
- შეინახოს პროდუქტები რჩეულებში და გააფორმოს შეკვეთა კურიერთან გადახდით;
- თვალი ადევნოს შეკვეთის სტატუსს და შეაფასოს ნაყიდი პროდუქტები;
- მიიღოს შეტყობინებები საიტზე და ელ-ფოსტით.

პერსონალი (ადმინი / მენეჯერი) მართავს:

- კატალოგს, შეკვეთებსა და მომხმარებლებს;
- შეფასებების მოდერაციას და შეტყობინებებს;
- ბიზნეს-ანალიტიკის დაფას.

მაღაზიის ინტერფეისი ხელმისაწვდომია ქართულ, ინგლისურ და რუსულ ენებზე.

> ბრენდის სახელი იწერება **Tam\`i Shop** — „Tam"-სა და „i"-ს შორის backtick-ით (U+0060). ის ერთხელ არის განსაზღვრული: `frontend/src/constants.js` (`BRAND`) და `backend/constants/brand.js` (ელ-წერილები).

<a id="ka-status"></a>

### განვითარების სტატუსი

| მოდული | სტატუსი |
|---|---|
| ავთენტიფიკაცია, პროფილი, როლები | ✅ რეალიზებული |
| კატალოგი, ვარიანტები, ძებნა, მრავალენოვანი კონტენტი | ✅ რეალიზებული |
| კალათა, checkout (კურიერთან გადახდა) | ✅ რეალიზებული |
| შეკვეთები, შეკვეთის თვალყურის დევნება (timeline) | ✅ რეალიზებული |
| რჩეულები (Wishlist) | ✅ რეალიზებული |
| შეტყობინებების ცენტრი | ✅ რეალიზებული |
| შეფასებები და რეიტინგები | ✅ რეალიზებული |
| ბიზნეს-ანალიტიკა V1 | ✅ რეალიზებული |
| ბარათით გადახდა (BOG / TBC) | ⏸ კოდი არსებობს, გამორთულია |
| ანალიტიკა V1.1 (შეკვეთის lifecycle-ის დროები) | 🗓 დაგეგმილი |

<a id="ka-features"></a>

### ფუნქციები

#### ავთენტიფიკაცია და ანგარიში

- რეგისტრაცია ელ-ფოსტის დადასტურებით (4-ნიშნა ერთჯერადი კოდი), შესვლა, Google-ით შესვლა.
- პაროლის აღდგენა კოდით, პაროლის შეცვლა (სხვა სესიები უქმდება), გასვლა.
- პროფილი: პირადი მონაცემები, მისამართი, „ჩემი შეკვეთები", „რჩეულები".
- დეაქტივირებულ ანგარიშს შესვლა არ შეუძლია.

#### კატალოგი

- კატეგორიები (ადმინში drag-and-drop დალაგებით) და პროდუქტები.
- პროდუქტის გვერდი: გალერეა, rich-text აღწერა, მახასიათებლები (key/value), ფასდაკლება.
- **ოფციები და ვარიანტები:** მაგ. ფერი, მეხსიერება, ზომა. თითო ვარიანტს აქვს საკუთარი ფასი, ძველი ფასი, მარაგი, SKU და აქტიურობის ნიშანი.
- კატალოგი და კატეგორიის გვერდები: ძებნა სამ ენაზე, სორტირება (უახლესი, სახელი, ფასი, ფასდაკლება), ფასდაკლების ფილტრები, გვერდებად დაყოფა.
- მთავარი გვერდის სექციები:
  - ცხელი ფასდაკლებები;
  - **ბესტსელერები** — მხოლოდ რეალური, დადასტურებული გაყიდვებით;
  - ახალი პროდუქტები;
  - პერსონალური რეკომენდაციები (ნანახი, კალათა, შეძენები).
- პროდუქტის ბარათზე ჩანს რეიტინგი (★ საშუალო და რაოდენობა) — ცალკე მოთხოვნის გარეშე.

#### შოპინგი

- **კალათა:** ინახება `localStorage`-ში; თითო ხაზი = პროდუქტი + ვარიანტი.
- **რჩეულები:** ❤ ბარათზე და პროდუქტის გვერდზე, მრიცხველი header-ში, ჩანართი პროფილში.
  - სტუმარი ჯერ გადადის შესვლაზე; შესვლის შემდეგ პროდუქტი ავტომატურად ემატება.
- **Checkout** (სამი ნაბიჯი): მიწოდება → გადახდა → დადასტურება.
  - მიწოდება: ქალაქების სია (საქართველო), მისამართი; უფასო მიწოდება 2–6 სამუშაო დღეში.
  - ერთადერთი აქტიური გადახდის მეთოდია **კურიერთან გადახდა**. ბარათით გადახდა ჩანს როგორც „მალე".
- ფასი, ფასდაკლება და ჯამი ყოველთვის სერვერზე ითვლება. ვარიანტის მარაგი ატომურად იჯავშნება.

#### შეკვეთები

- **ჩემი შეკვეთები:** ნომერი, სტატუსი, გადახდის მდგომარეობა, პროდუქტები არჩეული ოფციებით, ჯამი.
- **თვალყურის დევნება:** სტატუსების timeline თარიღებით (`statusHistory`), გაუქმების მდგომარეობის ჩათვლით.
- **ბმული შეტყობინებიდან** (`/profile?tab=orders&order=<id>`) ხსნის და მონიშნავს კონკრეტულ შეკვეთას.
- **გაუქმება:**
  - დადასტურებულ შეკვეთას აუქმებს მხოლოდ პერსონალი;
  - მომხმარებელს შეუძლია გააუქმოს მხოლოდ საკუთარი გადაუხდელი ბარათის მცდელობა.
- **დასრულებულ შეკვეთაში** თითო პროდუქტზე ჩანს „შეფასების დაწერა" ან „შეფასების ნახვა / შეცვლა".

#### შეფასებები და რეიტინგები

- 1–5 ვარსკვლავი და წერილობითი კომენტარი (3–2000 სიმბოლო).
- **დადასტურებული შენაძენი:** შეფასება შესაძლებელია მხოლოდ დასრულებულ შეკვეთაში ნაყიდ პროდუქტზე. შემოწმება სერვერზეა.
- ერთი მომხმარებელი + ერთი პროდუქტი = ერთი შეფასება. საკუთარის რედაქტირება და წაშლა შესაძლებელია.
- პროდუქტის გვერდზე:
  - საშუალო, რაოდენობა, განაწილება (5★…1★, ფილტრად გამოსაყენებელი);
  - სორტირება (უახლესი / მაღალი / დაბალი), „მეტის ნახვა".
- ადმინისა და მენეჯერის მოდერაცია: დამალვა / აღდგენა.
- შეკვეთის დასრულებისას იქმნება შეხსენება „როგორ მოგეწონათ შენაძენი?".

#### შეტყობინებების ცენტრი

- ზარი header-ში: წაუკითხავების მრიცხველი, ბოლო შეტყობინებები, „ყველას წაკითხულად მონიშვნა".
- სრული გვერდი `/notifications`.
- ავტომატური შეტყობინებები:
  - შეკვეთა მიღებულია;
  - სტატუსის ცვლილება (საიტზე და ელ-ფოსტით);
  - შეფასების შეხსენება.
- პერსონალის კამპანიები (მარკეტინგი / აქცია / სისტემური) ერთ, არჩეულ ან ყველა მომხმარებელზე. მხოლოდ საიტზე, ელ-ფოსტით არ იგზავნება.

#### ბიზნეს-ანალიტიკა

- ადმინის დაფა (`/admin` ხსნის ანალიტიკას):
  - KPI-ები წინა პერიოდთან შედარებით;
  - შემოსავალი და შეკვეთები დროში;
  - სტატუსები, გადახდის მეთოდები, კატეგორიები;
  - პროდუქტები, მომხმარებლები, რჩეულები, შეფასებები.
- დეტალები — [ანალიტიკის](#ka-analytics) სექციაში.

#### ადმინ-პანელი (`/admin`)

| სექცია | შესაძლებლობები |
|---|---|
| ანალიტიკა | ბიზნეს-დაფა (ნაგულისხმევი გვერდი) |
| პროდუქტები | შექმნა / რედაქტირება / წაშლა (წაშლა — მხოლოდ ადმინი); ოფციები და ვარიანტები; ka / en / ru ჩანართები |
| კატეგორიები | CRUD, drag-and-drop დალაგება, ka / en / ru |
| შეკვეთები | სტატისტიკა, ფილტრები, „მართვა" (შემდეგი სტატუსი / გაუქმება), Excel ექსპორტი |
| მომხმარებლები | სია, პერსონალის ანგარიშები, როლები, აქტიურობა (მხოლოდ ადმინი) |
| შეტყობინებები | კამპანიის შექმნა, მიმღების ძებნა, ისტორია |
| შეფასებები | სია, ძებნა / ფილტრები, დამალვა / აღდგენა |

#### ინტერფეისი

- ღია და მუქი თემა.
- ადაპტური დიზაინი 320px-მდე, მობილურზე ქვედა ნავიგაციით.

<a id="ka-roles"></a>

### მომხმარებლის როლები

| როლი | უფლებები |
|---|---|
| `customer` | შოპინგი, შეკვეთები, რჩეულები, შეფასებები, შეტყობინებები |
| `manager` | ადმინ-პანელი: ანალიტიკა, კატალოგი (პროდუქტის წაშლის გარეშე), შეკვეთები, შეტყობინებების კამპანიები, შეფასებების მოდერაცია |
| `admin` | ყველაფერი, რაც მენეჯერს, პლუს პროდუქტის წაშლა და მომხმარებლების მართვა |

ავტორიზაცია სერვერზე მოწმდება (`protect` + `authorize`). Frontend-ის route guard-ები მხოლოდ UX-ისთვისაა.

<a id="ka-stack"></a>

### ტექნოლოგიები

| ფენა | ტექნოლოგიები |
|---|---|
| Frontend | React 18, Vite 5, React Router 6, Axios, i18next + react-i18next, `@react-oauth/google`, Recharts (მხოლოდ ანალიტიკის გვერდზე); სუფთა CSS design token-ებით (UI framework-ის გარეშე) |
| Backend | Node.js, Express 4, Mongoose 8, jsonwebtoken, bcryptjs, google-auth-library, Nodemailer, googleapis (Gmail API), ExcelJS, express-async-handler, cookie-parser, cors, morgan, dotenv |
| მონაცემთა ბაზა | MongoDB (DEV — MongoDB Atlas) |
| ინფრასტრუქტურა | Render (DEV გარემო), MongoDB Atlas |
| Dev ინსტრუმენტები | nodemon, Vite dev server, i18n შემოწმების სკრიპტი |

<a id="ka-structure"></a>

### პროექტის სტრუქტურა

```text
ecommerce-mvp/
├── backend/
│   ├── server.js                 # Express app, CORS, routes, შეცდომების დამუშავება
│   ├── config/db.js              # MongoDB კავშირი
│   ├── constants/                # ბრენდი, checkout-ის კონფიგურაცია, შეკვეთის სტატუსები
│   ├── controllers/              # auth, password, product, category, order, payment, user,
│   │                             # wishlist, review, notification, analytics
│   ├── middleware/               # JWT (protect / optionalAuth), როლები, rate limit, errorHandler
│   ├── models/                   # User, Product, Category, Order, Review, Notification,
│   │                             # NotificationCampaign, Otp, PasswordResetCode
│   ├── routes/apiRoutes.js       # მთავარი API: /api/<resource>-<action>
│   ├── services/
│   │   ├── analytics/            # range (Asia/Tbilisi), base (ბიზნეს-წესები), sales, products,
│   │   │                         # customers, wishlist, reviews
│   │   ├── email/                # mailer (SMTP / Gmail API), შაბლონები, ტექსტები 3 ენაზე
│   │   ├── notifications/        # notify(), არხები (in_app / email), შეკვეთის მოვლენები, კამპანიები
│   │   ├── payments/             # BOG, TBC, sandbox (ბარათით გადახდა გამორთულია)
│   │   ├── adminOrders.js        # სტატუსის workflow, სტატისტიკა, Excel
│   │   ├── orderPayments.js      # შეკვეთის დადასტურების ეფექტები
│   │   ├── productVariants.js    # ვარიანტების ვალიდაცია, მარაგის ჯავშანი
│   │   ├── recommendationService.js
│   │   ├── reviews.js            # შეძენის შემოწმება, რეიტინგის აგრეგატები, მოდერაცია
│   │   ├── wishlist.js
│   │   └── verificationCodes.js
│   └── utils/                    # seed / მიგრაციები, თარგმანები, ძებნა, makeAdmin
├── frontend/
│   ├── scripts/check-i18n.mjs    # თარგმანების დაფარვის შემოწმება
│   └── src/
│       ├── api/axios.js          # API კლიენტი (JWT + Accept-Language)
│       ├── components/           # layout, პროდუქტი, checkout, reviews, admin/analytics...
│       ├── context/              # Auth, Cart, UI, Wishlist, Notification
│       ├── hooks/
│       ├── i18n/                 # i18next, დინამიკური კონტენტი, API შეცდომები, შეტყობინებები
│       ├── locales/              # ka.json, en.json, ru.json
│       ├── pages/                # მაღაზიის გვერდები + pages/admin/
│       └── utils/
└── README.md
```

<a id="ka-architecture"></a>

### Backend-ის არქიტექტურა

```text
HTTP მოთხოვნა
   ↓
routes/apiRoutes.js        /api/<resource>-<action>
   ↓
middleware                 protect · optionalAuth · authorize(role) · rate limit
   ↓
controllers                მოთხოვნის / პასუხის ფორმა (თხელი ფენა)
   ↓
services                   ბიზნეს-ლოგიკა
   ↓
Mongoose models
   ↓
MongoDB
```

ძირითადი სერვისები:

- **შეკვეთები:**
  - `adminOrders.js` — სტატუსის workflow, გაუქმება, სტატისტიკა, Excel ექსპორტი;
  - `orderPayments.js` — დადასტურების ეფექტები.
- **შეტყობინებები** (`services/notifications/`):
  - ერთი `notify()` ფუნქცია, არხები `in_app` და `email`;
  - დუბლიკატის დაცვა `dedupeKey`-ით.
- **შეფასებები** (`services/reviews.js`): შეძენის შემოწმება და რეიტინგის აგრეგატი ერთ ადგილას.
- **ანალიტიკა** (`services/analytics/`):
  - თარიღის დიაპაზონი და ბიზნეს-წესები ცენტრალიზებულია (`range.js`, `base.js`);
  - თითო მოდულს თავისი endpoint აქვს.
- **რეკომენდაციები და ბესტსელერები:** `recommendationService.js`, `productStats.js`.
- **ელ-ფოსტა** (`services/email/`):
  - ერთი mailer, provider — SMTP ან Gmail API;
  - ტექსტები სამ ენაზე.

<a id="ka-database"></a>

### მონაცემთა ბაზა

MongoDB + Mongoose. ძირითადი კოლექციები:

| კოლექცია | შინაარსი |
|---|---|
| `users` | პროფილი, როლი, აქტიურობა, `wishlist[{ product, addedAt }]` |
| `categories` | სახელი, აღწერა, თარგმანები, დალაგება |
| `products` | ფასი, მარაგი, მახასიათებლები, ოფციები / ვარიანტები, თარგმანები, `rating` / `reviewCount` |
| `orders` | snapshot-ები: სახელი, ფასი, ვარიანტი, კატეგორია; `customerInfo`, გადახდა, სტატუსი, `statusHistory`, ენა |
| `reviews` | user, product, rating, comment, verifiedPurchase, status |
| `notifications` | მიმღები, ტიპი, შაბლონი / ტექსტი, ბმული, წაკითხულობა |
| `notificationcampaigns` | პერსონალის კამპანიები და მათი მიწოდების სტატუსი |
| `otps`, `passwordresetcodes` | ერთჯერადი კოდები (hash-ით) |

```text
User ──┬── Orders ── Order items (snapshot) ──→ Product
       ├── Wishlist ──→ Product
       ├── Reviews ──→ Product
       └── Notifications

Product ──→ Category
```

შეკვეთის ხაზი ინახავს შეკვეთის მომენტის ფასს, სახელს, ვარიანტს და (ახალ შეკვეთებში) კატეგორიას. ამიტომ პროდუქტის შემდგომი ცვლილება ისტორიას არ ცვლის.

<a id="ka-orders"></a>

### შეკვეთის workflow

```text
pending → processing → shipped → completed

pending | processing | shipped → cancelled
```

- **შეკვეთის სტატუსი** (`constants/orderStatus.js`):
  - მხოლოდ შემდეგი ნაბიჯია დაშვებული; გამოტოვება ან უკან დაბრუნება შეუძლებელია;
  - `completed` და `cancelled` საბოლოოა;
  - გაუქმებისას დაჯავშნილი ვარიანტის მარაგი ბრუნდება.
- **გადახდის სტატუსი** — ცალკე ველია (`payment.status`):
  - `pending`, `paid`, `pay_on_delivery`, `failed`, `cancelled`, `refunded`;
  - კურიერთან გადახდა `paid` ხდება შეკვეთის დასრულებისას;
  - გადახდილი შეკვეთის გაუქმებისას ინიშნება `refundRequired`.
- ბარათით შეკვეთა რეალურად მხოლოდ გადახდის შემდეგ ითვლება; გადაუხდელი მცდელობა workflow-ში არ შედის.

<a id="ka-reviews"></a>

### შეფასებების არქიტექტურა

- **მოდელი:** ცალკე `Review` მოდელი, ინახავს მხოლოდ მითითებებს User-სა და Product-ზე.
- **დადასტურებული შენაძენი:** მხოლოდ სერვერი ადგენს, `completed` შეკვეთის მიხედვით. frontend-ის `verifiedPurchase` / `userId` იგნორირდება.
- **ვარიანტები:** ნებისმიერი ვარიანტის ყიდვა უფლებას აძლევს მშობელ პროდუქტზე.
- **ერთი შეფასება:** ერთი შეფასება მომხმარებელზე და პროდუქტზე. აპლიკაციის დონეზე და unique index-ით `{ user, product }`.
- **მოდერაცია:** სტატუსები `published` / `hidden`. დამალული არ იშლება და შეიძლება აღდგეს.
- **რეიტინგი:**
  - `Product.rating` / `reviewCount` ერთი ფუნქციით ითვლება, **მხოლოდ გამოქვეყნებული** შეფასებებიდან;
  - თავიდან ითვლება შექმნის, რედაქტირების, წაშლის, დამალვისა და აღდგენის შემდეგ.
- **შეტყობინება:** შეფასების შეხსენება `review_reminder` თითო შეკვეთაზე მაქსიმუმ ერთხელ იქმნება.

<a id="ka-notifications"></a>

### შეტყობინებების არქიტექტურა

- **მიწოდება:** in-app შეტყობინებები წაკითხულ / წაუკითხავ სტატუსით.
  - წაუკითხავების მრიცხველი ნავიგაციისას ან ფანჯრის ფოკუსისას ახლდება, მაქსიმუმ წუთში ერთხელ; ჩამონათვალი იტვირთება ზარის გახსნისას ან `/notifications` გვერდზე.
- **სისტემური მოვლენები:**
  - შეკვეთა მიღებულია (in-app);
  - სტატუსი შეიცვალა (in-app + ელ-ფოსტა, შეკვეთის ენაზე);
  - შეფასების შეხსენება (in-app).
- **ტექსტის ენა:** სისტემური შეტყობინება ინახავს შაბლონსა და პარამეტრებს, ტექსტს მომხმარებლის მიმდინარე ენაზე UI აწყობს.
- **კამპანიები:**
  - ადმინი / მენეჯერი;
  - მიმღები: ერთი მომხმარებელი, არჩეულები ან ყველა კლიენტი (დადასტურებით);
  - ბმული მხოლოდ საიტის შიდა;
  - დუბლირების დაცვა `idempotencyKey`-ით;
  - მხოლოდ in-app.
- **არხები:** სერვისი არხებზეა აგებული (`in_app`, `email`). SMS / push **არ არის რეალიზებული** — მომავლის შესაძლებლობაა.

<a id="ka-analytics"></a>

### ბიზნეს-ანალიტიკა (V1)

ხელმისაწვდომია `/admin/analytics`-ზე (ადმინი / მენეჯერი). ყველა რიცხვი სერვერზე ითვლება.

**ზოგადი წესები**

- **დროის სარტყელი:** `Asia/Tbilisi`. დიაპაზონი ნახევრად ღიაა `[start, end)`.
- **პერიოდები:** დღეს · 7 დღე · 30 დღე · 3 თვე · 1 წელი · საკუთარი პერიოდი (ორივე დღე ჩათვლით, მაქსიმუმ 2 წელი).
- **დაჯგუფება:** საათით, დღით, კვირით ან თვით.
- **შედარება:** წინა პერიოდთან. „დღეს" ედრება „გუშინ, იმავე საათამდე"; საკუთარი პერიოდი — იმავე ხანგრძლივობის უშუალოდ წინა პერიოდს.
- **პერსონალის შეკვეთები:** ადმინისა და მენეჯერის ანგარიშების შეკვეთები და შეფასებები ბიზნეს-მაჩვენებლებში არ შედის.
- **თარიღი:** შეკვეთის განთავსების დრო (`createdAt`).

**ძირითადი განმარტებები**

| მაჩვენებელი | განმარტება |
|---|---|
| კვალიფიციური შეკვეთა | დადასტურებული (კურიერთან / ძველი — ყოველთვის; ბარათით — მხოლოდ გადახდილი) და არა გაუქმებული |
| **შემოსავალი (რეალიზებული)** | **დასრულებული** შეკვეთების `totalPrice`-ის ჯამი |
| **ღია (მოსალოდნელი) ღირებულება** | pending / processing / shipped კვალიფიციური შეკვეთები — **ეს ჯერ არ არის შემოსავალი** |
| შეკვეთები | კვალიფიციური შეკვეთების რაოდენობა |
| AOV | კვალიფიციური შეკვეთების ღირებულება ÷ მათი რაოდენობა |
| მყიდველი მომხმარებლები | განსხვავებული მომხმარებლები ≥1 კვალიფიციური შეკვეთით პერიოდში |
| გაუქმების / დასრულების წილი | გაუქმებული ÷ ყველა დადასტურებული · დასრულებული ÷ (დასრულებული + გაუქმებული) |
| დაბრუნებული მყიდველი | პერიოდშიც ყიდულობს და პერიოდამდეც ჰქონდა კვალიფიციური შეკვეთა |

**სექციები**

- **გაყიდვები:**
  - შემოსავალი და შეკვეთები დროში (Recharts);
  - სტატუსები, გადახდის მეთოდები;
  - გაყიდვები კატეგორიით.
- **პროდუქტები:**
  - ბესტსელერები **რეალურად გაყიდული ერთეულებით**;
  - ტოპ შემოსავლით, **შეკვეთის მომენტის ფასით** (snapshot);
  - სუსტი პროდუქტები: პერიოდის დასაწყისამდე დამატებული, 0 გაყიდვა.
- **მომხმარებლები:**
  - ახალი, დაბრუნებული, ახალი რეგისტრაციები, შეკვეთა მყიდველზე;
  - ტოპ მყიდველები: ელ-ფოსტა ნიღბით, ტელეფონი / მისამართი არ ჩანს.
- **რჩეულები:** მხოლოდ **მიმდინარე მდგომარეობა** (ჩანაწერები, მომხმარებლები, ყველაზე ხშირად რჩეული). თარიღის ფილტრი აქ არ მოქმედებს.
- **შეფასებები:**
  - მხოლოდ გამოქვეყნებული: რაოდენობა, საშუალო, განაწილება, დინამიკა, ყველაზე მეტად შეფასებული;
  - მაღალი / დაბალი რეიტინგი: მინიმუმ 3 შეფასება, ბაიესის საშუალო (m = 3);
  - დამალულების რაოდენობა ცალკე ჩანს, როგორც მოდერაციის მაჩვენებელი.
- **კატეგორიები:**
  - ახალი შეკვეთები კატეგორიას შეკვეთის მომენტში ინახავს;
  - ძველ შეკვეთებში გამოიყენება პროდუქტის მიმდინარე კატეგორია და შედეგი **„შეფასებითად"** მოინიშნება;
  - თუ კატეგორია ვერ დგინდება — „უცნობი კატეგორია".
- **Bundle:** Recharts ცალკე chunk-ად იტვირთება მხოლოდ ანალიტიკის გვერდზე და მაღაზიის გვერდებს არ ამძიმებს.
- **მაღაზიის ბესტსელერები** იმავე დადასტურებული გაყიდვების წესს იყენებს: არც გადაუხდელი ბარათის მცდელობები, არც რეიტინგით „შევსება".

**ცნობილი შეზღუდვები**

- რეალიზებული შემოსავალი შეკვეთის **შექმნის** თარიღს ეკუთვნის და არა დასრულებისას.
- ძველ შეკვეთებს კატეგორიის snapshot არ აქვთ (შედეგი მოინიშნება როგორც შეფასებითი).
- რჩეულების ისტორია (დამატება / წაშლა დროში, რჩეულიდან ყიდვაზე კონვერსია) ვერ აღდგება — ინახება მხოლოდ მიმდინარე მდგომარეობა.
- თანხის დაბრუნება სრულად არ აღირიცხება: `refunded` სტატუსს მიმდინარე flow არ ანიჭებს, `refundRequired` არ იხსნება.
- წაშლილი შეფასება ისტორიაში არ რჩება.
- პერსონალის გამორიცხვა **მიმდინარე** როლით ხდება.

**დაგეგმილი — V1.1** (ჯერ არ არის რეალიზებული)

- შემოსავალი დასრულების თარიღით.
- საშუალო დრო დამუშავებამდე, გაგზავნამდე და დასრულებამდე.

<a id="ka-i18n"></a>

### მრავალენოვნება

- **ენები:** ქართული (`ka`, ნაგულისხმევი და სარეზერვო), ინგლისური (`en`), რუსული (`ru`).
- **UI:** i18next. ტექსტები `frontend/src/locales/{ka,en,ru}.json`-შია, რუსული მრავლობითის ფორმებით.
  - არჩევანი ინახება `localStorage`-ში (`lang`);
  - ბრაუზერის ენა ავტომატურად არ განისაზღვრება.
- **API:** axios ყოველ მოთხოვნას უგზავნის `Accept-Language`-ს. სერვერი მას იყენებს:
  - სახელით სორტირებისთვის;
  - ელ-წერილების ენისთვის.
- **კატალოგის კონტენტი:** საბაზო ველები ქართულია, თარგმანები `translations.en` / `translations.ru`-შია. ეს ეხება:
  - პროდუქტის სახელს, აღწერას, მახასიათებლებს;
  - ოფციებსა და მნიშვნელობებს;
  - კატეგორიებს.

  ადმინში არის **ქართული | English | Русский** ჩანართები.
- **ძებნა** სამივე ენაზე მუშაობს. შეკვეთა ინახავს სახელების თარგმანებს და მომხმარებლის ენას.
- **ელ-წერილები** მომხმარებლის ენაზე იგზავნება. შეცდომები სტაბილური კოდებით ბრუნდება და UI მათ თარგმნის.
- **შეფასებების ტექსტი** მომხმარებლის დაწერილია და **ავტომატურად არ ითარგმნება**.
- **ადმინ-პანელი** განზრახ მხოლოდ ქართულ ენაზეა.

<a id="ka-api"></a>

### API — მიმოხილვა

ყველა endpoint ფორმატით `/api/<resource>-<action>`, `backend/routes/apiRoutes.js`.
„Staff" = ადმინი ან მენეჯერი.

| დომენი | მაგალითები | წვდომა |
|---|---|---|
| Auth | `auth-register`, `auth-login`, `auth-google-login`, `auth-verification-code-*`, `auth-password-reset*`, `auth-password-change`, `auth-profile`, `auth-profile-update` | Public / Private |
| კატეგორიები | `category-list`, `category-details/:id`; `category-create`, `-update`, `-reorder`, `-delete` | Public / Staff |
| პროდუქტები | `product-list`, `product-details/:id`, `product-best-sellers`, `product-recommended`; `product-create`, `-update`; `product-delete` | Public / Staff / Admin |
| შეკვეთები | `order-checkout-options`; `order-create`, `order-my-list`, `order-cancel/:id`; `order-list`, `order-export`, `order-status-update/:id`, `order-admin-cancel/:id` | Public / Private / Staff |
| მომხმარებლები | `user-list`, `user-create`, `user-update/:id`, `user-role-update/:id`, `user-status-update/:id`, `user-delete/:id` | Admin |
| რჩეულები | `wishlist-list`, `wishlist-ids`, `wishlist-count`, `wishlist-add/:productId`, `wishlist-remove/:productId` | Private |
| შეფასებები | `review-list/:productId`, `review-summary/:productId` | Public |
| | `review-eligibility/:productId`, `review-my-status`, `review-create/:productId`, `review-update/:id`, `review-delete/:id` | Private |
| | `review-admin-list`, `review-hide/:id`, `review-restore/:id` | Staff |
| შეტყობინებები | `notification-list`, `notification-unread-count`, `notification-read/:id`, `notification-read-all` | Private |
| | `notification-campaign-list`, `notification-campaign-create`, `notification-recipient-search` | Staff |
| გადახდა | `payment-init/:orderId`, `payment-status/:orderId` (ბარათი — გამორთულია) | Private |

**ანალიტიკა** (მხოლოდ Staff, `?range=today|7d|30d|3m|1y|custom&from=YYYY-MM-DD&to=YYYY-MM-DD`):

```text
GET /api/analytics-summary
GET /api/analytics-sales
GET /api/analytics-products      (?limit ≤ 20)
GET /api/analytics-customers
GET /api/analytics-reviews
GET /api/analytics-wishlist      (მიმდინარე მდგომარეობა — დიაპაზონი არ გამოიყენება)
```

სხვა endpoint-ები:

- `GET /api/health` — მდგომარეობის შემოწმება.
- `POST /api/dev-access/verify` — DEV-გარემოს წვდომის კოდი.
- ძველი REST მისამართები (`/api/products`, `/api/orders`, …) თავსებადობისთვის ჯერ კიდევ პასუხობს `Deprecation: true` header-ით.

<a id="ka-env"></a>

### გარემოს ცვლადები

ორივე აპლიკაცია `.env` ფაილს კითხულობს (git-ში არ ინახება). საწყისად გამოიყენეთ `.env.example`.
ქვემოთ მხოლოდ **სახელებია** — რეალური მნიშვნელობები არასდროს ჩაწეროთ README-ში ან git-ში.

**Backend** (`backend/.env`)

| ჯგუფი | ცვლადები |
|---|---|
| სერვერი | `PORT`, `NODE_ENV`, `CLIENT_URL` (frontend-ის origin — CORS და ბმულები წერილებში) |
| ბაზა | `MONGO_URI` |
| ავთენტიფიკაცია | `JWT_SECRET`, `JWT_EXPIRES_IN`, `GOOGLE_CLIENT_ID` |
| ელ-ფოსტა | `EMAIL_PROVIDER` (`gmail_api` → Gmail API; სხვა მნიშვნელობა / ცარიელი → SMTP), `SMTP_USER` (გამგზავნის მისამართი ორივე რეჟიმში), `EMAIL_REPLY_TO` (არასავალდებულო) |
| SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_PASS` |
| Gmail API | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` |
| DEV წვდომა | `DEV_ACCESS_CODE` (საიტის გახსნის კოდი; frontend-ის gate ყოველთვის აქტიურია) |
| ბარათით გადახდა (გამორთულია) | `CARD_PAYMENTS_ENABLED`, `PUBLIC_API_URL`, `ALLOW_SANDBOX_PAYMENTS`, `BOG_CLIENT_ID`, `BOG_CLIENT_SECRET`, `BOG_AUTH_URL`, `BOG_API_URL`, `TBC_API_KEY`, `TBC_CLIENT_ID`, `TBC_CLIENT_SECRET`, `TBC_API_URL` |

**Frontend** (`frontend/.env`)

| ცვლადი | დანიშნულება |
|---|---|
| `VITE_API_URL` | API-ს მისამართი (მაგ. `http://localhost:5000/api`) |
| `VITE_GOOGLE_CLIENT_ID` | იგივე Google OAuth Client ID, რაც backend-ზე |

`VITE_*` ცვლადები build-ის დროს ჩაიწერება.
Google-ით შესვლისთვის Google Cloud Console-ში შექმენით „Web application" OAuth Client ID და დაამატეთ frontend-ის origin ჩამონათვალში **Authorized JavaScript origins**.

<a id="ka-dev"></a>

### ლოკალური გაშვება

**მოთხოვნები**

- Node.js 18+;
- MongoDB (ლოკალური ან Atlas);
- Google OAuth Client ID;
- ელ-ფოსტის გაგზავნის შესაძლებლობა (SMTP ან Gmail API). კონსოლში ბეჭდვის რეჟიმი აღარ არსებობს — ლოკალურად შეგიძლიათ გამოიყენოთ ტესტური SMTP სერვერი.

```bash
git clone https://github.com/LukaKakhniashvili/TamiShop.git
cd TamiShop

cp backend/.env.example backend/.env      # შეავსეთ მნიშვნელობები
cp frontend/.env.example frontend/.env

cd backend && npm install && npm run dev            # API: http://localhost:5000
cd ../frontend && npm install && npm run dev        # UI:  http://localhost:5173
```

**სკრიპტები**

| ადგილი | ბრძანება | აღწერა |
|---|---|---|
| backend | `npm run dev` | API nodemon-ით |
| backend | `npm start` | API node-ით |
| frontend | `npm run dev` | Vite dev server |
| frontend | `npm run build` | production build → `frontend/dist` |
| frontend | `npm run preview` | build-ის ლოკალური ნახვა |
| frontend | `npm run i18n:check` | თარგმანის ყველა გასაღები არსებობს `ka`/`en`/`ru`-ში (მრავლობითის ჩათვლით) |

**პირველი ადმინი**

1. დარეგისტრირდით (ან შედით Google-ით).
2. გაუშვით `node utils/makeAdmin.js <email>` (`backend/` საქაღალდიდან).
3. თავიდან შედით სისტემაში. Header-ში გამოჩნდება „პანელი".

<a id="ka-maintenance"></a>

### სკრიპტები და მიგრაციები

> ⚠️ ყველა სკრიპტი ბაზაში წერს `MONGO_URI`-ის მიხედვით. გაშვებამდე დარწმუნდით, რომელ ბაზასთან ხართ დაკავშირებული, და გააკეთეთ backup.

| ბრძანება (`backend/`) | აღწერა |
|---|---|
| `npm run seed:catalog` | სადემონსტრაციო კატალოგის დამატება / განახლება slug-ით (`-- --dry-run` — მხოლოდ შემოწმება). რეიტინგი 0-ზე დგება — ის მხოლოდ რეალური შეფასებებიდან ითვლება. |
| `npm run seed` | **შლის ყველა კატეგორიასა და პროდუქტს** და ამატებს მცირე დემო ნაკრებს. რეალურ ბაზაზე არასდროს გაუშვათ. |
| `npm run migrate:translations` | EN/RU თარგმანების შევსება არსებულ კონტენტში (`-- --dry-run`, `-- --force`). იდემპოტენტურია. |
| `node utils/makeAdmin.js <email>` | არსებულ მომხმარებელს ანიჭებს `admin` როლს |

**ისტორიული მიგრაცია — შეფასებების აგრეგატები**

ერთჯერადი მიგრაცია (Reviews ფუნქციასთან ერთად):

- `Product.rating` / `reviewCount` მხოლოდ რეალური, გამოქვეყნებული შეფასებებიდან ითვლება;
- იშლება seed-ის სადემონსტრაციო მახასიათებელი „რეიტინგი" (en/ru თარგმანებთან ერთად).

DEV ბაზაზე უკვე შესრულებულია. ახალ გარემოში მხოლოდ მაშინ სჭირდება, თუ კატალოგი ძველი seed-ით შეიქმნა.

```bash
npm run migrate:review-aggregates -- --dry-run          # ანგარიში, არაფერი იწერება
npm run migrate:review-aggregates                       # backup → ჩაწერა
npm run migrate:review-aggregates -- --restore=FILE     # backup-იდან დაბრუნება
```

- **backup:** ჩაწერამდე იქმნება `backend/backups/`-ში. საქაღალდე git-ში არ ინახება.
- **ფარგლები:** იცვლება მხოლოდ ზემოთ ჩამოთვლილი ველები.
- **იდემპოტენტურობა:** განმეორებითი გაშვება ცვლილებას აღარ ქმნის.

<a id="ka-deploy"></a>

### Deployment

| გარემო | სტატუსი | არქიტექტურა |
|---|---|---|
| **DEV** | მოქმედებს | Frontend → Render · Backend API → Render · ბაზა → MongoDB Atlas · ელ-ფოსტა → Gmail API (`EMAIL_PROVIDER=gmail_api`) · საიტი დაცულია წვდომის კოდით (`DEV_ACCESS_CODE`) |
| **PROD** | დაგეგმილი | ჯერ არ არის გაშლილი |

სერვისების კონფიგურაცია Render-ის dashboard-შია; deployment-ის ფაილი რეპოზიტორიაში არ ინახება.

Production-ისთვის საჭიროა:

- `NODE_ENV=production`;
- ძლიერი `JWT_SECRET`;
- სწორი `CLIENT_URL` და `VITE_API_URL`;
- ელ-ფოსტის პროვაიდერი და SPF / DKIM / DMARC გამგზავნი დომენისთვის;
- ბარათით გადახდის ჩართვამდე — ბანკის რეალური ინტეგრაცია.

<a id="ka-security"></a>

### უსაფრთხოება

რეალიზებული კონტროლები:

- **ავთენტიფიკაცია:**
  - პაროლები **bcrypt**-ით ჰეშირდება და API-ით არასდროს ბრუნდება;
  - **JWT** ავთენტიფიკაცია; პაროლის შეცვლამდე / აღდგენამდე გაცემული ტოკენი უარიყოფა;
  - დეაქტივირებული ანგარიში იბლოკება.
- **ავტორიზაცია:**
  - როლები სერვერზე მოწმდება ყველა დაცულ route-ზე;
  - ანალიტიკის, მოდერაციის, კამპანიების და შეკვეთების მართვის API მხოლოდ ადმინისა და მენეჯერისთვისაა.
- **Google:** ID ტოკენი სერვერზე მოწმდება `GOOGLE_CLIENT_ID`-ის მიმართ.
- **ერთჯერადი კოდები:**
  - ინახება hash-ით, მოქმედებს 3 წუთი;
  - ხელახლა გაგზავნა 30 წამის შემდეგ, მაქსიმუმ 5 მცდელობა;
  - აღდგენის ტოკენი ერთჯერადია.
- **Rate limit** (in-memory): კოდის გაგზავნა / შემოწმება, პაროლის აღდგენა, პაროლის შეცვლა.
- **შეკვეთები:** ფასი, ფასდაკლება და მარაგი სერვერზე ითვლება. ვარიანტის მარაგი ატომურად იჯავშნება.
- **შეფასებები:** შეძენა მხოლოდ სერვერზე მოწმდება; მომხმარებელს მხოლოდ საკუთარი შეფასების შეცვლა შეუძლია.
- **კონფიდენციალურობა:**
  - ანალიტიკაში მომხმარებლის ელ-ფოსტა ნიღბით ჩანს, ტელეფონი და მისამართი არ ბრუნდება;
  - შეფასებებში მხოლოდ „სახელი + გვარის პირველი ასო" ჩანს.
- **ბარათის მონაცემები:** მაღაზია არ იღებს და არ ინახავს. დაგეგმილი flow ბანკის hosted გვერდს იყენებს.
- **საიდუმლოებები:** მხოლოდ გარემოს ცვლადებიდან; `.env` git-ში არ ინახება.
- **`DEV_ACCESS_CODE`** — ტესტური გარემოს „კარიბჭეა", ავთენტიფიკაციის მექანიზმი არ არის.

<a id="ka-quality"></a>

### ხარისხი და შემოწმება

- `npm run i18n:check` — თარგმანების სისრულე სამივე ენაზე (მათ შორის placeholder-ები და მრავლობითი).
- `npm run build` — Vite production build.
- ავტომატური ტესტების suite რეპოზიტორიაში ჯერ არ არის.
  - ფუნქციები შემოწმდა ლოკალური API- და ბრაუზერის რეგრესიული სკრიპტებით, დროებით ტესტურ მონაცემებზე;
  - ეს სკრიპტები რეპოზიტორიის ნაწილი არ არის.

<a id="ka-roadmap"></a>

### Roadmap

**რეალიზებული**

- ავთენტიფიკაცია (ელ-ფოსტა + OTP, Google), პაროლის მართვა, როლები.
- კატალოგი ვარიანტებით, სამენოვანი კონტენტი და ძებნა.
- Checkout კურიერთან გადახდით, შეკვეთები, სტატუსის workflow, თვალყურის დევნება.
- რჩეულები, შეტყობინებების ცენტრი, შეფასებები და რეიტინგები.
- ბიზნეს-ანალიტიკა V1; მაღაზიის ბესტსელერები რეალური გაყიდვებით.

**დაგეგმილი / მომავალი**

- ანალიტიკა V1.1: შემოსავალი დასრულების თარიღით; საშუალო დრო დამუშავებამდე / გაგზავნამდე / დასრულებამდე.
- ბარათით გადახდის ჩართვა (BOG / TBC) ბანკის ინტეგრაციის დასრულების შემდეგ.
- PROD გარემო.
- სურვილისამებრ (საჭიროებს მოვლენების აღრიცხვას):
  - რჩეულების ისტორია და კონვერსია;
  - ნახვები, ძებნის ანალიტიკა, მიტოვებული კალათები;
  - კამპანიების კონვერსია.

### Git

პირადი პროექტი. ცვლილებები შეიტანეთ ცალკე branch-ში და commit-ში:

```bash
git checkout -b feature/my-change
git add <files>
git commit -m "Describe the change"
git push -u origin feature/my-change
```

`.env` ფაილები და `backend/backups/` git-ში არ უნდა მოხვდეს.

---

<a id="en"></a>

## 🇬🇧 English

**Contents:**
[Overview](#en-overview) ·
[Status](#en-status) ·
[Features](#en-features) ·
[Roles](#en-roles) ·
[Tech stack](#en-stack) ·
[Structure](#en-structure) ·
[Architecture](#en-architecture) ·
[Database](#en-database) ·
[Order workflow](#en-orders) ·
[Reviews](#en-reviews) ·
[Notifications](#en-notifications) ·
[Analytics](#en-analytics) ·
[Localization](#en-i18n) ·
[API](#en-api) ·
[Environment](#en-env) ·
[Local development](#en-dev) ·
[Scripts & migrations](#en-maintenance) ·
[Deployment](#en-deploy) ·
[Security](#en-security) ·
[Quality](#en-quality) ·
[Roadmap](#en-roadmap)

<a id="en-overview"></a>

### Overview

Tam\`i Shop is a full-stack e-commerce application for the Georgian market: a **React (Vite)** storefront and admin panel, a **Node.js + Express** REST API, and **MongoDB**.

Customers can:

- browse categories and products and choose product variants (color, storage, …);
- save products to a wishlist and check out with payment on delivery;
- track order status and review the products they bought;
- receive in-app and email notifications.

Staff (admin / manager) manage:

- the catalog, orders and users;
- review moderation and notifications;
- the business analytics dashboard.

The storefront is available in Georgian, English and Russian.

> The brand name is written **Tam\`i Shop**, with a backtick (U+0060) between "Tam" and "i". It is defined once per app: `frontend/src/constants.js` (`BRAND`) and `backend/constants/brand.js` (emails).

<a id="en-status"></a>

### Development status

| Module | Status |
|---|---|
| Authentication, profile, roles | ✅ Implemented |
| Catalog, variants, search, multilingual content | ✅ Implemented |
| Cart, checkout (payment on delivery) | ✅ Implemented |
| Orders, order tracking (timeline) | ✅ Implemented |
| Wishlist | ✅ Implemented |
| Notification Center | ✅ Implemented |
| Reviews & Ratings | ✅ Implemented |
| Business Analytics V1 | ✅ Implemented |
| Card payments (BOG / TBC) | ⏸ Code exists, disabled |
| Analytics V1.1 (order lifecycle times) | 🗓 Planned |

<a id="en-features"></a>

### Features

#### Authentication & account

- Registration with email verification (4-digit one-time code), login, Google sign-in.
- Password recovery by code, password change (other sessions are revoked), logout.
- Profile: personal data, address, "My Orders", "Wishlist".
- Deactivated accounts cannot sign in.

#### Catalog

- Categories (drag-and-drop ordering in admin) and products.
- Product page: gallery, rich-text description, specifications (key/value), discounts.
- **Options and variants:** e.g. color, storage, size. Each variant has its own price, old price, stock, SKU and active flag.
- Catalog and category pages: search in three languages, sorting (newest, name, price, discount), discount filters, pagination.
- Home page sections:
  - hot deals;
  - **best sellers** — real, confirmed sales only;
  - new arrivals;
  - personalized recommendations (views, cart, purchases).
- Product cards show the rating (★ average and count) without extra requests.

#### Shopping

- **Cart:** stored in `localStorage`; each line is product + variant.
- **Wishlist:** ❤ on cards and the product page, header counter, a tab in the profile.
  - Guests are sent to log in first; the product is added automatically after login.
- **Checkout** (three steps): delivery → payment → confirmation.
  - Delivery: list of Georgian cities, address; free delivery in 2–6 business days.
  - The only active payment method is **payment on delivery**. Card payment is shown as "Coming soon".
- Prices, discounts and totals are always calculated on the server. Variant stock is reserved atomically.

#### Orders

- **My Orders:** order number, status, payment state, items with selected options, total.
- **Order tracking:** a dated status timeline (`statusHistory`), including the cancelled state.
- **Notification links** (`/profile?tab=orders&order=<id>`) open and highlight the specific order.
- **Cancellation:**
  - confirmed orders can be cancelled by staff only;
  - customers can only cancel their own unpaid card attempts.
- **Completed orders** show "Write a review" or "View/edit review" for each product.

#### Reviews & ratings

- 1–5 stars plus a written comment (3–2000 characters).
- **Verified purchase:** reviews are allowed only for products bought in a completed order. The check runs on the server.
- One review per user per product. Users can edit and delete their own review.
- On the product page:
  - average, count, distribution (5★…1★, usable as a filter);
  - sorting (newest / highest / lowest), "Load more".
- Admin and manager moderation: hide / restore.
- When an order is completed, a "How was your purchase?" reminder is created.

#### Notification Center

- A header bell: unread count, recent notifications, "mark all as read".
- A full page at `/notifications`.
- Automatic notifications:
  - order received;
  - status change (in-app and email);
  - review reminder.
- Staff campaigns (marketing / promotion / system) to one user, selected users or all customers. In-app only, not sent by email.

#### Business analytics

- Admin dashboard (`/admin` opens Analytics):
  - KPIs compared with the previous period;
  - revenue and orders over time;
  - statuses, payment methods, categories;
  - products, customers, wishlist, reviews.
- Details in [Analytics](#en-analytics).

#### Admin panel (`/admin`)

| Section | Capabilities |
|---|---|
| Analytics | Business dashboard (default page) |
| Products | Create / edit / delete (delete: admin only); options and variants; ka / en / ru tabs |
| Categories | CRUD, drag-and-drop ordering, ka / en / ru |
| Orders | Statistics, filters, "Manage" (next status / cancel), Excel export |
| Users | List, staff accounts, roles, activation (admin only) |
| Notifications | Create campaigns, recipient search, history |
| Reviews | List, search / filters, hide / restore |

#### UI

- Light and dark themes.
- Responsive layouts down to 320px, with bottom navigation on mobile.

<a id="en-roles"></a>

### User roles

| Role | Permissions |
|---|---|
| `customer` | Shopping, orders, wishlist, reviews, notifications |
| `manager` | Admin panel: analytics, catalog (except deleting products), orders, notification campaigns, review moderation |
| `admin` | Everything a manager can do, plus deleting products and managing users |

Authorization is enforced on the server (`protect` + `authorize`). Frontend route guards are for UX only.

<a id="en-stack"></a>

### Tech stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, Vite 5, React Router 6, Axios, i18next + react-i18next, `@react-oauth/google`, Recharts (Analytics page only); plain CSS with design tokens (no UI framework) |
| Backend | Node.js, Express 4, Mongoose 8, jsonwebtoken, bcryptjs, google-auth-library, Nodemailer, googleapis (Gmail API), ExcelJS, express-async-handler, cookie-parser, cors, morgan, dotenv |
| Database | MongoDB (DEV: MongoDB Atlas) |
| Infrastructure | Render (DEV environment), MongoDB Atlas |
| Dev tools | nodemon, Vite dev server, i18n check script |

<a id="en-structure"></a>

### Project structure

```text
ecommerce-mvp/
├── backend/
│   ├── server.js                 # Express app, CORS, routes, error handling
│   ├── config/db.js              # MongoDB connection
│   ├── constants/                # brand, checkout configuration, order statuses
│   ├── controllers/              # auth, password, product, category, order, payment, user,
│   │                             # wishlist, review, notification, analytics
│   ├── middleware/               # JWT (protect / optionalAuth), roles, rate limit, errorHandler
│   ├── models/                   # User, Product, Category, Order, Review, Notification,
│   │                             # NotificationCampaign, Otp, PasswordResetCode
│   ├── routes/apiRoutes.js       # main API: /api/<resource>-<action>
│   ├── services/
│   │   ├── analytics/            # range (Asia/Tbilisi), base (business rules), sales, products,
│   │   │                         # customers, wishlist, reviews
│   │   ├── email/                # mailer (SMTP / Gmail API), templates, texts in 3 languages
│   │   ├── notifications/        # notify(), channels (in_app / email), order events, campaigns
│   │   ├── payments/             # BOG, TBC, sandbox (card payments disabled)
│   │   ├── adminOrders.js        # status workflow, statistics, Excel
│   │   ├── orderPayments.js      # order confirmation effects
│   │   ├── productVariants.js    # variant validation, stock reservation
│   │   ├── recommendationService.js
│   │   ├── reviews.js            # purchase check, rating aggregates, moderation
│   │   ├── wishlist.js
│   │   └── verificationCodes.js
│   └── utils/                    # seed / migrations, translations, search, makeAdmin
├── frontend/
│   ├── scripts/check-i18n.mjs    # translation coverage check
│   └── src/
│       ├── api/axios.js          # API client (JWT + Accept-Language)
│       ├── components/           # layout, product, checkout, reviews, admin/analytics…
│       ├── context/              # Auth, Cart, UI, Wishlist, Notification
│       ├── hooks/
│       ├── i18n/                 # i18next, dynamic content, API errors, notifications
│       ├── locales/              # ka.json, en.json, ru.json
│       ├── pages/                # storefront pages + pages/admin/
│       └── utils/
└── README.md
```

<a id="en-architecture"></a>

### Backend architecture

```text
HTTP request
   ↓
routes/apiRoutes.js        /api/<resource>-<action>
   ↓
middleware                 protect · optionalAuth · authorize(role) · rate limit
   ↓
controllers                request / response shaping (thin layer)
   ↓
services                   business logic
   ↓
Mongoose models
   ↓
MongoDB
```

Key services:

- **Orders:**
  - `adminOrders.js` — status workflow, cancellation, statistics, Excel export;
  - `orderPayments.js` — confirmation effects.
- **Notifications** (`services/notifications/`):
  - one `notify()` function with `in_app` and `email` channels;
  - duplicate protection through `dedupeKey`.
- **Reviews** (`services/reviews.js`): purchase verification and rating aggregates in one place.
- **Analytics** (`services/analytics/`):
  - date ranges and business rules are centralized (`range.js`, `base.js`);
  - each module has its own endpoint.
- **Recommendations and best sellers:** `recommendationService.js`, `productStats.js`.
- **Email** (`services/email/`):
  - one mailer; the provider is SMTP or the Gmail API;
  - texts in three languages.

<a id="en-database"></a>

### Database

MongoDB + Mongoose. Main collections:

| Collection | Contents |
|---|---|
| `users` | Profile, role, active flag, `wishlist[{ product, addedAt }]` |
| `categories` | Name, description, translations, order |
| `products` | Price, stock, specifications, options / variants, translations, `rating` / `reviewCount` |
| `orders` | Snapshots: name, price, variant, category; `customerInfo`, payment, status, `statusHistory`, language |
| `reviews` | user, product, rating, comment, verifiedPurchase, status |
| `notifications` | Recipient, type, template / text, link, read state |
| `notificationcampaigns` | Staff campaigns and their delivery status |
| `otps`, `passwordresetcodes` | One-time codes (hashed) |

```text
User ──┬── Orders ── Order items (snapshot) ──→ Product
       ├── Wishlist ──→ Product
       ├── Reviews ──→ Product
       └── Notifications

Product ──→ Category
```

Each order line stores the price, name, variant and (in new orders) category at the time of the order. Later product changes therefore don't alter order history.

<a id="en-orders"></a>

### Order workflow

```text
pending → processing → shipped → completed

pending | processing | shipped → cancelled
```

- **Order status** (`constants/orderStatus.js`):
  - only the next step is allowed; no skipping or going back;
  - `completed` and `cancelled` are final;
  - cancelling releases reserved variant stock.
- **Payment status** is a separate field (`payment.status`):
  - `pending`, `paid`, `pay_on_delivery`, `failed`, `cancelled`, `refunded`;
  - payment on delivery becomes `paid` when the order is completed;
  - cancelling a paid order sets `refundRequired`.
- A card order only counts once it is paid; unpaid attempts never enter the workflow.

<a id="en-reviews"></a>

### Reviews architecture

- **Model:** a separate `Review` model that stores only references to the User and Product.
- **Verified purchase:** determined by the server only, from `completed` orders. Any `verifiedPurchase` / `userId` sent by the frontend is ignored.
- **Variants:** buying any variant makes the parent product eligible.
- **One review:** one review per user and product, enforced in the application and by a unique `{ user, product }` index.
- **Moderation:** statuses `published` / `hidden`. Hidden reviews are kept and can be restored.
- **Ratings:**
  - `Product.rating` / `reviewCount` are calculated by one function from **published reviews only**;
  - they are recalculated after create, edit, delete, hide and restore.
- **Notifications:** at most one `review_reminder` is created per order.

<a id="en-notifications"></a>

### Notification architecture

- **Delivery:** in-app notifications with read/unread state.
  - The unread count refreshes on navigation or window focus, at most once a minute; the list loads when the bell or the `/notifications` page is opened.
- **System events:**
  - order received (in-app);
  - status changed (in-app + email, in the order's language);
  - review reminder (in-app).
- **Text language:** system notifications store a template and parameters, and the UI renders the text in the user's current language.
- **Campaigns:**
  - admin / manager;
  - recipients: one user, selected users or all customers (with confirmation);
  - internal site links only;
  - duplicate protection through `idempotencyKey`;
  - in-app only.
- **Channels:** the service is built around channels (`in_app`, `email`). SMS / push are **not implemented**; they are possible future work.

<a id="en-analytics"></a>

### Business analytics (V1)

Available at `/admin/analytics` (admin / manager). Every number is calculated on the server.

**General rules**

- **Time zone:** `Asia/Tbilisi`. Ranges are half-open `[start, end)`.
- **Periods:** Today · 7 days · 30 days · 3 months · 1 year · custom range (both days inclusive, maximum 2 years).
- **Grouping:** by hour, day, week or month.
- **Comparison:** with the previous period. "Today" is compared with "yesterday up to the same hour"; a custom range is compared with the immediately preceding range of equal length.
- **Staff orders:** orders and reviews from admin and manager accounts are excluded from business metrics.
- **Date:** the time the order was placed (`createdAt`).

**Key definitions**

| Metric | Definition |
|---|---|
| Qualified order | Confirmed (payment on delivery / legacy: always; card: only when paid) and not cancelled |
| **Revenue (realized)** | Sum of `totalPrice` of **completed** orders |
| **Open (expected) order value** | Pending / processing / shipped qualified orders — **not yet revenue** |
| Orders | Number of qualified orders |
| AOV | Qualified order value ÷ number of qualified orders |
| Purchasing customers | Distinct customers with at least one qualified order in the period |
| Cancellation / completion rate | Cancelled ÷ all confirmed · completed ÷ (completed + cancelled) |
| Returning customer | Bought in the period and also had a qualified order before it started |

**Sections**

- **Sales:**
  - revenue and orders over time (Recharts);
  - statuses, payment methods;
  - sales by category.
- **Products:**
  - best sellers by **real units sold**;
  - top by revenue, using the **order-time price** (snapshot);
  - low performers: listed before the period started, 0 sales.
- **Customers:**
  - new, returning, new registrations, orders per customer;
  - top customers: masked email; no phone or address.
- **Wishlist:** **current state only** (entries, users, most wishlisted). The date filter doesn't apply here.
- **Reviews:**
  - published reviews only: count, average, distribution, over time, most reviewed;
  - highest / lowest rated: at least 3 reviews, Bayesian average (m = 3);
  - the number of hidden reviews is shown separately as a moderation metric.
- **Categories:**
  - new orders store the category at order time;
  - older orders use the product's current category and are marked **"estimated"**;
  - if no category can be resolved — "Unknown category".
- **Bundle:** Recharts is loaded as a separate chunk only on the Analytics page and doesn't affect storefront pages.
- **Storefront best sellers** use the same confirmed-sales rule: no unpaid card attempts and no rating-based filler.

**Known limitations**

- Realized revenue belongs to the order's **creation** date, not its completion date.
- Older orders have no category snapshot (results are marked estimated).
- Wishlist history (adds / removals over time, wishlist-to-purchase conversion) can't be reconstructed; only the current state is stored.
- Completed refunds aren't fully tracked: current flows never set the `refunded` status, and `refundRequired` is never cleared.
- Deleted reviews don't remain in review history.
- Staff exclusion uses each account's **current** role.

**Planned — V1.1** (not implemented yet)

- Revenue by completion date.
- Average time to processing, shipment and completion.

<a id="en-i18n"></a>

### Localization

- **Languages:** Georgian (`ka`, default and fallback), English (`en`), Russian (`ru`).
- **UI:** i18next. Texts live in `frontend/src/locales/{ka,en,ru}.json`, with Russian plural forms.
  - The choice is saved in `localStorage` (`lang`);
  - the browser language is not auto-detected.
- **API:** axios sends `Accept-Language` with every request. The server uses it for:
  - name sorting;
  - email language.
- **Catalog content:** base fields are Georgian; translations live in `translations.en` / `translations.ru`. This covers:
  - product name, description and specifications;
  - options and values;
  - categories.

  The admin panel has **ქართული | English | Русский** tabs.
- **Search** works in all three languages. Orders store name translations and the customer's language.
- **Emails** are sent in the customer's language. Errors are returned as stable codes, which the UI translates.
- **Review text** is written by users and is **not translated automatically**.
- **The admin panel** is intentionally Georgian-only.

<a id="en-api"></a>

### API overview

All endpoints use the `/api/<resource>-<action>` format and live in `backend/routes/apiRoutes.js`.
"Staff" = admin or manager.

| Domain | Examples | Access |
|---|---|---|
| Auth | `auth-register`, `auth-login`, `auth-google-login`, `auth-verification-code-*`, `auth-password-reset*`, `auth-password-change`, `auth-profile`, `auth-profile-update` | Public / Private |
| Categories | `category-list`, `category-details/:id`; `category-create`, `-update`, `-reorder`, `-delete` | Public / Staff |
| Products | `product-list`, `product-details/:id`, `product-best-sellers`, `product-recommended`; `product-create`, `-update`; `product-delete` | Public / Staff / Admin |
| Orders | `order-checkout-options`; `order-create`, `order-my-list`, `order-cancel/:id`; `order-list`, `order-export`, `order-status-update/:id`, `order-admin-cancel/:id` | Public / Private / Staff |
| Users | `user-list`, `user-create`, `user-update/:id`, `user-role-update/:id`, `user-status-update/:id`, `user-delete/:id` | Admin |
| Wishlist | `wishlist-list`, `wishlist-ids`, `wishlist-count`, `wishlist-add/:productId`, `wishlist-remove/:productId` | Private |
| Reviews | `review-list/:productId`, `review-summary/:productId` | Public |
| | `review-eligibility/:productId`, `review-my-status`, `review-create/:productId`, `review-update/:id`, `review-delete/:id` | Private |
| | `review-admin-list`, `review-hide/:id`, `review-restore/:id` | Staff |
| Notifications | `notification-list`, `notification-unread-count`, `notification-read/:id`, `notification-read-all` | Private |
| | `notification-campaign-list`, `notification-campaign-create`, `notification-recipient-search` | Staff |
| Payments | `payment-init/:orderId`, `payment-status/:orderId` (card — disabled) | Private |

**Analytics** (Staff only, `?range=today|7d|30d|3m|1y|custom&from=YYYY-MM-DD&to=YYYY-MM-DD`):

```text
GET /api/analytics-summary
GET /api/analytics-sales
GET /api/analytics-products      (?limit ≤ 20)
GET /api/analytics-customers
GET /api/analytics-reviews
GET /api/analytics-wishlist      (current state — the range is not applied)
```

Other endpoints:

- `GET /api/health` — health check.
- `POST /api/dev-access/verify` — DEV environment access code.
- The older REST paths (`/api/products`, `/api/orders`, …) still respond for compatibility, with a `Deprecation: true` header.

<a id="en-env"></a>

### Environment variables

Both apps read a `.env` file, which is not stored in git. Start from `.env.example`.
Only variable **names** are listed below — never put real values in the README or in git.

**Backend** (`backend/.env`)

| Group | Variables |
|---|---|
| Server | `PORT`, `NODE_ENV`, `CLIENT_URL` (frontend origin — CORS and links in emails) |
| Database | `MONGO_URI` |
| Auth | `JWT_SECRET`, `JWT_EXPIRES_IN`, `GOOGLE_CLIENT_ID` |
| Email | `EMAIL_PROVIDER` (`gmail_api` → Gmail API; any other value / empty → SMTP), `SMTP_USER` (sender address in both modes), `EMAIL_REPLY_TO` (optional) |
| SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_PASS` |
| Gmail API | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` |
| DEV access | `DEV_ACCESS_CODE` (code to open the site; the frontend gate is always active) |
| Card payments (disabled) | `CARD_PAYMENTS_ENABLED`, `PUBLIC_API_URL`, `ALLOW_SANDBOX_PAYMENTS`, `BOG_CLIENT_ID`, `BOG_CLIENT_SECRET`, `BOG_AUTH_URL`, `BOG_API_URL`, `TBC_API_KEY`, `TBC_CLIENT_ID`, `TBC_CLIENT_SECRET`, `TBC_API_URL` |

**Frontend** (`frontend/.env`)

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | API base URL (e.g. `http://localhost:5000/api`) |
| `VITE_GOOGLE_CLIENT_ID` | The same Google OAuth Client ID as the backend |

`VITE_*` variables are embedded at build time.
For Google sign-in, create a "Web application" OAuth Client ID in the Google Cloud Console and add the frontend origin under **Authorized JavaScript origins**.

<a id="en-dev"></a>

### Local development

**Prerequisites**

- Node.js 18+;
- MongoDB (local or Atlas);
- a Google OAuth Client ID;
- a way to send email (SMTP or the Gmail API). There is no console-only email mode anymore; locally you can use a test SMTP server.

```bash
git clone https://github.com/LukaKakhniashvili/TamiShop.git
cd TamiShop

cp backend/.env.example backend/.env      # fill in the values
cp frontend/.env.example frontend/.env

cd backend && npm install && npm run dev            # API: http://localhost:5000
cd ../frontend && npm install && npm run dev        # UI:  http://localhost:5173
```

**Scripts**

| Where | Command | Description |
|---|---|---|
| backend | `npm run dev` | API with nodemon |
| backend | `npm start` | API with node |
| frontend | `npm run dev` | Vite dev server |
| frontend | `npm run build` | Production build → `frontend/dist` |
| frontend | `npm run preview` | Preview the build locally |
| frontend | `npm run i18n:check` | Every translation key exists in `ka`/`en`/`ru` (including plurals) |

**First admin**

1. Register (or sign in with Google).
2. Run `node utils/makeAdmin.js <email>` (from `backend/`).
3. Sign in again. The "Panel" link appears in the header.

<a id="en-maintenance"></a>

### Scripts & migrations

> ⚠️ Every script writes to the database in `MONGO_URI`. Check which database you're connected to and make a backup before running one.

| Command (`backend/`) | Description |
|---|---|
| `npm run seed:catalog` | Add / update the demo catalog by slug (`-- --dry-run` only validates). Ratings are set to 0 — they come from real reviews only. |
| `npm run seed` | **Deletes all categories and products** and inserts a small demo set. Never run it against a real database. |
| `npm run migrate:translations` | Fill missing EN/RU translations in existing content (`-- --dry-run`, `-- --force`). Idempotent. |
| `node utils/makeAdmin.js <email>` | Give an existing user the `admin` role |

**Historical migration — review aggregates**

A one-time migration (introduced with the Reviews feature):

- `Product.rating` / `reviewCount` are calculated from real, published reviews only;
- the demo "რეიტინგი" (Rating) specification row from the seed is removed, together with its en/ru translations.

It has already been run on the DEV database. A new environment needs it only if its catalog was created with the old seed.

```bash
npm run migrate:review-aggregates -- --dry-run          # report only, nothing is written
npm run migrate:review-aggregates                       # backup → write
npm run migrate:review-aggregates -- --restore=FILE     # restore from a backup
```

- **Backup:** created in `backend/backups/` before writing. The folder is not stored in git.
- **Scope:** only the fields listed above change.
- **Idempotent:** running it again makes no further changes.

<a id="en-deploy"></a>

### Deployment

| Environment | Status | Architecture |
|---|---|---|
| **DEV** | Running | Frontend → Render · Backend API → Render · Database → MongoDB Atlas · Email → Gmail API (`EMAIL_PROVIDER=gmail_api`) · site gated by an access code (`DEV_ACCESS_CODE`) |
| **PROD** | Planned | Not deployed yet |

Service configuration lives in the Render dashboard; there is no deployment file in the repository.

Production will need:

- `NODE_ENV=production`;
- a strong `JWT_SECRET`;
- correct `CLIENT_URL` and `VITE_API_URL`;
- an email provider, plus SPF / DKIM / DMARC for the sending domain;
- a real bank integration before card payments are enabled.

<a id="en-security"></a>

### Security

Implemented controls:

- **Authentication:**
  - passwords are hashed with **bcrypt** and never returned by the API;
  - **JWT** authentication; tokens issued before a password change or reset are rejected;
  - deactivated accounts are blocked.
- **Authorization:**
  - roles are checked on the server for every protected route;
  - the analytics, moderation, campaign and order-management APIs are restricted to admin and manager.
- **Google:** ID tokens are verified on the server against `GOOGLE_CLIENT_ID`.
- **One-time codes:**
  - stored hashed, valid for 3 minutes;
  - resend after 30 seconds, at most 5 attempts;
  - password reset tokens are single-use.
- **Rate limiting** (in-memory): code send / verify, password reset, password change.
- **Orders:** prices, discounts and stock are calculated on the server. Variant stock is reserved atomically.
- **Reviews:** purchases are verified only on the server; users can change only their own review.
- **Privacy:**
  - analytics shows customer emails masked and never returns phone numbers or addresses;
  - reviews show only "first name + last initial".
- **Card data:** the shop neither receives nor stores it. The planned flow uses the bank's hosted page.
- **Secrets:** environment variables only; `.env` files are not stored in git.
- **`DEV_ACCESS_CODE`** is a gate for the test environment, not an authentication mechanism.

<a id="en-quality"></a>

### Quality & testing

- `npm run i18n:check` — translation completeness in all three languages (including placeholders and plural forms).
- `npm run build` — Vite production build.
- The repository doesn't contain an automated test suite yet.
  - Features were verified with local API and browser regression scripts against temporary test data;
  - those scripts are not part of the repository.

<a id="en-roadmap"></a>

### Roadmap

**Implemented**

- Authentication (email + OTP, Google), password management, roles.
- Catalog with variants, trilingual content and search.
- Checkout with payment on delivery, orders, status workflow, order tracking.
- Wishlist, Notification Center, Reviews & Ratings.
- Business Analytics V1; storefront best sellers based on real sales.

**Planned / future**

- Analytics V1.1: revenue by completion date; average time to processing / shipment / completion.
- Enabling card payments (BOG / TBC) once the bank integration is complete.
- A PROD environment.
- Optional (requires event tracking):
  - wishlist history and conversion;
  - page views, search analytics, abandoned carts;
  - campaign conversion.

### Git

A personal project. Make changes in a separate branch and commit:

```bash
git checkout -b feature/my-change
git add <files>
git commit -m "Describe the change"
git push -u origin feature/my-change
```

`.env` files and `backend/backups/` must never be committed.
