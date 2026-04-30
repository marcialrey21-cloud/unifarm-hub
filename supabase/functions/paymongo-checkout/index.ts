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
    // 1. SURGICAL FIX: Now we extract ALL data, including the Netlify URLs!
    const { planId, amount, userId, successUrl, cancelUrl } = await req.json()

    const PAYMONGO_SECRET_KEY = Deno.env.get('PAYMONGO_SECRET_KEY');
    const encodedKey = btoa(PAYMONGO_SECRET_KEY + ":");
    const amountInCents = Math.round(amount * 100);

    console.log(`Generating PayMongo Checkout for User: ${userId}, Amount: ${amountInCents}`);

    // 2. UPGRADE: We switch to the 'checkout_sessions' API to support dynamic redirects
    const paymongoResponse = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${encodedKey}`
      },
      body: JSON.stringify({
        data: {
          attributes: {
            send_email_receipt: false,
            show_description: true,
            show_line_items: true,
            payment_method_types: ['gcash', 'paymaya', 'card'], // The payment options you want to accept
            line_items: [
              {
                currency: 'PHP',
                amount: amountInCents,
                description: `Unifarm Hub Premium - ${planId}`,
                name: 'Premium Plan Upgrade',
                quantity: 1
              }
            ],
            // 3. INJECTION: We pass the live Netlify URLs directly to PayMongo!
            success_url: successUrl,
            cancel_url: cancelUrl,
            reference_number: `USER_${userId}_${Date.now()}` // Helpful for your accounting
          }
        }
      })
    });

    const paymongoData = await paymongoResponse.json();

    if (!paymongoResponse.ok) {
      throw new Error(JSON.stringify(paymongoData.errors));
    }

    // Extract the secure checkout URL from the Checkout Session response
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