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
  },
  { timestamps: true },
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
