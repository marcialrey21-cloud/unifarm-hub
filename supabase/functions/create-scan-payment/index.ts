import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    // 1. Parse the incoming request from your app to get the userId
    const { userId } = await req.json();

    // Safety check: Make sure the app actually sent an ID
    if (!userId) {
      throw new Error("User ID is required to process this payment.");
    }

    const PAYMONGO_SECRET_KEY = Deno.env.get('PAYMONGO_SECRET_KEY');

    // 2. Prepare the request to PayMongo
    const options = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Basic ${btoa(PAYMONGO_SECRET_KEY + ':')}` 
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: 5000, 
            description: '10 Premium AI Scans - Uni-Farm Hub',
            // 3. Format the remarks exactly how our webhook expects it!
            remarks: `User ID: ${userId}` 
          }
        }
      })
    };

    // Ping PayMongo to generate the checkout URL
    const response = await fetch('https://api.paymongo.com/v1/links', options);
    const data = await response.json();

    if (data.errors) {
        throw new Error(data.errors[0].detail);
    }

    // Send the secure URL back to your frontend app
    return new Response(
      JSON.stringify({ checkoutUrl: data.data.attributes.checkout_url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})