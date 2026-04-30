import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    // 1. Get the payload sent by PayMongo
    const payload = await req.json();
    const event = payload.data;

    console.log(`Received Webhook Event: ${event.attributes.type}`);

    // 2. We only care if a payment was successfully paid
    if (event.attributes.type === 'link.payment.paid' || event.attributes.type === 'checkout_session.payment.paid') {
      
      const paymentData = event.attributes.data.attributes;
      const remarks = paymentData.remarks; // This looks like "User ID: 12345..."

      // 3. Extract the exact User ID from the remarks string
      if (remarks && remarks.includes("User ID: ")) {
        const userId = remarks.split("User ID: ")[1].trim();
        console.log(`Payment confirmed for User ID: ${userId}`);

        // 4. Connect to your Supabase Database using "God Mode" keys
        // (These keys are automatically injected by Supabase into your Edge Functions securely)
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 5. Upgrade the User in the database!
        // Note: This assumes you have a table called 'user_profiles' with a 'plan' column.
        // We can adjust this exact table/column name later if yours is different!
        const { error } = await supabase
          .from('user_profiles')
          .update({ plan: 'Agri-Business Pro' })
          .eq('id', userId);

        if (error) {
          console.error("Failed to upgrade user in database:", error.message);
          throw new Error("Database update failed");
        }

        console.log(`Successfully upgraded user ${userId} to Premium!`);
      }
    }

    // Always tell PayMongo "Message Received!" so they don't keep resending it
    return new Response(JSON.stringify({ message: "Webhook processed successfully" }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Webhook Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});