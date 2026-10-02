import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import { UIProvider } from "./context/UIContext.jsx";
import { NotificationProvider } from "./context/NotificationContext.jsx";
import { WishlistProvider } from "./context/WishlistContext.jsx";
import "./index.css";
import "./i18n"; // მრავალენოვნება — ინიციალიზაცია რენდერამდე
import AccessGate from "./components/AccessGate.jsx";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <UIProvider>
          <AuthProvider>
            <NotificationProvider>
              <WishlistProvider>
                <CartProvider>
                  <AccessGate>
                    <App />
                  </AccessGate>
                </CartProvider>
              </WishlistProvider>
            </NotificationProvider>
          </AuthProvider>
        </UIProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>,
);
