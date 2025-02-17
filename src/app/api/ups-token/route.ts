import { NextResponse } from "next/server";

let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

export async function GET() {
  const now = Date.now();

  // If the token is still valid, return it
  if (cachedToken && tokenExpiry && now < tokenExpiry) {
    return NextResponse.json({ access_token: cachedToken });
  }

  // Get UPS token
  const clientId = process.env.UPS_CLIENT_ID!;
  const clientSecret = process.env.UPS_CLIENT_SECRET!;
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const tokenResp = await fetch("https://wwwcie.ups.com/security/v1/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${authHeader}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
  });

  const tokenData = await tokenResp.json();

  if (!tokenResp.ok) {
    return NextResponse.json({ error: "Failed to get UPS token" }, { status: 500 });
  }

  // Cache the token and expiry time (UPS tokens usually last for 1 hour)
  cachedToken = tokenData.access_token;
  tokenExpiry = now + tokenData.expires_in * 1000; // Convert seconds to milliseconds

  return NextResponse.json({ access_token: cachedToken });
}
