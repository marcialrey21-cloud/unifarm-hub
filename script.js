import { AppState } from './state.js';
import { supabaseClient } from './db.js';
import { InventoryController } from './inventory.js';
import { OptimizerController } from './optimizer.js';
import { FormulatorController } from './formulator.js';
import { PredictorController } from './predictor.js';
import { AuthController } from './auth.js';
import { SettingsController } from './settings.js';
import { UIController } from './ui.js';
import { LoggerController } from './logger.js';
import { SimulatorController } from './simulator.js';
import { ScannerController } from './scanner.js';
import { MapController } from './map.js';
import { SubscriptionController } from './subscription.js';
import { SyncController } from './sync.js';
import { WeatherController } from './weather.js';
import { FCRController } from './fcr.js';
import { SandboxController } from './sandbox.js';

// --- 1. MASTER APP CONTROLLER ---
export const UnifarmApp = {
  init: async function() {
    // 1. Show splash screen immediately
    this.handleSplashScreen();
    
    // 2. Setup navigation buttons
    this.setupNavigation();
    
    // 3. Initialize Auth Controller (so the login buttons are ready)
    AuthController.init();
    
    // 4. Check if the user is already logged in BEFORE loading everything else
    await this.checkAuthStatus();
    // --> NEW: Check if they paid for premium!
    PremiumManager.checkAccess();
    
    // 5. Initialize the rest of the app's features in the background
    this.initializeModules();
  },    
    
  initializeModules: function() {
    // We moved these here so they don't block the login process
    InventoryController.init();
    OptimizerController.init();
    PredictorController.init();
    FormulatorController.init();
    SettingsController.init();
    UIController.init();
    SimulatorController.init();
    ScannerController.init();
    MapController.init();
    SubscriptionController.init();
    SyncController.init();
    WeatherController.init();
    FCRController.init();
    SandboxController.init();
  },

  handleSplashScreen: function() {
    const splash = document.getElementById('splashScreen');
    if (splash) {
      setTimeout(() => {
        splash.classList.add('hide-splash');
      }, 2000);
    }
  },

  checkAuthStatus: async function() {
    if (!supabaseClient || !supabaseClient.auth) return;
    
    const { data: { user } } = await supabaseClient.auth.getUser();
    const authScreen = document.getElementById('authScreen');
    
    if (user) {
      // User is logged in! Hide the auth screen and start their services.
      AppState.user.id = user.id;
      if (authScreen) authScreen.classList.add('hidden-auth');
      this.bootUserServices(user);
    } else {
      // No user. Show the login screen.
      if (authScreen) authScreen.classList.remove('hidden-auth');
    }
  },

  bootUserServices: function(user) {
    AuthController.enforceRolePermissions();
    WeatherController.init();
    FCRController.init();
    InventoryController.fetchAndDisplay(); 
    OptimizerController.fetchFeedMatrix();        
    LoggerController.fetchAndDisplayLogs();
    SettingsController.displayMatrixSettings();
    UIController.renderUserProfile(user);    
  },

  setupNavigation: function() {
    const bottomNavItems = document.querySelectorAll('.bottom-nav .nav-btn');
    const allPageSections = document.querySelectorAll('.page-section');

    // --- ENTERPRISE ARCHITECTURE: CONTEXT SWITCHER ---
    const operationSelector = document.getElementById('farmOperationSelector');
    const menuLivestock = document.getElementById('menuLivestock');
    const menuAgronomy = document.getElementById('menuAgronomy');

    if (operationSelector) {
        operationSelector.addEventListener('change', (e) => {
            const selectedValue = e.target.value;
            
            // If the user selects anything related to crops...
            if (selectedValue.includes('crops')) {
                menuLivestock.style.display = 'none';
                menuAgronomy.style.display = 'grid';
            } 
            // If the user selects livestock or poultry...
            else {
                menuLivestock.style.display = 'grid';
                menuAgronomy.style.display = 'none';
            }
            
            //console.log("Farm context switched to:", selectedValue);
        });
    }

    bottomNavItems.forEach(item => {
      item.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Remove active states from everyone
        bottomNavItems.forEach(nav => nav.classList.remove('active'));
        allPageSections.forEach(sec => {
            sec.classList.remove('active-section');
            sec.style.display = 'none';
        });

        // Activate the clicked one
        this.classList.add('active');
        const targetViewId = this.getAttribute('data-target');
        const targetView = document.getElementById(targetViewId);
        
        if (targetView) {
          targetView.style.display = 'block';
          targetView.classList.add('active-section');

          // Handle specific logic for Map or Scanner
          if (targetViewId === 'mapView') {
              MapController.init();
              MapController.fetchAndPlotScans();
          }
          if (targetViewId !== 'scannerView' && window.ScannerController) {
              window.ScannerController.stopCamera();
          }
        }
      });
    });
    // --- MAKE TOOL CARDS CLICKABLE ---
    const toolCards = document.querySelectorAll('.tool-card');
    toolCards.forEach(card => {
        card.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const targetView = document.getElementById(targetId);
            
            if (targetView) {
                // Hide all sections
                allPageSections.forEach(sec => {
                    sec.classList.remove('active-section');
                    sec.style.display = 'none';
                });
                
                // Show the clicked tool
                targetView.style.display = 'block';
                targetView.classList.add('active-section');
            }
        });
    });
  }  
};

