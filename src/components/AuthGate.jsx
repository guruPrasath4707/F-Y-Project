import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import { AuthContext } from "../auth/authContext";

const AuthGate = ({ children }) => {
  const [retryCount, setRetryCount] = useState(0);
  const [status, setStatus] = useState({
    loading: true,
    authenticationRequired: false,
    authenticated: false,
    error: "",
  });
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    let cancelled = false;

    setStatus((previous) => ({ ...previous, loading: true, error: "" }));
    fetch("/api/session", {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Could not check sign-in status.");
        if (!cancelled) {
          setStatus({
            loading: false,
            authenticationRequired: Boolean(payload.authenticationRequired),
            authenticated: Boolean(payload.authenticated),
            error: "",
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({
            loading: false,
            authenticationRequired: false,
            authenticated: false,
            error: "The application server is unavailable. Check that the API server is running, then retry.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  const handleLogin = async (event) => {
    event.preventDefault();
    if (submitting || !password) return;

    setSubmitting(true);
    setLoginError("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setLoginError(payload.error || "Sign-in failed. Please try again.");
        return;
      }

      setPassword("");
      setStatus({
        loading: false,
        authenticationRequired: Boolean(payload.authenticationRequired),
        authenticated: Boolean(payload.authenticated),
        error: "",
      });
    } catch {
      setLoginError("Could not reach the application server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    setLogoutError("");
    try {
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Sign-out request failed.");
      setStatus((previous) => ({
        ...previous,
        authenticationRequired: true,
        authenticated: false,
      }));
      setPassword("");
      setLoginError("");
    } catch {
      setLogoutError("Could not sign out. Check the connection and try again.");
    }
  };

  if (status.loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-900 p-6 text-gray-200">
        <p role="status">Checking application access…</p>
      </main>
    );
  }

  if (status.error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 p-6 text-center text-white">
        <h1 className="text-2xl font-semibold">AI Companion is unavailable</h1>
        <p className="mt-3 max-w-md text-gray-300" role="alert">{status.error}</p>
        <button
          type="button"
          onClick={() => setRetryCount((count) => count + 1)}
          className="mt-5 rounded-xl bg-blue-600 px-5 py-3 font-medium hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
        >
          Retry connection
        </button>
      </main>
    );
  }

  if (status.authenticationRequired && !status.authenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-900 p-5 text-white">
        <section className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-800 p-6 shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-300">Private workspace</p>
          <h1 className="mt-3 text-3xl font-bold">AI Companion</h1>
          <p className="mt-3 text-gray-300">
            Enter the application access password to continue.
          </p>
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label htmlFor="app-password" className="mb-2 block text-sm font-medium">Access password</label>
              <input
                id="app-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                maxLength={1024}
                className="w-full rounded-xl border border-gray-600 bg-gray-900 p-3 text-white outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              />
            </div>
            {loginError && <p role="alert" className="text-sm text-red-300">{loginError}</p>}
            <button
              type="submit"
              disabled={submitting || !password}
              className="w-full rounded-xl bg-blue-600 p-3 font-medium hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <AuthContext.Provider value={{
      authenticationRequired: status.authenticationRequired,
      authenticated: status.authenticated,
      logout,
      logoutError,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

AuthGate.propTypes = {
  children: PropTypes.node.isRequired,
};

export default AuthGate;
