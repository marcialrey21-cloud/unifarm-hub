import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    // 1. Get the payload sent by PayMongo
    const payload = await req.json();
    const event = payload.data;

    // 2. We only care if a payment was successfully paid
    if (event.attributes.type === 'link.payment.paid' || event.attributes.type === 'checkout_session.payment.paid') {
      
      const paymentData = event.attributes.data.attributes;
      const remarks = paymentData.remarks; 
      
      // Extract amount and description to determine WHICH product was bought
      const amountPaid = paymentData.amount; 
      const description = paymentData.description || "";

      // 3. Extract the exact User ID from the remarks string
      if (remarks && remarks.includes("User ID: ")) {
        const userId = remarks.split("User ID: ")[1].trim();
        console.log(`Payment confirmed for User ID: ${userId}`);

        // 4. Connect to your Supabase Database using "God Mode" keys
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // ========================================================
        // ROUTE A: ₱50.00 SCAN TOP-UP (Amount is in centavos: 5000)
        // ========================================================
        if (amountPaid === 5000 || description.includes('10 Premium AI Scans')) {
          console.log(`Processing 10 Premium Scans for user ${userId}...`);

          // Step A: Fetch their current scan balance from user_profiles
          const { data: profileData, error: fetchError } = await supabase
            .from('user_profiles') 
            .select('paid_scans') 
            .eq('id', userId)
            .single();

          if (fetchError && fetchError.code !== 'PGRST116') {
            console.error("Failed to fetch profile:", fetchError.message);
            throw new Error("Profile fetch failed");
          }

          // If they have scans, use that number. If not, start at 0.
          const currentScans = profileData?.paid_scans || 0;

          // Step B: Add 10 scans and save it back to the database
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({ paid_scans: currentScans + 10 })
            .eq('id', userId);

          if (updateError) {
            console.error("Failed to top-up scans in database:", updateError.message);
            throw new Error("Scan top-up failed");
          }
          
          console.log(`Successfully added 10 scans to user ${userId}!`);

        } 
        // ========================================================
        // ROUTE B: AGRI-BUSINESS PRO UPGRADE (Your Original Code)
        // ========================================================
        else {
          console.log(`Processing Agri-Business Pro Upgrade for user ${userId}...`);
          
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