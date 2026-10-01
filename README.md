# E-commerce MVP (MERN)

მარტივი ონლაინ მაღაზიის ჩონჩხი: **React (Vite)** ფრონტზე, **Node.js + Express** ბექზე, **MongoDB** ბაზად.

## რა არის დანერგილი

- პროდუქციის საჯარო კატალოგი (სია, კატეგორიის მიხედვით ფილტრი, ძებნა, დეტალური გვერდი)
- სანავიგაციო ბარი დინამიური კატეგორიებით
- Google-ით ავტორიზაცია (Google Identity Services / One Tap ღილაკი), JWT სესია
- კალათა (localStorage-ში ინახება, სესიებს შორის არ იკარგება)
- Checkout ფორმა: სახელი, გვარი, ტელეფონი, მისამართი — ინახება მომხმარებლის პროფილშიც
- სამართავი პანელი (`/admin`):
  - პროდუქტების დამატება/რედაქტირება/წაშლა
  - კატეგორიების დამატება/რედაქტირება/წაშლა
  - შეკვეთების ნახვა და სტატუსის განახლება
  - მომხმარებლების როლების მართვა (customer / manager / admin) და აქტივაცია/დეაქტივაცია
- როლებზე დაფუძნებული წვდომა (`protect` + `authorize` middleware ბექზე, `PrivateRoute` / `AdminRoute` ფრონტზე)

## საჭირო წინაპირობები

