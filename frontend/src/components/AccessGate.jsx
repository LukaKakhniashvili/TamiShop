import { useState } from "react";
import api from "../api/axios";
import "./AccessGate.css";

const AccessGate = ({ children }) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const hasAccess = sessionStorage.getItem("devAccessGranted") === "true";

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!code.trim()) {
      setError("გთხოვთ, შეიყვანოთ წვდომის კოდი");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await api.post("/dev-access/verify", {
        code: code.trim(),
      });

      sessionStorage.setItem("devAccessGranted", "true");

      window.location.reload();
    } catch (err) {
      setError("წვდომის კოდი არასწორია");
    } finally {
      setLoading(false);
    }
  };

  if (hasAccess) {
    return children;
  }

  return (
    <div className="dev-access-page">
      <form className="dev-access-card" onSubmit={handleSubmit}>
        {/* Logo */}
        <div className="dev-access-brand">
          <div className="dev-access-logo">
            Tam`i <span>Shop</span>
          </div>
        </div>

        {/* Lock Icon */}
        <div className="dev-access-lock">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <rect x="5" y="10" width="14" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            <path d="M12 14v3" />
          </svg>
        </div>

        <h1>Development Environment</h1>

        <p className="dev-access-description">
          ეს არის სატესტო გარემო (DEV).
          <br />
          გასაგრძელებლად შეიყვანეთ Access Code.
        </p>

        {/* Access Code */}
        <div className="dev-access-input-wrapper">
          <span className="dev-access-input-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="5" y="10" width="14" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
          </span>

          <input
            type="password"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);

              if (error) {
                setError("");
              }
            }}
            placeholder="Access Code"
            autoFocus
            autoComplete="off"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="dev-access-error">
            <span className="dev-access-error-icon">!</span>

            {error}
          </div>
        )}

        {/* Button */}
        <button className="dev-access-button" type="submit" disabled={loading}>
          {loading ? "მოწმდება..." : "შესვლა →"}
        </button>

        {/* Footer */}
        <div className="dev-access-footer">
          <div className="dev-access-footer-content">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="6" y="10" width="12" height="10" rx="2" />
              <path d="M9 10V7a3 3 0 0 1 6 0v3" />
            </svg>

            <span>Restricted Development Access</span>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AccessGate;
