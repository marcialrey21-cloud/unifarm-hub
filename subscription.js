export const SubscriptionController = {
    init: function() {
        // console.log("Subscription Engine initialized.");
        this.bindEvents();
        
        // 🟢 SURGICAL ADDITION 1: Catch the user when they return from PayMongo
        this.checkUrlForUpgrades(); 
    },

    checkUrlForUpgrades: function() {
        // Read the web address to see if PayMongo sent them back with a message
        const urlParams = new URLSearchParams(window.location.search);
        
        if (urlParams.get('upgrade') === 'success') {
            alert("🎉 Payment Successful! Welcome to Uni-Farm Hub Pro! Your enterprise tools and predictive maps are now unlocked.");
            
            // Clean the web address so the alert doesn't keep popping up if they refresh
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Note: Your AuthController should now see them as a 'pro' user on the next database check!
        } else if (urlParams.get('upgrade') === 'canceled') {
            alert("Payment was canceled. You are still on the Basic Farmer tier.");
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    },

    bindEvents: function() {
        const upgradeBtn = document.getElementById('btnUpgradePro');
        if (upgradeBtn) {
            upgradeBtn.addEventListener('click', () => {
                this.initiateCheckout('plan_pro_monthly', 499.00);
            });
        }

        const openSubBtn = document.getElementById('btnOpenSubscription');
        if (openSubBtn) {
            openSubBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showSubscriptionPage();
            });
        }
    },

    showSubscriptionPage: function() {
        // console.log("Navigating to Subscription Paywall...");

        document.querySelectorAll('.page-section').forEach(section => {
            section.style.display = 'none';
            section.classList.remove('active-section');
        });

        document.querySelectorAll('.bottom-nav .nav-item').forEach(nav => {
            nav.classList.remove('active');
        });

        const subView = document.getElementById('subscriptionView');
        if (subView) {
            subView.style.display = 'block';
            subView.classList.add('active-section');
            window.scrollTo(0, 0);
        }
    },

    initiateCheckout: async function(planId, amount) {
        // console.log(`Initiating secure checkout for ${planId} at ₱${amount}`);
        
        const upgradeBtn = document.getElementById('btnUpgradePro');
        upgradeBtn.innerText = "Connecting to Secure Checkout...";
        upgradeBtn.disabled = true;
        upgradeBtn.style.opacity = "0.7";

        try {
            const userId = window.AppState?.user?.id || 'TestUser';
            
            const response = await fetch('https://bniwmsoxyuchuoaqjjxo.supabase.co/functions/v1/paymongo-checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    planId: planId,
                    amount: amount,
                    userId: userId,
                    // 🟢 SURGICAL ADDITION 2: Explicitly tell the backend where the live app is
                    successUrl: 'https://unifarm-hub.netlify.app/?upgrade=success',
                    cancelUrl: 'https://unifarm-hub.netlify.app/?upgrade=canceled'
                })
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            if (data.checkoutUrl) {
                // console.log("Success! Redirecting to PayMongo...");
                window.location.href = data.checkoutUrl; 
            } else {
                throw new Error("No checkout URL returned.");
            }

        } catch (error) {
            console.error("Checkout Error:", error);
            alert("Failed to connect to payment gateway. Please try again.");
            
            upgradeBtn.innerText = "Upgrade Now";
            upgradeBtn.disabled = false;
            upgradeBtn.style.opacity = "1";
        }
    }
};