export const PremiumManager = {
    checkAccess: async function() {
        const userId = window.AppState?.user?.id;
        
        // If they aren't logged in, they are basic
        if (!userId) {
            this.lockPremiumFeatures();
            return;
        }

        try {
            // Check the database for their plan
            const { data, error } = await supabaseClient
                .from('user_profiles')
                .select('plan')
                .eq('id', userId)
                .single();

            if (error) throw error;

            if (data && data.plan === 'Agri-Business Pro') {
                this.unlockPremiumFeatures();
            } else {
                this.lockPremiumFeatures();
            }
        } catch (error) {
            console.error("Error checking premium status:", error);
            this.lockPremiumFeatures(); // Default to locked on error
        }
    },

    unlockPremiumFeatures: function() {
        // console.log("🔓 Premium Access Granted!");
        // We will hide the upgrade banners and show the tools
        document.getElementById('btnUpgradePro').style.display = 'none';
        
        // Add visual cues for premium
        const header = document.querySelector('header');
        if(header) {
             header.style.borderBottom = "3px solid #f59e0b"; // Gold border for premium
        }
        
        // (You can add code here later to show the Formulator/Optimizer tabs if you hid them)
        alert("Welcome back, Pro Farmer! Your AI tools are unlocked.");
    },

    lockPremiumFeatures: function() {
        // console.log("🔒 Basic Access Only.");
        // Make sure the upgrade button is visible
        document.getElementById('btnUpgradePro').style.display = 'block';
    }
};
// Expose ALL controllers safely AFTER everything is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    window.UnifarmApp = UnifarmApp;
    window.SettingsController = SettingsController;
    window.UIController = UIController;
    window.AuthController = AuthController;
    window.OptimizerController = OptimizerController;
    window.LoggerController = LoggerController;
    window.SimulatorController = SimulatorController;
    window.ScannerController = ScannerController;
    window.MapController = MapController;
    window.SubscriptionController = SubscriptionController;
    window.SyncController = SyncController;
    window.PremiumManager = PremiumManager;
    window.FCRController = FCRController;
    window.AppState = AppState;

    if (window.AuthController && typeof window.AuthController.init === 'function') {
        window.AuthController.init();
    }
    // NEW: Wake up the dashboard and navigation buttons!
    if (window.UnifarmApp && typeof window.UnifarmApp.init === 'function') {
        window.UnifarmApp.init();
    }
    if (window.UIController && typeof window.UIController.init === 'function') {
        window.UIController.init();
    // --- DYNAMIC TOOL VISIBILITY LOGIC ---
    const operationSelector = document.getElementById('farmOperationSelector');

        if (operationSelector) {
        const updateToolVisibility = () => {
            // Get the exact value the user selected (e.g., 'poultry', 'swine', 'beef')
            const selectedValue = operationSelector.value; 

            // Find EVERY card in your HTML that has the class 'species-module'
            const allModules = document.querySelectorAll('.species-module');

            // Loop through them all and only show the one that perfectly matches
            allModules.forEach(module => {
                // This dynamically checks if the module ID matches the dropdown value + "Module"
                // Example: if dropdown is 'swine', it looks for an HTML id of 'swineModule'
                if (module.id === selectedValue + 'Module') {
                    module.style.display = 'block'; // Show the matching banner
                } else {
                    module.style.display = 'none';  // Hide all the others
                }
            });
        };

        // 1. Run it immediately when the dashboard loads
        updateToolVisibility();

        // 2. Listen for any future changes
        operationSelector.addEventListener('change', updateToolVisibility);
    }
}
// --- SWINE GROWTH CALCULATOR LOGIC ---
const calcSwineBtn = document.getElementById('calcSwineBtn');
        
