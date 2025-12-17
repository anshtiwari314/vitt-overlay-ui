"use client"

import { useState } from "react"
// import { useAuth } from '../context/AuthContext'; // Assuming you have this context
import { v4 as uuidv4 } from "uuid"
import '../App.css'
import { useAuth } from "../context/AuthContext"
// --- SVG Icons ---
// User Icon SVG
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
  </svg>
)

// Lock Icon SVG
const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
      clipRule="evenodd"
    />
  </svg>
)

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
    <path
      fillRule="evenodd"
      d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
      clipRule="evenodd"
    />
  </svg>
)

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
      clipRule="evenodd"
    />
    <path d="M15.171 13.576l1.472 1.473a10.028 10.028 0 001.585-2.755c-1.274-4.057-5.064-7-9.542-7a9.972 9.972 0 00-2.742.384l2.06 2.06a4 4 0 015.130 5.130z" />
  </svg>
)

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [pass, setPass] = useState("")
  const [error, setError] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  const width = 420;
  const height = 520;

  const { setCurrentUser } = useAuth()

  function handleChecks() {
    if (email === "") {
      setError("Username field can't be empty")
      return
    }
    if (pass === "") {
      setError("Password field can't be empty")
      return
    }
    setError(null)
    handleAuth()
  }

  function handleAuth() {
    setLoading(true)

    // const url = `https://wpv7kxos9g.execute-api.ap-south-1.amazonaws.com/test/recruito-upload-apis/main_router`
    const url='https://recruito.vitti.insure/lms_router'
    fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route_name:"main_router",
        json_data:{
          trigger_func: "check_agent_login",
          params: {
            userid: email,
            password: pass,
          }
        }
        }),
      cache: "default",
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((err) => {
            throw err
          })
        }
        console.log("Response status:", res)
        return res.json()
      })
      .then((result) => {
        setLoading(false)
        if (result.error) {
          setError(result.error)
        } else if (result.result === true) {
          //console.log('email',email)
          localStorage.setItem("insurance-auth", JSON.stringify({ userid: result.data.sessionid }))
          localStorage.setItem("agent_name", JSON.stringify({ agent_name: email }))
          setCurrentUser({ userid: email, sessionuid: uuidv4() })
        } else {
          setError("Login failed. Please check your credentials.")
        }
      })
      .catch((err) => {
        setLoading(false)
        setError(err.error || "An unexpected error occurred. Please try again.")
        console.error("Fetch error:", err)
      })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    handleChecks()
  }

  return (
    // Main wrapper with a light gray background
    <div className="flex items-center justify-center min-h-screen bg-slate-50 font-sans" style={{ '-webkit-app-region': 'drag' }}>
      {/* Login card with white background and shadow */}
      <div className="p-8 space-y-6 bg-white rounded-xl shadow-lg" style={{ width: `${width}px`, height: `${height}px`,  '-webkit-app-region': 'drag' }}>
        {/* Header */}
        <div className="text-center" style={{ '-webkit-app-region': 'drag' }}>
          <h1 className="text-3xl font-bold text-slate-800">Sign In</h1>
          <p className="mt-2 text-slate-500">Welcome back! Please enter your details.</p>
        </div>

        {/* Display error message if it exists */}
        {error && (
          <div className="p-3 text-sm font-semibold text-red-800 bg-red-100 border border-red-200 rounded-lg text-center">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form
          className="space-y-6"
          style={{ '-webkit-app-region': 'no-drag' }}
          //onSubmit={handleSubmit}
        >
          {/* Username/Email Input */}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-600 mb-1">Username</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon />
              </div>
              <input
                type="text"
                placeholder="e.g. rajesh.kumar@company.com"
                className="w-full py-2.5 pl-10 pr-4 text-slate-800 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-600 mb-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LockIcon />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="e.g. MySecurePass@2024"
                className="w-full py-2.5 pl-10 pr-12 text-slate-800 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* Login Button */}
          <div>
            <button
              type="submit"
              className="w-full py-3 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
              disabled={loading}
              onClick={() => handleChecks()}
            >
              {loading ? (
                <div className="w-6 h-6 border-4 border-t-transparent border-white rounded-full animate-spin"></div>
              ) : (
                "Sign In"
              )}
            </button>
          </div>
        </form>

        <div className="text-sm text-center text-slate-500" style={{ '-webkit-app-region': 'no-drag' }}>
          <p>
            Don't have an account?{" "}
            <a href="#" className="font-medium text-indigo-600 hover:text-indigo-500">
              Sign Up
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}