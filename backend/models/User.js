const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const addressSchema = new mongoose.Schema(
  {
    city: { type: String, default: "" },
    street: { type: String, default: "" },
    postalCode: { type: String, default: "" },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, default: "" },
    lastName: { type: String, trim: true, default: "" },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, select: false },
    phone: { type: String, default: "" },
    address: { type: addressSchema, default: () => ({}) },

    // Google-based auth (no password needed for MVP)
    googleId: { type: String, unique: true, sparse: true },
    avatar: { type: String, default: "" },

    role: {
      type: String,
      enum: ["customer", "admin", "manager"],
      default: "customer",
    },

    isActive: { type: Boolean, default: true },

    // რჩეულები (Wishlist) — მხოლოდ პროდუქტის მითითება და დამატების დრო (services/wishlist.js)
    wishlist: {
      type: [
        {
          _id: false,
          product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
          addedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },

    // პაროლის ბოლო ცვლილება — ამაზე ადრე გაცემული JWT-ები აღარ მოქმედებს (middleware/auth.js)
    passwordChangedAt: { type: Date, select: false },
  },
  {
    timestamps: true,
    // პაროლი/მისი hash და უსაფრთხოების ველები API პასუხებში არასდროს ჩანს
    toJSON: {
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.passwordChangedAt;
        // რჩეულები ცალკე API-თია (wishlist-*) — პროფილის/ადმინის პასუხებს არ ამძიმებს
        delete ret.wishlist;
        return ret;
      },
    },
  },
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  // არსებული პაროლის შეცვლისას (არა ახალი მომხმარებლისას) ძველი სესიები უქმდება.
  // -1 წმ: ახლავე გაცემული ახალი ტოკენი (iat წამებშია დამრგვალებული) ვალიდური რჩება.
  if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000);
  next();
});

// Google-ით შექმნილ ანგარიშს შეიძლება პაროლი არ ჰქონდეს — მაშინ შედარება ყოველთვის false
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password || typeof enteredPassword !== "string") return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

/** ტოკენი გაცემულია პაროლის ბოლო ცვლილებამდე? (iat — წამებში) */
userSchema.methods.tokenIssuedBeforePasswordChange = function (iat) {
  return Boolean(this.passwordChangedAt && iat * 1000 < this.passwordChangedAt.getTime());
};

module.exports = mongoose.model("User", userSchema);
