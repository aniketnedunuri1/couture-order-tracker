import { NextResponse } from "next/server";
import Airtable from "airtable";

// Initialize Airtable client
const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID!);

// Cache UPS token
let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

// Cache FedEx token
let cachedFedExToken: string | null = null;
let fedExTokenExpiry: number | null = null;

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

// Function to get FedEx OAuth token with caching
async function getFedExToken() {
  const now = Date.now();
  
  // Return cached token if still valid
  if (cachedFedExToken && fedExTokenExpiry && now < fedExTokenExpiry) {
    return cachedFedExToken;
  }
  
  console.log("Getting new FedEx OAuth token");
  const tokenUrl = "https://apis.fedex.com/oauth/token";
  
  // Create the request body
  const requestBody = `grant_type=client_credentials&client_id=${process.env.FEDEX_API_KEY}&client_secret=${process.env.FEDEX_SECRET_KEY}`;
  
  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: requestBody
    });
    
    console.log("FedEx OAuth response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("FedEx OAuth error response:", errorText);
      throw new Error(`FedEx token API responded with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log("FedEx OAuth success, token received");
    
    // Cache the token (typically valid for 1 hour)
    cachedFedExToken = data.access_token;
    fedExTokenExpiry = now + (data.expires_in * 1000);
    
    return data.access_token;
  } catch (error) {
    console.error("Error getting FedEx token:", error);
    throw error;
  }
}

// Function to track UPS package
async function trackUPSPackage(trackingNumber: string) {
  // Get UPS token
  const upsToken = await getUPSToken();
  
  // Call UPS API
  const query = new URLSearchParams({
    locale: 'en_US',
    returnSignature: 'false',
    returnMilestones: 'false',
    returnPOD: 'false'
  }).toString();

  const upsResponse = await fetch(
    `https://onlinetools.ups.com/api/track/v1/details/${trackingNumber}?${query}`,
    {
      method: "GET",
      headers: {
        transId: 'string',
        transactionSrc: 'testing',
        Authorization: `Bearer ${upsToken}`,
      },
    }
  );

  console.log("UPS API URL:", `https://onlinetools.ups.com/api/track/v1/details/${trackingNumber}?${query}`);
  const upsData = await upsResponse.json();
  console.log('Raw UPS Response:', JSON.stringify(upsData, null, 2));

  if (!upsResponse.ok) {
    console.error("UPS API Error:", upsData);
    throw new Error(`UPS API responded with status ${upsResponse.status}`);
  }

  // Extract relevant data
  const trackDetails = upsData.trackResponse?.shipment?.[0]?.package?.[0];
  const latestActivity = trackDetails?.activity?.[0];

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
    
  // Get current location if available
  const currentLocation = latestActivity?.location?.address ? 
    `${latestActivity.location.address.city || ''}, ${latestActivity.location.address.stateProvince || ''}`.trim() : 
    "Not available";
    
  // Get latest update time if available
  const latestUpdate = latestActivity?.date ? 
    formatDateTime(latestActivity.date, latestActivity.time || "") : 
    "Not available";

  return {
    status,
    estimatedDelivery,
    currentLocation,
    latestUpdate
  };
}

