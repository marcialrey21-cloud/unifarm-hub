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
    // 1. Extract data sent from the frontend
    const { userId, successUrl, cancelUrl } = await req.json()

    const PAYMONGO_SECRET_KEY = Deno.env.get('PAYMONGO_SECRET_KEY');
    const encodedKey = btoa(PAYMONGO_SECRET_KEY + ":");
    
    // 2. HARDCODED PRICE: We force this to 49900 centavos (₱499.00) 
    // This guarantees the Agri-Business Pro price regardless of which button is clicked.
    const amountInCents = 49900; 

    console.log(`Generating PayMongo Checkout for User: ${userId}, Amount: ${amountInCents}`);

    // 3. Create the secure Checkout Session
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
            // 4. UNIFIED PAYMENT METHODS: Forces GCash, Maya, and Cards to appear!
            payment_method_types: ['card', 'paymaya', 'gcash', 'grab_pay'], 
            line_items: [
              {
                currency: 'PHP',
                amount: amountInCents,
                description: `Unlock full power of Unifarm Hub`,
                name: 'Agri-Business Pro Upgrade',
                quantity: 1
              }
            ],
            // Use provided URLs, or fallback to your Netlify app safely
            success_url: successUrl || 'https://unifarm-hub.netlify.app/?payment=success',
            cancel_url: cancelUrl || 'https://unifarm-hub.netlify.app/',
            reference_number: `USER_${userId}_${Date.now()}` // Helpful for your accounting
          }
        }
      })
    });

    const paymongoData = await paymongoResponse.json();

    if (!paymongoResponse.ok) {
      throw new Error(JSON.stringify(paymongoData.errors));
    }

    // Extract the secure checkout URL from the response
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