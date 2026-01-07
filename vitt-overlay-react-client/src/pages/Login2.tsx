import type React from "react"
import { useState } from "react"
import { Lock, Mail, ArrowRight, User } from "lucide-react"
import axios from "axios"
import { useAuth } from "../context/AuthContext"

const GOOGLE_CLIENT_ID = "382932316402-4sopjcnfn116nb2nqqa1e32gnjjsuddh.apps.googleusercontent.com"
const REDIRECT_URI = "http://localhost:8000/google/callback"
const SCOPE = "openid email profile"
const SIGNUP_URL = "http://localhost:3000/signup" // Add your signup URL here

export default function MiniLoginPage() {
  const {setCurrentUser}=useAuth();
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [showSignUp, setShowSignUp] = useState(false)
  const [signupEmail, setSignupEmail] = useState("")
  const [signupPassword, setSignupPassword] = useState("")
  const [signupName, setSignupName] = useState("")
  const [forgotEmail, setForgotEmail] = useState("")

  const submitLoginBtn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    try {
      setIsLoading(true)
      const res = await axios.post(
        "http://localhost:5000/login-web-portal",
        { email, password },
        {
          headers: { "Content-Type": "application/json" },
          withCredentials: true,
        },
      )
      console.log("Login success", res.data)
      setIsLoading(false)
      setCurrentUser(res.data.user);
      //app ke url ke /home pe bhej do 
      setTimeout(() => {
  window.location.assign("/home");
}, 0);
    } catch (err: any) {
      console.error("Login failed", err.response?.data || err.message)
      setIsLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
   window.open('https://web-portal-sales.netlify.app/sign-up','_blank')
  }

  const handleGoogleLogin = () => {
    const authUrl =
      "https://accounts.google.com/o/oauth2/v2/auth" +
      `?client_id=${GOOGLE_CLIENT_ID}` +
      `&redirect_uri=${REDIRECT_URI}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(SCOPE)}` +
      `&prompt=consent` +
      `&state=login`
    window.open(authUrl, "_blank")
  }

  const handleMicrosoftLogin = () => {
    window.open("http://localhost:5000/auth/microsoft/login", "_blank")
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsLoading(true)
      console.log("Password reset email sent to:", forgotEmail)
      setIsLoading(false)
      setShowForgotPassword(false)
    } catch (err) {
      console.error("Error sending reset email", err)
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      {/* Container with fixed dimensions */}
      <div className="w-full max-w-[500px] bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
        {/* Login Form */}
        {!showForgotPassword && !showSignUp && (
          <div className="p-6 space-y-5">
            {/* Header */}
            <div className="space-y-2 text-center">
              <div className="flex justify-center mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg">v</span>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-white">Welcome back</h1>
              <p className="text-sm text-slate-400">Sign in to your account</p>
            </div>

            {/* OAuth Buttons */}
           {/* Email & Password Form - TOP */}
<form onSubmit={submitLoginBtn} className="space-y-3">
  <div className="space-y-1">
    <label className="text-xs font-medium text-slate-300">Email</label>
    <div className="relative">
      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
      <input
        type="email"
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full h-9 pl-9 pr-3 text-sm bg-slate-700/50 border border-slate-600 rounded-lg text-white"
        required
      />
    </div>
  </div>

  <div className="space-y-1">
    <label className="text-xs font-medium text-slate-300">Password</label>
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
      <input
        type="password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full h-9 pl-9 pr-3 text-sm bg-slate-700/50 border border-slate-600 rounded-lg text-white"
        required
      />
    </div>
  </div>

  <button
    type="submit"
    disabled={isLoading}
    className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
  >
    {isLoading ? "Signing in..." : "Sign in"}
  </button>
</form>

{/* Divider */}
<div className="relative my-4">
  <div className="h-px bg-slate-600/50" />
  <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-slate-800/50 px-2 text-xs text-slate-400">
    or continue with
  </span>
</div>

{/* Social Login - BOTTOM (Side by Side) */}
 {/* Social Login - ICONS ONLY */}
<div className="grid grid-cols-2 gap-3">
  <button
    onClick={handleGoogleLogin}
    disabled={isLoading}
    className="h-10 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-lg flex items-center justify-center transition-colors"
    title="Continue with Google"
  >
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  </button>

  <button
    onClick={handleMicrosoftLogin}
    disabled={isLoading}
    className="h-10 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-lg flex items-center justify-center transition-colors"
    title="Continue with Microsoft"
  >
    <svg className="w-5 h-5" viewBox="0 0 23 23">
      <path fill="#f35325" d="M1 1h10v10H1z" />
      <path fill="#81bc06" d="M12 1h10v10H12z" />
      <path fill="#05a6f0" d="M1 12h10v10H1z" />
      <path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
  </button>
</div>



            {/* Footer Links */}
            <div className="space-y-2 text-center">
              <button
                onClick={() => setShowForgotPassword(true)}
                className="w-full text-xs text-slate-400 hover:text-white transition-colors"
              >
                Forgot your password?
              </button>
              <div className="text-xs text-slate-500">
                Don't have an account?{" "}
                <button
                  onClick={handleSignUp}
                  // target="_blank"
                  // rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
                >
                  Sign up
                </button>
              </div>
            </div>
          </div>
        )}

        {showSignUp && !showForgotPassword && (
          <div className="p-6 space-y-4">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold text-white">Create account</h2>
              <p className="text-sm text-slate-400">Join us today</p>
            </div>

            {/* OAuth Buttons */}
            <div className="space-y-2">
              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full h-9 bg-slate-700/50 hover:bg-slate-700 text-white text-xs border border-slate-600 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Google</span>
              </button>

              <button
                onClick={handleMicrosoftLogin}
                disabled={isLoading}
                className="w-full h-9 bg-slate-700/50 hover:bg-slate-700 text-white text-xs border border-slate-600 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <svg className="w-3 h-3" viewBox="0 0 23 23">
                  <path fill="#f35325" d="M1 1h10v10H1z" />
                  <path fill="#81bc06" d="M12 1h10v10H12z" />
                  <path fill="#05a6f0" d="M1 12h10v10H1z" />
                  <path fill="#ffba08" d="M12 12h10v10H12z" />
                </svg>
                <span>Microsoft</span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="h-px bg-slate-600/50" />
              <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-slate-800/50 px-2 text-xs text-slate-400">
                or email
              </span>
            </div>

            {/* Sign Up Form */}
            <form onSubmit={handleSignUp} className="space-y-2.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Full name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 text-sm bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    placeholder="you@company.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 text-sm bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 text-sm bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isLoading ? "Creating account..." : "Sign up"}
              </button>
            </form>

            <button
              onClick={() => setShowSignUp(false)}
              className="w-full text-center text-xs text-slate-400 hover:text-white transition-colors"
            >
              Already have an account? Sign in
            </button>
          </div>
        )}

        {/* Forgot Password Form */}
        {showForgotPassword && !showSignUp && (
          <div className="p-6 space-y-4">
            <div className="space-y-2 text-center">
              <h2 className="text-xl font-bold text-white">Reset password</h2>
              <p className="text-sm text-slate-400">Enter your email to receive reset instructions</p>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    placeholder="you@company.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 text-sm bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isLoading ? "Sending..." : "Send reset link"}
              </button>
            </form>

            <button
              onClick={() => {
                setShowForgotPassword(false)
                setForgotEmail("")
              }}
              className="w-full text-center text-xs text-slate-400 hover:text-white transition-colors"
            >
              Back to login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
