require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const userRoutes = require('./routes/userRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const apiRoutes = require('./routes/apiRoutes');

connectDB();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
    exposedHeaders: ['Retry-After'], // ფრონტენდი კითხულობს ხელახლა მოთხოვნამდე დარჩენილ დროს
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// მთავარი API — /api/<რესურსი>-<მოქმედება> (მაგ. POST /api/order-create)
app.use('/api', apiRoutes);

// ძველი მისამართები — მოძველებული, დროებით რჩება თავსებადობისთვის.
// /api/payments/callback და /api/payments/sandbox აქტიურად გამოიყენება (ბანკის შეტყობინებები).
const deprecated = (req, res, next) => {
  res.set('Deprecation', 'true');
  next();
};
app.use('/api/auth', deprecated, authRoutes);
app.use('/api/categories', deprecated, categoryRoutes);
app.use('/api/products', deprecated, productRoutes);
app.use('/api/orders', deprecated, orderRoutes);
app.use('/api/users', deprecated, userRoutes);
app.use('/api/payments', paymentRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`სერვერი გაშვებულია პორტზე: ${PORT}`));
