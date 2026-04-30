import { AppState } from './state.js';
import { supabaseClient } from './db.js';
import { UnifarmApp } from './script.js';

export const AuthController = {
  init: function() {
    const authForm = document.getElementById('authForm');
    const logoutBtn = document.getElementById('logoutBtn');

    // Attach our specific logic to the buttons
    if (authForm) {
      authForm.addEventListener('submit', (e) => this.handleLoginSubmit(e));
    }
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }
  },

  handleLoginSubmit: async function(e) {
    e.preventDefault();
    
    if (!supabaseClient || !supabaseClient.auth) {
      this.showMessage("Database connection not ready. Please refresh.", "error");
      return;
    }

    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const submitBtn = document.getElementById('authSubmitBtn');

    submitBtn.innerText = "Connecting...";
    this.showMessage("", "clear");

    try {
      // 1. Attempt to Login
      const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (signInError) {
        // 2. If login fails, try to Register (Auto-Signup Flow)
        if (signInError.message.toLowerCase().includes("invalid login") || 
            signInError.message.toLowerCase().includes("not found") ||
            signInError.message.toLowerCase().includes("invalid credentials")) {
          
          const { error: signUpError } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
          });

          if (signUpError) throw signUpError;
          this.showMessage("Account created! Check your email to confirm.", "success");
          
        } else {
          throw signInError; // Throw other errors (like rate limits)
        }
      } else {
        // 3. Login Success!
        this.handleLoginSuccess(signInData.user);
      }
    } catch (err) {
      console.error("Auth Error:", err);
      this.showMessage(err.message, "error");
    } finally {
      submitBtn.innerText = "Log In / Register";
    }
  },

  handleLoginSuccess: function(user) {
    console.log("Logged in successfully!");
    AppState.user.id = user.id;
    
    const authScreen = document.getElementById('authScreen');
    if (authScreen) authScreen.classList.add('hidden-auth');
    
    // Tell the master app controller to boot up the farm data!
    UnifarmApp.bootUserServices(user); 
  },

  handleLogout: async function() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.innerText = "Wait..."; 

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      alert("Error logging out: " + error.message);
      if (logoutBtn) logoutBtn.innerText = "🚪 Exit";
    } else {
      // SECURITY: Wipe the screen completely clean!
      window.unifarm_user_id = null;
      document.getElementById('inventoryList').innerHTML = '';
      
      if(document.getElementById('totalValueDisplay')) {
        document.getElementById('totalValueDisplay').innerText = '₱0.00';
      }
      
      if(document.getElementById('userNameDisplay')) {
        document.getElementById('userNameDisplay').innerText = 'Farmer';
      }
      if(document.getElementById('userAvatarDisplay')) {
        document.getElementById('userAvatarDisplay').src = '';
      }

      // Destroy the chart so it doesn't glitch when the next person logs in
      if (AppState.inventory.chartInstance) {
        AppState.inventory.chartInstance.destroy(); AppState.inventory.chartInstance = null;
      }
      
      // Bring the auth screen back up
      const authScreen = document.getElementById('authScreen');
      if (authScreen) authScreen.classList.remove('hidden-auth');
      if (logoutBtn) logoutBtn.innerText = "🚪 Exit"; 
    }
  },

  // A neat little helper to handle those red/green error messages
  showMessage: function(msg, type) {
    const authMessage = document.getElementById('authMessage');
    if (!authMessage) return;
    
    authMessage.innerText = msg;
    if (type === "success") authMessage.style.color = "#2e7d32";
    else if (type === "error") authMessage.style.color = "#d32f2f";
    else authMessage.innerText = ""; 
  },
  // Add these INSIDE AuthController
  enforceRolePermissions: async function() {
    if (!supabaseClient || !supabaseClient.auth) return;
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return; 

    AppState.user.id = user.id;
    AppState.user.email = user.email; // Save for the logger!
    const { data } = await supabaseClient.from('user_profiles').select('role, employer_id').eq('id', user.id).single();
    const userRole = (data && data.role) ? data.role : 'free';

    AppState.user.ownerId = (data && data.employer_id) ? data.employer_id : user.id;

    if (userRole === 'worker') {
      document.body.classList.add('worker-mode');
      const previewBtn = document.getElementById('previewWorkerBtn');
      if (previewBtn) previewBtn.style.display = 'none';
      const headerTitle = document.querySelector('.app-header h1');
      if (headerTitle) headerTitle.innerText = "Unifarm Hub (Staff View)";
      
      const securityStyle = document.createElement('style');
      securityStyle.innerHTML = `body.worker-mode .opt-cost { visibility: hidden !important; pointer-events: none !important; } body.worker-mode #optFinalCost { display: none !important; }`;
      document.head.appendChild(securityStyle);

      document.querySelectorAll('div, a, button, li').forEach(el => {
          if (el.innerText && el.innerText.trim() === 'Settings') el.style.display = 'none';
      });
    }

    if (userRole === 'free') {
      const premiumMessage = `<div class="card" style="text-align: center; padding: 40px 20px; margin-top: 10px; border: 2px solid #fbc02d; background-color: #fffde7; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);"><div style="font-size: 3rem; margin-bottom: 10px;">⭐</div><h2 style="color: #f57f17; font-size: 1.8rem; margin-bottom: 15px;">Premium Feature Locked</h2><p style="margin-bottom: 25px; font-size: 1.1rem; color: #444; line-height: 1.6;">Our Advanced AI Optimizer and Formulator mathematically guarantee the cheapest possible feed while maximizing animal growth.<br><br><b>Stop guessing and start saving thousands of pesos per harvest.</b></p><button id="unlockProBtn" onclick="AuthController.startProUpgradeCheckout()" class="btn btn-warning" style="background-color: #f57f17; font-size: 1.2rem; padding: 15px; width: 90%; margin: 0 auto; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">Unlock Unifarm Hub Pro</button><p style="margin-top: 25px; color: #555; font-size: 0.95rem;">📞 Contact <b>Marcial Rey</b> to upgrade your license:<br><a href="tel:09495933239" style="color: #2e7d32; font-size: 1.3rem; font-weight: bold; text-decoration: none; display: inline-block; margin-top: 5px;">0949-593-3239</a></p></div>`;
      const formulatorView = document.getElementById('formulatorView');
      if (formulatorView) formulatorView.innerHTML = premiumMessage;
      const optimizerView = document.getElementById('optimizerView');
      if (optimizerView) optimizerView.innerHTML = premiumMessage;
    }
  },

  startProUpgradeCheckout: async function() {
    const btn = document.getElementById('unlockProBtn'); 
    const originalText = btn ? btn.innerText : "Unlock Unifarm Hub Pro";
    if (btn) btn.innerText = "⏳ Generating Secure Checkout...";

    try {
      const { data, error } = await supabaseClient.functions.invoke('create-paymongo-checkout', {
        body: { userId: AppState.user.id, email: AppState.user.email || "user@example.com" }
      });
      if (error) throw error;
      if (data && data.checkoutUrl) window.location.href = data.checkoutUrl; 
      else throw new Error("No checkout URL returned.");
    } catch (err) {
      console.error("Checkout Error:", err);
      alert("Failed to connect to payment gateway.");
      if (btn) btn.innerText = originalText;
    }
  }
};