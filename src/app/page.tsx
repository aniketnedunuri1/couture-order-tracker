"use client"

import { useState, useEffect, Suspense, FormEvent } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

interface TrackingResult {
  status: string
  estimatedDelivery: string
  deliveryTime?: string | null
  currentLocation?: string
  latestUpdate?: string
}

// Component that uses useSearchParams
function TrackingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [trackingCode, setTrackingCode] = useState("")
  const [inputTrackingCode, setInputTrackingCode] = useState("")
  const [trackingResult, setTrackingResult] = useState<TrackingResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noCodeProvided, setNoCodeProvided] = useState(false)

  // Function to handle form submission
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (inputTrackingCode.trim()) {
      router.push(`/?tracking=${encodeURIComponent(inputTrackingCode.trim())}`)
    }
  }

  // Function to fetch tracking data
  const fetchTrackingData = async (code: string) => {
    if (!code) {
      setNoCodeProvided(true)
      return
    }
    
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/track?tracking=${encodeURIComponent(code)}`, {
        method: "GET",
      })
      const data = await response.json()
      
      if (response.ok) {
        setTrackingResult(data)
        setError(null)
      } else {
        setError(data.error || "Failed to retrieve tracking information")
        setTrackingResult(null)
      }
    } catch {
      setError("An error occurred while retrieving your tracking information")
      setTrackingResult(null)
    }
    setIsLoading(false)
  }

  // Check for tracking parameter on load
  useEffect(() => {
    const trackingParam = searchParams.get('tracking')
    if (trackingParam) {
      // Remove quotes if present
      const cleanCode = trackingParam.replace(/^"|"$/g, '')
      setTrackingCode(cleanCode)
      fetchTrackingData(cleanCode)
    } else {
      setNoCodeProvided(true)
    }
  }, [searchParams])

  // Get status color based on status
  const getStatusColor = (status: string) => {
    const lowerStatus = status.toLowerCase()
    if (lowerStatus.includes("delivered")) return "text-green-600"
    if (lowerStatus.includes("transit")) return "text-blue-600"
    if (lowerStatus.includes("production")) return "text-amber-600"
    return "text-black"
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo and Header */}
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-2xl uppercase font-bold mb-2 tracking-tight text-center">
          COUTURE ORDER TRACKER
        </h1>
        <div className="h-px w-24 bg-black mb-4"></div>
        {trackingCode && (
          <p className="text-xs uppercase tracking-wider text-center">
            Tracking: {trackingCode}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="w-full border border-gray-200">
          <div className="flex flex-col items-center justify-center p-8">
            <div className="animate-pulse flex flex-col items-center">
              <div className="h-4 w-24 bg-gray-200 rounded mb-4"></div>
              <div className="h-3 w-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      ) : error ? (
        <Alert variant="destructive" className="mb-4 text-xs">
          <AlertCircle className="h-3 w-3" />
          <AlertTitle className="text-xs uppercase">Error</AlertTitle>
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      ) : trackingResult ? (
        <div className="w-full border border-black">
          <div className="p-6">
            <div className="space-y-6">
              <div className="border-b border-gray-200 pb-4">
                <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-1">Status</h2>
                <p className={`text-lg uppercase font-bold ${getStatusColor(trackingResult.status)}`}>
                  {trackingResult.status}
                </p>
              </div>
              
              <div>
                <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-1">Estimated Delivery</h2>
                <p className="text-sm">
                  {trackingResult.estimatedDelivery}
                </p>
              </div>
              {trackingResult.deliveryTime && (
                <div>
                  <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-1">Delivery Time</h2>
                  <p className="text-sm">
                    {trackingResult.deliveryTime}
                  </p>
                </div>
              )}
              {trackingResult.currentLocation && (
                <div>
                  <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-1">Current Location</h2>
                  <p className="text-sm">
                    {trackingResult.currentLocation}
                  </p>
                </div>
              )}
              {trackingResult.latestUpdate && (
                <div>
                  <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-1">Latest Update</h2>
                  <p className="text-sm">
                    {trackingResult.latestUpdate}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : noCodeProvided ? (
        <div className="w-full border border-black">
          <div className="p-6">
            <div className="text-center mb-6">
              <h2 className="text-sm uppercase font-bold mb-2">Track Your Order</h2>
              <p className="text-xs text-gray-600 mb-4">
                Enter your tracking code below
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="mb-6">
              <div className="flex flex-col space-y-3">
                <input
                  type="text"
                  value={inputTrackingCode}
                  onChange={(e) => setInputTrackingCode(e.target.value)}
                  placeholder="TRACKING CODE"
                  className="w-full px-3 py-2 border border-black text-xs uppercase placeholder:text-gray-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="w-full bg-black text-white uppercase text-xs py-2 px-4 hover:bg-gray-800 transition-colors"
                >
                  Track Order
                </button>
              </div>
            </form>
            
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-2">
                Don&apos;t have a tracking code?
              </p>
              <a 
                href="https://couturebyikigai.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs uppercase font-bold border-b border-black pb-px hover:opacity-70 transition-opacity"
              >
                Visit our website
              </a>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="mt-8 text-center text-gray-500 text-xs uppercase tracking-wider">
        <p>&copy; {new Date().getFullYear()} Couture by Ikigai</p>
      </footer>
    </div>
  )
}

// Loading fallback
function TrackingFallback() {
  return (
    <div className="w-full max-w-md">
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-2xl uppercase font-bold mb-2 tracking-tight text-center">
          COUTURE ORDER TRACKER
        </h1>
        <div className="h-px w-24 bg-black mb-4"></div>
      </div>
      
      <div className="w-full border border-gray-200">
        <div className="flex flex-col items-center justify-center p-8">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-4 w-24 bg-gray-200 rounded mb-4"></div>
            <div className="h-3 w-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
      
      <footer className="mt-8 text-center text-gray-500 text-xs uppercase tracking-wider">
        <p>&copy; {new Date().getFullYear()} Couture by Ikigai</p>
      </footer>
    </div>
  )
}

// Main page component with Suspense
export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-white">
      <Suspense fallback={<TrackingFallback />}>
        <TrackingContent />
      </Suspense>
    </main>
  )
}