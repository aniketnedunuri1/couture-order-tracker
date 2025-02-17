"use client"

import { useState } from "react"


import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

interface TrackingResult {
  status: string
  estimatedDelivery: string
  currentLocation: string
  latestUpdate: string
}

export default function Home() {
  const [trackingCode, setTrackingCode] = useState("")
  const [trackingResult, setTrackingResult] = useState<TrackingResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customCode: trackingCode }),
      })
      const data = await response.json()
      if (response.ok) {
        setTrackingResult(data)
      } else {
        setError(data.error || "An error occurred")
      }
    } catch (error) {
      setError("An error occurred")
    }
    setIsLoading(false)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Couture Order Tracker</CardTitle>
          <CardDescription>Enter your tracking code</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              placeholder="e.g., IKIGAI-CLIENT-1"
              required
            />
            <Button variant="default" className="w-full" disabled={isLoading}>
              {isLoading ? "Tracking..." : "Track Order"}
            </Button>
         


          </form>

          
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {trackingResult && (
            <div className="mt-4 space-y-2">
              <p>
                <strong>Status:</strong> {trackingResult.status}
              </p>
              <p>
                <strong>Estimated Delivery:</strong> {trackingResult.estimatedDelivery}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      
    </main>
  )
}