// Function to track FedEx package
async function trackFedExPackage(trackingNumber: string) {
  console.log("Tracking FedEx package:", trackingNumber);
  try {
    const token = await getFedExToken();
    console.log("FedEx token obtained successfully:", token.substring(0, 10) + "...");
    
    const requestBody = {
      includeDetailedScans: true,
      trackingInfo: [
        {
          trackingNumberInfo: {
            trackingNumber: trackingNumber,
            carrierCode: "FDXE"
          }
        }
      ]
    };
    
    console.log("FedEx tracking request body:", JSON.stringify(requestBody));
    
    const trackingResponse = await fetch("https://apis.fedex.com/track/v1/trackingnumbers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-locale": "en_US",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log("FedEx tracking response status:", trackingResponse.status);
    
    // Log headers in a TypeScript-friendly way
    const headerObj: Record<string, string> = {};
    trackingResponse.headers.forEach((value, key) => {
      headerObj[key] = value;
    });
    console.log("FedEx tracking response headers:", JSON.stringify(headerObj));
    
    if (!trackingResponse.ok) {
      const errorText = await trackingResponse.text();
      console.error("FedEx tracking error response:", errorText);
      throw new Error(`FedEx API responded with status ${trackingResponse.status}: ${errorText}`);
    }

    const fedexData = await trackingResponse.json();
    console.log("FedEx tracking data received:", JSON.stringify(fedexData).substring(0, 200) + "...");
    
    // Check if we have valid data
    if (!fedexData.output || !fedexData.output.completeTrackResults || 
        !fedexData.output.completeTrackResults[0] || 
        !fedexData.output.completeTrackResults[0].trackResults) {
      throw new Error("Invalid response format from FedEx API");
    }
    
    const trackResults = fedexData.output.completeTrackResults[0].trackResults[0];
    
    // Check if there are scan events
    if (!trackResults.scanEvents || trackResults.scanEvents.length === 0) {
      throw new Error("No scan events found in FedEx response");
    }
    
    const latestActivity = trackResults.scanEvents[0];
    const latestStatus = trackResults.latestStatusDetail || {};
    const estimatedDelivery = trackResults.estimatedDeliveryTimeWindow?.window?.ends || "Not available";

    return {
      status: latestStatus.description || latestStatus.statusByLocale || "In transit",
      estimatedDelivery: typeof estimatedDelivery === 'string' ? estimatedDelivery : "Not available",
      currentLocation: latestActivity.scanLocation?.city + 
        (latestActivity.scanLocation?.stateOrProvinceCode ? `, ${latestActivity.scanLocation.stateOrProvinceCode}` : ""),
      latestUpdate: latestActivity.date || new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error tracking FedEx package:", error);
    throw error;
  }
}

// Helper function to detect carrier type from tracking number format
function detectCarrier(trackingNumber: string): "UPS" | "FEDEX" | null {
  // UPS tracking numbers are typically 1Z followed by 16 digits
  // or 9-character alphanumeric codes
  if (trackingNumber.startsWith("1Z") || 
      (/^\d{9}$/.test(trackingNumber)) || 
      (/^\d{12}$/.test(trackingNumber))) {
    return "UPS";
  }
  
  // FedEx tracking numbers are typically 12 or 15 digits
  // or 10 digits starting with 96 or 97
  if ((/^\d{12}$/.test(trackingNumber)) || 
      (/^\d{15}$/.test(trackingNumber)) || 
      (/^(96|97)\d{8}$/.test(trackingNumber))) {
    return "FEDEX";
  }
  
  return null;
}

// Common function to process tracking requests
async function processTrackingRequest(customCode: string) {
  // Step 1: Query Airtable
  try {
    // Use UPPER() function to make the search case-insensitive
    const records = await airtable('Clients')
      .select({
        filterByFormula: `UPPER({DropCode}) = UPPER("${customCode}")`
      })
      .firstPage();
      
    console.log("Airtable query for code:", customCode);

    if (!records || records.length === 0) {
      console.log("Invalid code:", customCode);
      return NextResponse.json({
        status: "Invalid tracking code",
        estimatedDelivery: "Not available"
      });
    }

    const record = records[0];
    const trackingNumber = record.get('tracking') as string;
    let carrier = (record.get('carrier') as string) || "UPS"; // Default to UPS for backward compatibility
    
    // Check if tracking number is "Na" or "na" (order in production)
    if (!trackingNumber || trackingNumber.toLowerCase() === "na") {
      console.log("Order in production:", customCode);
      return NextResponse.json({
        status: "Order in Production",
        estimatedDelivery: "Not available yet"
      });
    }

    console.log("Tracking number:", trackingNumber, "Carrier:", carrier);
  
    // If carrier is not specified or set to AUTO, try to detect it from the tracking number format
    if (!carrier || carrier.toUpperCase() === "AUTO") {
      const detectedCarrier = detectCarrier(trackingNumber);
      if (detectedCarrier) {
        carrier = detectedCarrier;
      } else {
        carrier = "UPS"; // Default to UPS if detection fails
      }
    }
    
    // Normalize carrier to uppercase for consistent comparison
    carrier = carrier.toUpperCase();

      try {
      // Track the package based on the carrier
      let trackingResult;
      if (carrier === "FEDEX") {
        console.log("Processing as FEDEX tracking");
        trackingResult = await trackFedExPackage(trackingNumber);
      } else {
        console.log("Processing as UPS tracking");
        trackingResult = await trackUPSPackage(trackingNumber);
      }
      
      console.log('Final Response:', trackingResult);
      return NextResponse.json(trackingResult);
    } catch (error) {
      console.error("Error tracking package:", error);
      return NextResponse.json(
        { error: `Error tracking package: ${(error as Error).message}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error querying Airtable:", error);
    return NextResponse.json(
      { error: `Error retrieving tracking information: ${(error as Error).message}` },
      { status: 500 }
    );
  }
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
    
    // Clean the tracking code - remove quotes, trim whitespace, and handle URL encoding issues
    const cleanCode = decodeURIComponent(customCode)
      .replace(/^"|"$/g, '')
      .replace(/\+/g, ' ')
      .trim();
    
    console.log("Cleaned tracking code:", cleanCode);
    return processTrackingRequest(cleanCode);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { customCode } = await request.json();
    
    if (!customCode) {
      return NextResponse.json({ error: "Missing tracking code" }, { status: 400 });
    }
    
    // Clean the tracking code - remove quotes, trim whitespace, and handle URL encoding issues
    const cleanCode = decodeURIComponent(customCode)
      .replace(/^"|"$/g, '')
      .replace(/\+/g, ' ')
      .trim();
      
    console.log("Cleaned tracking code (POST):", cleanCode);
    return processTrackingRequest(cleanCode);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
