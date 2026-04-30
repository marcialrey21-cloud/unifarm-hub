export const SubscriptionController = {
    init: function() {
        console.log("Subscription Engine initialized.");
        this.bindEvents();
    },

    bindEvents: function() {
        // 1. Listen for the actual checkout/upgrade click
        const upgradeBtn = document.getElementById('btnUpgradePro');
        if (upgradeBtn) {
            upgradeBtn.addEventListener('click', () => {
                this.initiateCheckout('plan_pro_monthly', 499.00);
            });
        }

        // 2. Listen for the button in Settings that OPENS the paywall
        const openSubBtn = document.getElementById('btnOpenSubscription');
        if (openSubBtn) {
            openSubBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showSubscriptionPage();
            });
        }
    },

    showSubscriptionPage: function() {
        console.log("Navigating to Subscription Paywall...");

        // A. Hide every other page section
        document.querySelectorAll('.page-section').forEach(section => {
            section.style.display = 'none';
            section.classList.remove('active-section');
        });

        // B. Remove the "active" highlight from the bottom navigation icons
        // (This makes it clear they are on a special screen, not a standard tab)
        document.querySelectorAll('.bottom-nav .nav-item').forEach(nav => {
            nav.classList.remove('active');
        });

        // C. Reveal ONLY the subscription view
        const subView = document.getElementById('subscriptionView');
        if (subView) {
            subView.style.display = 'block';
            subView.classList.add('active-section');
            
            // D. Scroll to the very top of the page so they see the header
            window.scrollTo(0, 0);
        }
    },

    initiateCheckout: async function(planId, amount) {
        console.log(`Initiating secure checkout for ${planId} at ₱${amount}`);
        
        const upgradeBtn = document.getElementById('btnUpgradePro');
        upgradeBtn.innerText = "Connecting to Secure Checkout...";
        upgradeBtn.disabled = true;
        upgradeBtn.style.opacity = "0.7";

        try {
            const userId = window.AppState?.user?.id || 'TestUser';
            
            // Call your live Supabase Edge Function!
            const response = await fetch('https://bniwmsoxyuchuoaqjjxo.supabase.co/functions/v1/paymongo-checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    planId: planId,
                    amount: amount,
                    userId: userId
                })
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            // Redirect the user to the PayMongo QR code!
            if (data.checkoutUrl) {
                console.log("Success! Redirecting to PayMongo...");
                window.location.href = data.checkoutUrl; 
            } else {
                throw new Error("No checkout URL returned.");
            }

        } catch (error) {
            console.error("Checkout Error:", error);
            alert("Failed to connect to payment gateway. Please try again.");
            
            // Reset button on failure
            upgradeBtn.innerText = "Upgrade Now";
            upgradeBtn.disabled = false;
            upgradeBtn.style.opacity = "1";
        }
    }
};