if (calcSwineBtn) {
    calcSwineBtn.addEventListener('click', () => {
        // Gather inputs
        const currentWt = parseFloat(document.getElementById('swineCurrentWeight').value);
        const targetWt = parseFloat(document.getElementById('swineTargetWeight').value);
        const adg = parseFloat(document.getElementById('swineADG').value);
        const fcr = parseFloat(document.getElementById('swineFCR').value);

        // Safety check
        if (!currentWt || !targetWt || !adg || !fcr) {
            alert("Please fill in all Swine Predictor fields to calculate.");
            return;
        }

        // Math execution
        const weightToGain = targetWt - currentWt;
              
        if (weightToGain <= 0) {
            alert("Target weight must be greater than current weight!");
            return;
        }

        const daysToHarvest = Math.ceil(weightToGain / adg);
        const totalFeed = (weightToGain * fcr).toFixed(2);

        // Display results
        document.getElementById('swineResDays').innerText = daysToHarvest + " Days";
        document.getElementById('swineResFeed').innerText = totalFeed + " kg";
                
        const resultBox = document.getElementById('swineResultBox');
        resultBox.style.display = 'block';
                
        // Scroll into view
        resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
}
// --- BEEF CATTLE CALCULATOR LOGIC ---
const calcBeefBtn = document.getElementById('calcBeefBtn');
if (calcBeefBtn) {
    calcBeefBtn.addEventListener('click', () => {
        const currentWt = parseFloat(document.getElementById('beefCurrentWeight').value);
        const targetWt = parseFloat(document.getElementById('beefTargetWeight').value);
        const adg = parseFloat(document.getElementById('beefADG').value);
        const fcr = parseFloat(document.getElementById('beefFCR').value);

        if (!currentWt || !targetWt || !adg || !fcr) {
            alert("Please fill in all Beef Predictor fields to calculate.");
            return;
        }

        const weightToGain = targetWt - currentWt;
        if (weightToGain <= 0) {
            alert("Target weight must be greater than current weight!");
            return;
        }

        const daysToHarvest = Math.ceil(weightToGain / adg);
        const totalFeed = (weightToGain * fcr).toFixed(2);
        
        document.getElementById('beefResDays').innerText = daysToHarvest + " Days";
        document.getElementById('beefResFeed').innerText = totalFeed + " kg";
                
        const resultBox = document.getElementById('beefResultBox');
        resultBox.style.display = 'block';
        resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
}

// --- GOATS & SHEEP CALCULATOR LOGIC ---
const calcGoatsBtn = document.getElementById('calcGoatsBtn');
if (calcGoatsBtn) {
    calcGoatsBtn.addEventListener('click', () => {
        const currentWt = parseFloat(document.getElementById('goatsCurrentWeight').value);
        const targetWt = parseFloat(document.getElementById('goatsTargetWeight').value);
        const adg = parseFloat(document.getElementById('goatsADG').value);
        const fcr = parseFloat(document.getElementById('goatsFCR').value);

        if (!currentWt || !targetWt || !adg || !fcr) {
            alert("Please fill in all Small Ruminant fields to calculate.");
            return;
        }

        const weightToGain = targetWt - currentWt;
        if (weightToGain <= 0) {
            alert("Target weight must be greater than current weight!");
            return;
        }

        const daysToHarvest = Math.ceil(weightToGain / adg);
        const totalFeed = (weightToGain * fcr).toFixed(2);

        document.getElementById('goatsResDays').innerText = daysToHarvest + " Days";
        document.getElementById('goatsResFeed').innerText = totalFeed + " kg";
                
        const resultBox = document.getElementById('goatsResultBox');
        resultBox.style.display = 'block';
        resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
}

});    