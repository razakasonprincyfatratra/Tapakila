"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";

type Mode = "login" | "register";

export default function AuthPage() {
  const router = useRouter();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isLogin = mode === "login";

  function switchMode(newMode: Mode) {
    setMode(newMode);
    setError(null);
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isLogin && password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setSubmitting(true);

    try {
      if (isLogin) {
        await login({ email, password });
      } else {
        await register({ email, password, firstName, lastName });
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  }

  function handleGoogleClick() {
    if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      setError("Connexion Google pas encore configurée (NEXT_PUBLIC_GOOGLE_CLIENT_ID manquant).");
      return;
    }
    // L'intégration complète du SDK Google Identity Services sera branchée ici
    // une fois le Client ID disponible.
  }

  function handleFacebookClick() {
    if (!process.env.NEXT_PUBLIC_FACEBOOK_APP_ID) {
      setError("Connexion Facebook pas encore configurée (NEXT_PUBLIC_FACEBOOK_APP_ID manquant).");
      return;
    }
    // L'intégration complète du SDK Facebook sera branchée ici
    // une fois l'App ID disponible.
  }

  return (
    <div className="min-h-screen bg-[#0B0B14] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block text-3xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent">
              TAPAKILA
            </span>
          </Link>
          <p className="text-gray-400 text-sm mt-2">Billetterie d'événements à Madagascar</p>
        </div>

        <div className="bg-[#13131F] border border-white/10 rounded-2xl p-8 shadow-xl">
          <div className="flex mb-6 bg-white/5 rounded-lg p-1">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                isLogin ? "bg-white/10 text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Se connecter
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                !isLogin ? "bg-white/10 text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              S'inscrire
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Prénom</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Jean"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Nom</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Rakoto"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-400 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="jean.rakoto@email.com"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 pr-10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 text-xs"
                  tabIndex={-1}
                >
                  {showPassword ? "Masquer" : "Afficher"}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Confirmer le mot de passe</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 pr-10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 text-xs"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? "Masquer" : "Afficher"}
                  </button>
                </div>
                {confirmPassword.length > 0 && confirmPassword !== password && (
                  <p className="text-xs text-red-400 mt-1">Les mots de passe ne correspondent pas.</p>
                )}
              </div>
            )}

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white font-medium py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-50"
            >
              {submitting ? "Chargement..." : isLogin ? "Se connecter" : "Créer mon compte"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-gray-500">ou</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleClick}
              className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-lg py-2.5 text-sm text-white hover:bg-white/10 transition"
            >
              Continuer avec Google
            </button>
            <button
              type="button"
              onClick={handleFacebookClick}
              className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-lg py-2.5 text-sm text-white hover:bg-white/10 transition"
            >
              Continuer avec Facebook
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          En continuant, tu acceptes les conditions d'utilisation de Tapakila.
        </p>
      </div>
    </div>
  );
}