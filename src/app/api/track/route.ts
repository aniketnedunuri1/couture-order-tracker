import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Cache UPS token
let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

// Get UPS token with caching
async function getUPSToken() {
  const now = Date.now();

  // Return cached token if still valid
  if (cachedToken && tokenExpiry && now < tokenExpiry) {
    return cachedToken;
  }

  // Get new token
  const clientId = process.env.UPS_CLIENT_ID!;
  const clientSecret = process.env.UPS_CLIENT_SECRET!;
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const tokenResp = await fetch("https://onlinetools.ups.com/security/v1/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${authHeader}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
  });

  const tokenData = await tokenResp.json();

  if (!tokenResp.ok) {
    throw new Error("Failed to get UPS token");
  }

  // Cache the token
  cachedToken = tokenData.access_token;
  tokenExpiry = now + tokenData.expires_in * 1000;

  return cachedToken;
}

// Common function to process tracking requests
async function processTrackingRequest(customCode: string) {
  // Step 1: Query Supabase
  const { data, error } = await supabase
    .from("Tracking")
    .select("upsTrackingNumber")
    .eq("customCode", customCode)
    .single();

  if (error) {
    console.log("Invalid code:", customCode);
    return NextResponse.json({
      status: "Invalid tracking code",
      estimatedDelivery: "Not available"
    });
  }

  // Check if tracking number is "Na" or "na" (order in production)
  if (data.upsTrackingNumber.toLowerCase() === "na") {
    console.log("Order in production:", customCode);
    return NextResponse.json({
      status: "Order in Production",
      estimatedDelivery: "Not available yet"
    });
  }

  // Step 2: Get UPS token
  const upsToken = await getUPSToken();

  // Step 3: Call UPS API
  const query = new URLSearchParams({
    locale: 'en_US',
    returnSignature: 'false',
    returnMilestones: 'false',
    returnPOD: 'false'
  }).toString();

  const upsResponse = await fetch(
    `https://onlinetools.ups.com/api/track/v1/details/${data.upsTrackingNumber}?${query}`,
    {
      method: "GET",
      headers: {
        transId: 'string',
        transactionSrc: 'testing',
        Authorization: `Bearer ${upsToken}`,
      },
    }
  );

  console.log("UPS API URL:", `https://onlinetools.ups.com/api/track/${data.upsTrackingNumber}?${query}`);
  const upsData = await upsResponse.json();
  console.log('Raw UPS Response:', JSON.stringify(upsData, null, 2));

  if (!upsResponse.ok) {
    console.error("UPS API Error:", upsData);
    return NextResponse.json(
      { error: `UPS API responded with status ${upsResponse.status}` },
      { status: upsResponse.status }
    );
  }

  // Step 4: Extract relevant data and return it to the client
  const trackDetails = upsData.trackResponse?.shipment?.[0]?.package?.[0];

  // Format date from YYYYMMDD and HHMMSS to readable format
  const formatDateTime = (date: string, time: string) => {
    if (!date || date.length !== 8) return "Not available";
    
    const year = date.slice(0,4);
    const month = date.slice(4,6);
    const day = date.slice(6,8);
    
    if (!time || time.length !== 6) {
      return `${year}-${month}-${day}`;
    }

    const hour = time.slice(0,2);
    const minute = time.slice(2,4);
    const second = time.slice(4,6);
    
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  };

  // Get status from currentStatus.description
  const status = trackDetails?.currentStatus?.description || "Unknown";

  // Get estimated delivery
  const estimatedDelivery = trackDetails?.deliveryDate?.[0]?.date ? 
    formatDateTime(trackDetails.deliveryDate[0].date, "") : 
    "Not available";

  const response = {
    status,
    estimatedDelivery,
  };
  console.log('Final Response:', response);

  return NextResponse.json(response);
}

// GET method to handle URL query parameters
export async function GET(request: Request) {
  try {
    // Get the URL and parse the tracking parameter
    const { searchParams } = new URL(request.url);
    const customCode = searchParams.get('tracking');
    
    if (!customCode) {
      return NextResponse.json({ error: "Missing tracking code" }, { status: 400 });
    }
    
    // Remove quotes if present
    const cleanCode = customCode.replace(/^"|"$/g, '');
    
    return processTrackingRequest(cleanCode);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { customCode } = await request.json();
    return processTrackingRequest(customCode);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
