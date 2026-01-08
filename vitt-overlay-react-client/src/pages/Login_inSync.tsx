import React from "react"

import { useState } from "react"
import { Lock, Mail, ArrowRight, Shield } from "lucide-react"
import axios from "axios"
import { useData } from "../context/DataWrapper"
import { useNavigate } from "react-router-dom"

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" }
>(({ className = "", variant = "default", ...props }, ref) => {
  const baseStyles =
    "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50"
  const variantStyles = variant === "outline" ? "" : ""
  return <button ref={ref} className={`${baseStyles} ${variantStyles} ${className}`} {...props} />
})
Button.displayName = "Button"

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`flex w-full rounded-lg border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      />
    )
  },
)
Input.displayName = "Input"

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className = "", ...props }, ref) => {
    return <label ref={ref} className={`text-sm font-medium leading-none ${className}`} {...props} />
  },
)
Label.displayName = "Label"

const Separator = ({ className = "" }: { className?: string }) => {
  return <div className={`h-[1px] w-full ${className}`} />
}

const GOOGLE_CLIENT_ID = "382932316402-4sopjcnfn116nb2nqqa1e32gnjjsuddh.apps.googleusercontent.com"

const REDIRECT_URI = "http://localhost:8000/google/callback"

const SCOPE = "openid email profile"

export default function LoginPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const {setUserData,setaccess_token}=useData();


  const signupbtn=()=>{
    window.location.href='/sign-up'
  }
 const submitLoginBtn = async () => {
  try {
    const res = await axios.post(
      "http://localhost:5000/login-web-portal",
      {
        email,
        password,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        withCredentials: true, // 🔥 THIS IS THE KEY
      }
    )

    console.log("Login success", res.data)

    setUserData(res.data.user)
    setaccess_token(res.data.access_token)
    navigate("/home"); // ya "/"
    // access token redux / zustand me daal
    // authStore.setAccessToken(res.data.access_token)

  } catch (err: any) {
    console.error("Login failed 💀", err.response?.data || err.message)
  }
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
    window.location.href = authUrl
  }

  const handleMicrosoftLogin = () => {
    setIsLoading(true)
    window.location.href = "http://localhost:5000/auth/microsoft/login";
    console.log("[v0] Microsoft OAuth not yet configured")
    setIsLoading(false)
  }

  //ye done hai alredy --->cool
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      {/* Left side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Logo & Header */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">v</span>
              </div>
              <span className="text-white text-xl font-semibold">Vitt.ai</span>
            </div>

            <h1 className="text-4xl font-bold text-white leading-tight">Welcome back</h1>
            <p className="text-zinc-400 text-lg">Sign in to your Vitt-Web-Portal workspace</p>
          </div>

          {/* SSO Buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full h-12 bg-[#1A1A1A] hover:bg-[#252525] text-white border border-zinc-800 flex items-center justify-center gap-3 transition-colors"
              variant="outline"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
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
              <span>Continue with Google</span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>

            <Button
              onClick={handleMicrosoftLogin}
              disabled={isLoading}
              className="w-full h-12 bg-[#1A1A1A] hover:bg-[#252525] text-white border border-zinc-800 flex items-center justify-center gap-3 transition-colors"
              variant="outline"
            >
              <svg className="w-5 h-5" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z" />
                <path fill="#81bc06" d="M12 1h10v10H12z" />
                <path fill="#05a6f0" d="M1 12h10v10H1z" />
                <path fill="#ffba08" d="M12 12h10v10H12z" />
              </svg>
              <span>Continue with Microsoft</span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
          </div>

          {/* Divider */}
          <div className="relative">
            <Separator className="bg-zinc-800" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0A0A0A] px-4 text-sm text-zinc-500">
              or continue with email
            </span>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300 text-sm font-medium">
                Email address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 pl-10 bg-[#1A1A1A] border-zinc-800 text-white placeholder:text-zinc-600 focus:border-blue-500 focus:ring-blue-500/20"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-300 text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 pl-10 bg-[#1A1A1A] border-zinc-800 text-white placeholder:text-zinc-600 focus:border-blue-500 focus:ring-blue-500/20"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
              onClick={submitLoginBtn}
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          {/* Footer Links */}
          <div className="space-y-4">
            <button className="text-sm text-zinc-400 hover:text-white transition-colors">Forgot your password?</button>
            <button onClick={signupbtn}>Sign up</button>
            {/* Security Badge */}
            <div className="flex items-center gap-2 pt-4">
              <Shield className="w-4 h-4 text-zinc-600" />
              <p className="text-xs text-zinc-600">Secured by 256-bit AES and 256-bit SSL/TLS encryption</p>
            </div>

            {/* Trust Indicators */}
            <div className="flex items-center gap-3 pt-2">
              <div className="flex items-center gap-1">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} className="w-4 h-4 text-yellow-500 fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                </div>
                <span className="text-xs text-zinc-400 ml-1">4.9/5</span>
              </div>
              <span className="text-xs text-zinc-600">•</span>
              <span className="text-xs text-zinc-500">SOC 2 Type II</span>
              <span className="text-xs text-zinc-600">•</span>
              <span className="text-xs text-zinc-500">GDPR Compliant</span>
            </div>

            {/* Terms */}
            <p className="text-xs text-zinc-600 leading-relaxed">
              By signing in, you agree to our{" "}
              <button className="text-zinc-400 hover:text-white transition-colors underline">Terms of Service</button>{" "}
              and <button className="text-zinc-400 hover:text-white transition-colors underline">Privacy Policy</button>
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Feature Preview */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#111111] items-center justify-center p-12 border-l border-zinc-900">
        <div className="max-w-lg space-y-8">
          {/* Feature Card */}
          <div className="bg-[#1A1A1A] rounded-xl p-6 border border-zinc-800 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <div className="w-5 h-5 rounded bg-blue-500" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="text-white font-semibold">Team Collaboration</h3>
                <p className="text-sm text-zinc-400">Real-time sync across your organization</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-zinc-400">Enterprise-grade security</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-zinc-400">99.9% uptime SLA</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-zinc-400">24/7 priority support</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#1A1A1A] rounded-lg p-4 border border-zinc-800">
              <div className="text-2xl font-bold text-white">500K+</div>
              <div className="text-xs text-zinc-500 mt-1">Active users</div>
            </div>
            <div className="bg-[#1A1A1A] rounded-lg p-4 border border-zinc-800">
              <div className="text-2xl font-bold text-white">99.9%</div>
              <div className="text-xs text-zinc-500 mt-1">Uptime</div>
            </div>
            <div className="bg-[#1A1A1A] rounded-lg p-4 border border-zinc-800">
              <div className="text-2xl font-bold text-white">150+</div>
              <div className="text-xs text-zinc-500 mt-1">Countries</div>
            </div>
          </div>

          {/* Testimonial */}
          <div className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-xl p-6 border border-blue-500/10">
            <p className="text-white text-base leading-relaxed mb-4">
              "This platform has transformed how our team collaborates. The performance is outstanding."
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
              <div>
                <div className="text-sm font-semibold text-white">Varun</div>
                <div className="text-xs text-zinc-400">Engineer, Vitt.ai</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
