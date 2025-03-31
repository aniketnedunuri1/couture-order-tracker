"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

interface TrackingResult {
  status: string
  estimatedDelivery: string
}

export default function Home() {
  const searchParams = useSearchParams()
  const [trackingCode, setTrackingCode] = useState("")
  const [trackingResult, setTrackingResult] = useState<TrackingResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noCodeProvided, setNoCodeProvided] = useState(false)

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
    <main className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-white">
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
              </div>
            </div>
          </div>
        ) : noCodeProvided ? (
          <div className="w-full border border-black">
            <div className="p-6 text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-4 text-black" />
              <h2 className="text-sm uppercase font-bold mb-2">No Tracking Code Provided</h2>
              <p className="text-xs text-gray-600">
                Please use a URL with a tracking parameter:<br />
                <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                  ?tracking=YOUR-CODE
                </code>
              </p>
            </div>
          </div>
        ) : null}

        <footer className="mt-8 text-center text-gray-500 text-xs uppercase tracking-wider">
          <p>&copy; {new Date().getFullYear()} Couture by Ikigai</p>
        </footer>
      </div>
    </main>
  )
}