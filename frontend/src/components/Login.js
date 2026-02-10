// frontend/src/components/Login.js
import { useCallback, useEffect, useRef, useState } from "react";
import { loginWithGoogle } from "../api";

export default function Login({ onSuccess }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const googleButtonRef = useRef(null);

  const handleGoogleCredential = useCallback(
    async (credential) => {
      setError("");
      setLoading(true);
      try {
        const token = await loginWithGoogle(credential);
        localStorage.setItem("token", token);
        if (onSuccess) onSuccess();
        window.location.href = "/";
      } catch (err) {
        setError(err.response?.data?.error || "Google login failed");
      } finally {
        setLoading(false);
      }
    },
    [onSuccess],
  );

  useEffect(() => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    if (!clientId) {
      return;
    }

    const initGoogle = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => handleGoogleCredential(response.credential),
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        width: "100%",
      });
    };

    if (window.google?.accounts?.id) {
      initGoogle();
      return;
    }

    const script = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    if (script) {
      script.addEventListener("load", initGoogle);
      return () => script.removeEventListener("load", initGoogle);
    }
  }, [handleGoogleCredential]);

  return (
    <div className="auth-form">
      {error && <div className="error-message">{error}</div>}
      <div ref={googleButtonRef} style={{ marginTop: "12px" }} />
      {loading && <div className="auth-loading">Signing in...</div>}
    </div>
  );
}
