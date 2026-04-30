import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// These CORS headers allow your browser app to securely talk to this backend server
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests (Browser security check)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Get the data sent from your frontend app (subscription.js)
    const { planId, amount, userId } = await req.json()

    // 2. Put your PayMongo Test Secret Key here!
    const PAYMONGO_SECRET_KEY = Deno.env.get('PAYMONGO_SECRET_KEY');
    
    // PayMongo requires the secret key to be Base64 encoded for basic authentication
    const encodedKey = btoa(PAYMONGO_SECRET_KEY + ":");

    // 3. PayMongo expects amounts in cents (e.g., ₱499.00 becomes 49900)
    const amountInCents = Math.round(amount * 100);

    console.log(`Generating PayMongo link for User: ${userId}, Amount: ${amountInCents}`);

    // 4. Send the request to PayMongo's secure API
    const paymongoResponse = await fetch('https://api.paymongo.com/v1/links', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${encodedKey}`
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: amountInCents,
            description: `Unifarm Hub Premium - ${planId}`,
            remarks: `User ID: ${userId}`
          }
        }
      })
    });

    const paymongoData = await paymongoResponse.json();

    // Catch any errors PayMongo sends back
    if (!paymongoResponse.ok) {
      throw new Error(JSON.stringify(paymongoData.errors));
    }

    // 5. Extract the secure checkout URL and send it back to the frontend
    const checkoutUrl = paymongoData.data.attributes.checkout_url;

    return new Response(
      JSON.stringify({ checkoutUrl: checkoutUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (error) {
    console.error("PayMongo Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})