- Node.js 18+
- MongoDB (ლოკალურად დაყენებული, ან უფასო [MongoDB Atlas](https://www.mongodb.com/atlas) კლასტერი)
- Google Cloud-ში შექმნილი OAuth Client ID (Google-ით ავტორიზაციისთვის)

## 1. Google OAuth Client ID-ის მიღება

1. გადადით: https://console.cloud.google.com/apis/credentials
2. შექმენით ახალი პროექტი (ან აირჩიეთ არსებული)
3. **Create Credentials → OAuth client ID → Web application**
4. **Authorized JavaScript origins**-ში დაამატეთ:
   - `http://localhost:5173`
5. დააკოპირეთ მიღებული **Client ID** — დაგჭირდებათ ორივე `.env` ფაილში.
//743317386093-jrp35d03okl5h6kmdq9up7sg2ci59um1.apps.googleusercontent.com

## 2. Backend-ის გაშვება

```bash
cd backend
cp .env.example .env
```

გახსენით `.env` და შეავსეთ:
- `MONGO_URI` — თქვენი MongoDB-ს მისამართი
- `JWT_SECRET` — ნებისმიერი გრძელი შემთხვევითი სტრიქონი
- `GOOGLE_CLIENT_ID` — 1-ლი ნაბიჯიდან მიღებული Client ID

შემდეგ:

```bash
npm install
npm run seed     # (არასავალდებულო) დაამატებს სატესტო კატეგორია/პროდუქტებს
npm run dev      # სერვერი გაეშვება: http://localhost:5000
```

## 3. Frontend-ის გაშვება

ახალ ტერმინალში:

```bash
cd frontend
cp .env.example .env
```

გახსენით `.env` და შეავსეთ:
- `VITE_GOOGLE_CLIENT_ID` — იგივე Client ID, რაც ბექზე

შემდეგ:

```bash
npm install
npm run dev      # საიტი გაეშვება: http://localhost:5173
```

## 4. თქვენი პირველი admin მომხმარებელი

1. გახსენით `http://localhost:5173`, დააჭირეთ **"შესვლა"** და გაიარეთ Google ავტორიზაცია — ეს შექმნის თქვენს user-ს ბაზაში (როლით `customer`).
2. ბექენდის საქაღალდიდან გაუშვით:

```bash
cd backend
node utils/makeAdmin.js your-email@gmail.com
```

3. საიტზე თავიდან შედით (log out/log in) — ახლა Navbar-ში გამოჩნდება **"პანელი"** ბმული, სადაც შეძლებთ პროდუქტების/კატეგორიების/შეკვეთების/მომხმარებლების მართვას.

## პროექტის სტრუქტურა

```
ecommerce-mvp/
├── backend/
│   ├── config/db.js
│   ├── controllers/        # ბიზნეს-ლოგიკა
│   ├── middleware/         # auth, roles, error handling
│   ├── models/             # Mongoose სქემები
│   ├── routes/             # API endpoint-ები
│   ├── utils/               # seed.js, makeAdmin.js
│   └── server.js
└── frontend/
    └── src/
        ├── api/axios.js     # API კლიენტი + JWT interceptor
        ├── context/         # Auth და Cart context-ები
        ├── components/      # Navbar, ProductCard, route guards
        └── pages/
            └── admin/       # სამართავი პანელის გვერდები
```

## ძირითადი API endpoint-ები

სახელები ფორმატით `/api/<რესურსი>-<მოქმედება>` (განსაზღვრულია `backend/routes/apiRoutes.js`-ში).
ძველი მისამართები (`/api/orders`, `/api/products/:id` ...) დროებით კვლავ მუშაობს, პასუხს აქვს `Deprecation: true` header.

| მეთოდი | Route | აღწერა | წვდომა |
|---|---|---|---|
| POST | `/api/auth-google-login` | Google-ით შესვლა | Public |
| POST | `/api/auth-verification-code-send` | ვერიფიკაციის კოდის გაგზავნა ელ. ფოსტაზე | Public |
| POST | `/api/auth-verification-code-verify` | კოდის შემოწმება | Public |
| POST | `/api/auth-register` | რეგისტრაცია | Public |
| POST | `/api/auth-login` | შესვლა | Public |
| GET  | `/api/auth-profile` | მიმდინარე მომხმარებელი | Private |
| PUT  | `/api/auth-profile-update` | პროფილის განახლება | Private |
| GET  | `/api/product-list` | პროდუქტების სია (ფილტრები, დალაგება, გვერდები) | Public |
| GET  | `/api/product-best-sellers` | ყველაზე გაყიდვადი | Public |
| GET  | `/api/product-recommended` | რეკომენდებული | Public |
| GET  | `/api/product-details/:id` | პროდუქტი (id ან slug) | Public |
| POST | `/api/product-create` | პროდუქტის შექმნა | Admin/Manager |
| PUT  | `/api/product-update/:id` | პროდუქტის რედაქტირება | Admin/Manager |
| DELETE | `/api/product-delete/:id` | პროდუქტის წაშლა | Admin |
| GET  | `/api/category-list` | კატეგორიების სია | Public |
| GET  | `/api/category-details/:id` | კატეგორია | Public |
| POST | `/api/category-create` | კატეგორიის შექმნა | Admin/Manager |
| PUT  | `/api/category-update/:id` | კატეგორიის რედაქტირება | Admin/Manager |
| PUT  | `/api/category-reorder` | კატეგორიების თანმიმდევრობა | Admin/Manager |
| DELETE | `/api/category-delete/:id` | კატეგორიის წაშლა | Admin/Manager |
| GET  | `/api/order-checkout-options` | ქალაქები, მიწოდება, გადახდის მეთოდები | Public |
| POST | `/api/order-create` | შეკვეთის შექმნა — კურიერთან გადახდისას დადასტურდება და მომხმარებელს ეგზავნება დადასტურების წერილი | Private |
| GET  | `/api/order-my-list` | ჩემი შეკვეთები | Private |
| POST | `/api/order-cancel/:id` | გადაუხდელი შეკვეთის გაუქმება | Private |
| GET  | `/api/order-list` | ყველა შეკვეთა (ფილტრები, გვერდები, სტატისტიკა) | Admin/Manager |
| PUT  | `/api/order-status-update/:id` | შეკვეთის სტატუსი | Admin/Manager |
| POST | `/api/payment-init/:orderId` | ბარათით გადახდის სესია | Private |
| GET  | `/api/payment-status/:orderId` | გადახდის სტატუსი | Private |
| GET  | `/api/user-list` | მომხმარებლების სია | Admin |
| POST | `/api/user-create` | შიდა მომხმარებლის შექმნა | Admin |
| PUT  | `/api/user-update/:id` | რედაქტირება | Admin |
| DELETE | `/api/user-delete/:id` | წაშლა | Admin |
| PUT  | `/api/user-role-update/:id` | როლის ცვლილება | Admin |
| PUT  | `/api/user-status-update/:id` | აქტივაცია/დეაქტივაცია | Admin |

ბანკის შეტყობინებები (`/api/payments/callback/:bank`) და სატესტო გადახდის გვერდი (`/api/payments/sandbox/...`) უცვლელია — ეს მისამართები ბანკებთანაა რეგისტრირებული.

## შემდეგი ბიჯები (production-ისთვის)

ეს არის **MVP ჩონჩხი** სასწავლო/საწყისი მიზნებისთვის. Production-ზე გასაშვებად დამატებით გირჩევთ:
- სურათების ატვირთვა (ამჟამად მხოლოდ URL-ია მხარდაჭერილი) — მაგ. Cloudinary/S3
- გადახდის სისტემის ინტეგრაცია (Stripe, TBC/BOG და სხვ.)
- Rate limiting და დამატებითი ვალიდაცია (`express-validator`)
- HTTPS, environment secrets-ის უსაფრთხო შენახვა
- ტესტები (Jest/Vitest)
- დეპლოი: ბექი — Render/Railway/VPS, ფრონტი — Vercel/Netlify, ბაზა — MongoDB Atlas
