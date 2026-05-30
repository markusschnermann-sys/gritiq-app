import { useState, useRef, useEffect } from "react";
import { login, register } from "@/lib/authStore";
import { apiRequest } from "@/lib/queryClient";
import { GritIQLogo } from "@/App";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ArrowLeft, Mail, Lock, User, AlertCircle, Loader2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Mode = "login" | "register" | "forgot" | "reset";

// ── Small reusable field ──────────────────────────────────────────────────────
function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  minLength,
  inputRef,
  icon,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  inputRef?: React.RefObject<HTMLInputElement>;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {icon}
          </div>
        )}
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          className={`w-full bg-input border border-border rounded-lg py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors ${icon ? "pl-10 pr-3" : "px-3"}`}
        />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Auto-focus first field on mode change
  useEffect(() => {
    setError(null);
    setSuccessMsg(null);
    setTimeout(() => firstRef.current?.focus(), 50);
  }, [mode]);

  // ── Submit handlers ────────────────────────────────────────────────────────

  async function handleLoginRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
        // App.tsx will detect the auth state change and unmount this page
      } else {
        if (name.trim().length < 1) { setError("Bitte gib deinen Namen ein."); return; }
        if (password.length < 8) { setError("Passwort muss mindestens 8 Zeichen haben."); return; }
        if (password !== confirmPassword) { setError("Passwörter stimmen nicht überein."); return; }
        await register(email.trim(), password, name.trim());
      }
    } catch (err: any) {
      setError(err.message ?? "Ein Fehler ist aufgetreten.");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/auth/forgot-password", { email: email.trim() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Fehler beim Anfordern des Reset-Links.");

      // Sandbox/dev: if a token is returned in the response, auto-navigate to reset
      if (data._dev_token) {
        setResetToken(data._dev_token);
        setMode("reset");
        toast({
          title: "Reset-Link generiert",
          description: "In einer echten App käme jetzt eine E-Mail. Du wirst direkt weitergeleitet.",
        });
      } else {
        setSuccessMsg(
          `Wenn ${email} registriert ist, erhältst du in Kürze eine E-Mail mit dem Reset-Link.`
        );
        setEmail("");
      }
    } catch (err: any) {
      setError(err.message ?? "Ein Fehler ist aufgetreten.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Passwort muss mindestens 8 Zeichen haben."); return; }
    if (password !== confirmPassword) { setError("Passwörter stimmen nicht überein."); return; }
    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/auth/reset-password", {
        token: resetToken.trim(),
        password,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Fehler beim Zurücksetzen des Passworts.");

      toast({ title: "Passwort geändert", description: "Du kannst dich jetzt anmelden." });
      setPassword("");
      setConfirmPassword("");
      setResetToken("");
      setMode("login");
    } catch (err: any) {
      setError(err.message ?? "Ein Fehler ist aufgetreten.");
    } finally {
      setBusy(false);
    }
  }

  // ── Derived helpers ────────────────────────────────────────────────────────
  const isLoginRegister = mode === "login" || mode === "register";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <GritIQLogo size={56} />
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
              GritIQ
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">Adaptive Strength Waves</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">

          {/* ── Login / Register ──────────────────────────────────────── */}
          {isLoginRegister && (
            <>
              {/* Tab switcher */}
              <div className="flex bg-muted rounded-lg p-1 mb-6 gap-1">
                {(["login", "register"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setPassword(""); setConfirmPassword(""); }}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                      mode === m
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m === "login" ? "Anmelden" : "Registrieren"}
                  </button>
                ))}
              </div>

              <form onSubmit={handleLoginRegister} className="space-y-4">
                {mode === "register" && (
                  <Field
                    label="Name"
                    type="text"
                    value={name}
                    onChange={setName}
                    placeholder="Dein Name"
                    autoComplete="name"
                    required
                    inputRef={firstRef}
                    icon={<User size={15} />}
                  />
                )}

                <Field
                  label="E-Mail"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="du@beispiel.de"
                  autoComplete={mode === "login" ? "username" : "email"}
                  required
                  inputRef={mode === "login" ? firstRef : undefined}
                  icon={<Mail size={15} />}
                />

                <Field
                  label="Passwort"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder={mode === "register" ? "Mindestens 8 Zeichen" : "Dein Passwort"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  minLength={mode === "register" ? 8 : 1}
                  icon={<Lock size={15} />}
                />

                {mode === "register" && (
                  <Field
                    label="Passwort bestätigen"
                    type="password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    placeholder="Nochmals eingeben"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    icon={<Lock size={15} />}
                  />
                )}

                {/* Forgot password link */}
                {mode === "login" && (
                  <div className="text-right -mt-1">
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs text-primary hover:underline"
                    >
                      Passwort vergessen?
                    </button>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2.5 text-sm text-destructive">
                    <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  data-testid="button-auth-submit"
                  className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground font-semibold rounded-lg py-2.5 text-sm transition-all flex items-center justify-center gap-2 mt-2"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                  {mode === "login" ? "Anmelden" : "Konto erstellen"}
                </button>
              </form>

              <p className="text-center text-xs text-muted-foreground mt-4">
                {mode === "login" ? (
                  <>Noch kein Konto?{" "}
                    <button
                      onClick={() => { setMode("register"); setPassword(""); }}
                      className="text-primary hover:underline font-medium"
                    >
                      Jetzt registrieren
                    </button>
                  </>
                ) : (
                  <>Bereits registriert?{" "}
                    <button
                      onClick={() => { setMode("login"); setPassword(""); setConfirmPassword(""); }}
                      className="text-primary hover:underline font-medium"
                    >
                      Anmelden
                    </button>
                  </>
                )}
              </p>
            </>
          )}

          {/* ── Forgot Password ───────────────────────────────────────── */}
          {mode === "forgot" && (
            <>
              <button
                onClick={() => setMode("login")}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 -mt-1 transition-colors"
              >
                <ArrowLeft size={15} /> Zurück zur Anmeldung
              </button>

              <h2 className="font-display text-lg font-bold mb-1">Passwort zurücksetzen</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Gib deine E-Mail-Adresse ein. Du erhältst einen Link zum Zurücksetzen.
              </p>

              {successMsg ? (
                <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3.5 text-sm text-green-400">
                  <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                  <p>{successMsg}</p>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  <Field
                    label="E-Mail-Adresse"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="du@beispiel.de"
                    autoComplete="email"
                    required
                    inputRef={firstRef}
                    icon={<Mail size={15} />}
                  />

                  {error && (
                    <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2.5 text-sm text-destructive">
                      <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground font-semibold rounded-lg py-2.5 text-sm transition-all flex items-center justify-center gap-2"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                    Reset-Link anfordern
                  </button>
                </form>
              )}
            </>
          )}

          {/* ── Reset Password (token present) ────────────────────────── */}
          {mode === "reset" && (
            <>
              <button
                onClick={() => setMode("login")}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 -mt-1 transition-colors"
              >
                <ArrowLeft size={15} /> Zurück zur Anmeldung
              </button>

              <h2 className="font-display text-lg font-bold mb-1">Neues Passwort setzen</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Wähle ein neues, starkes Passwort für dein GritIQ-Konto.
              </p>

              <form onSubmit={handleReset} className="space-y-4">
                {/* Manual token entry (fallback if no _dev_token was returned) */}
                {!resetToken && (
                  <Field
                    label="Reset-Token"
                    type="text"
                    value={resetToken}
                    onChange={setResetToken}
                    placeholder="Token aus der E-Mail einfügen"
                    autoComplete="off"
                    required
                    inputRef={firstRef}
                    icon={<Lock size={15} />}
                  />
                )}

                <Field
                  label="Neues Passwort"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Mindestens 8 Zeichen"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  inputRef={resetToken ? firstRef : undefined}
                  icon={<Lock size={15} />}
                />

                <Field
                  label="Passwort bestätigen"
                  type="password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Nochmals eingeben"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  icon={<Lock size={15} />}
                />

                {error && (
                  <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2.5 text-sm text-destructive">
                    <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  data-testid="button-reset-submit"
                  className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground font-semibold rounded-lg py-2.5 text-sm transition-all flex items-center justify-center gap-2"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                  Passwort speichern
                </button>
              </form>
            </>
          )}
        </div>

        {/* Security note */}
        <p className="text-center text-xs text-muted-foreground/60 mt-4">
          Passwort wird mit bcrypt gehasht. Alle Sitzungen sind JWT-gesichert.
        </p>
      </div>
    </div>
  );
}
