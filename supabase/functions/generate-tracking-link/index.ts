// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the Auth context of the function
    const supabaseClient = createClient(
      // Supabase API URL - env var exported by default.
      Deno.env.get('SUPABASE_URL') ?? '',
      // Supabase API ANON KEY - env var exported by default.
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      // Create client with Auth context of the user that called the function.
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get the tracking domain from environment variable or use a default
    const trackingDomain = Deno.env.get('TRACKING_DOMAIN') || 'tracking.couturebyikigai.com'
    
    // Get the request data
    const { record } = await req.json()
    
    // Generate the tracking link
    const trackingLink = `https://${trackingDomain}?tracking=${encodeURIComponent(record.customCode)}`
    
    // Update the record with the tracking link
    const { data, error } = await supabaseClient
      .from('Tracking')
      .update({ trackingLink: trackingLink })
      .eq('id', record.id)
      .select()
    
    if (error) throw error
    
    // Return the data
    return new Response(
      JSON.stringify({ trackingLink, record: data[0] }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
