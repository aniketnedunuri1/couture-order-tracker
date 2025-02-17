import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role key for server-side access
);

export async function POST(request: Request) {
  try {
    const { customCode } = await request.json(); // Get custom code from client input

    // Step 1: Query Supabase to find the UPS tracking number
    const { data, error } = await supabase
      .from("Tracking") // Replace with your actual table name
      .select("upsTrackingNumber") // Replace with your actual column name for the tracking number
      .eq("customCode", customCode) // Match the custom code
      .single();

    if (error || !data) {
      console.error("Supabase Error:", error);
      return NextResponse.json(
        { error: "Invalid custom code or tracking number not found" },
        { status: 404 }
      );
    }

    const upsTrackingNumber = data.upsTrackingNumber;
    console.log("Tracking number from Supabase:", upsTrackingNumber);

    // Step 2: Fetch the UPS token from your /api/ups-token route
    const tokenResp = await fetch("/api/ups-token");
    const tokenData = await tokenResp.json();

    if (!tokenResp.ok || !tokenData.access_token) {
      console.error("UPS Token Error:", tokenData);
      return NextResponse.json({ error: "Failed to fetch UPS token" }, { status: 500 });
    }

    const upsToken = tokenData.access_token;

    // Step 3: Call the UPS API with the retrieved tracking number
    const query = new URLSearchParams({
      locale: 'en_US',
      returnSignature: 'false',
      returnMilestones: 'false',
      returnPOD: 'false'
    }).toString();
    
    console.log("UPS", upsTrackingNumber);
    const upsResponse = await fetch(
      `https://onlinetools.ups.com/api/track/v1/details/${upsTrackingNumber}?${query}`,
      {
        method: "GET",
        headers: {
          transId: 'string',
          transactionSrc: 'testing',
          Authorization: `Bearer ${upsToken}`,
        },
      }
    );

    console.log("UPS API URL:", `https://onlinetools.ups.com/api/track/${upsTrackingNumber}?${query}`);
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

    const response = {
      status,
      estimatedDelivery,
    };
    console.log('Final Response:', response);

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
