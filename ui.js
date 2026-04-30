import { AppState } from './state.js';
import { supabaseClient } from './db.js';
import { SettingsController } from './settings.js';
import { PredictorController } from './predictor.js';
import { AuthController } from './auth.js';

export const UIController = {
  init: function() {
    this.setupToastContainer();
    // 1. Worker Preview Toggle
    const previewWorkerBtn = document.getElementById('previewWorkerBtn');
    if (previewWorkerBtn) {
      previewWorkerBtn.addEventListener('click', function() {
        document.body.classList.toggle('worker-mode');
        if (document.body.classList.contains('worker-mode')) {
          this.innerText = "👨‍🌾 Worker";
          this.classList.add('worker-active');
        } else {
          this.innerText = "👁️ Preview";
          this.classList.remove('worker-active');
        }
      });
    }

    // 2. CSV Export
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', (e) => this.exportInventoryCSV(e.target));

    // 3. Global Species Context Engine
    window.unifarm_species_context = 'poultry'; 
    const speciesSelector = document.getElementById('speciesSelector');
    if (speciesSelector) speciesSelector.addEventListener('change', (e) => this.switchSpeciesContext(e.target.value));

    // 4. Optimizer Auto-Fill Magic
    const optList = document.getElementById('optIngredientList');
    if (optList) optList.addEventListener('input', (e) => this.handleOptimizerAutofill(e));

    // 5. Auth State Listener
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') AuthController.enforceRolePermissions();
    });

    // 6. Profile Avatar Upload Listener
    const avatarImg = document.getElementById('userAvatarDisplay');
    const avatarInput = document.getElementById('avatarUploadInput');
    if (avatarImg && avatarInput) {
      avatarImg.addEventListener('click', () => avatarInput.click());
      avatarInput.addEventListener('change', (e) => this.handleAvatarUpload(e));
    }

    // 7. Limits Modal Listeners
    const saveLimBtn = document.getElementById('saveLimitsBtn');
    const closeLimBtn = document.getElementById('closeLimitsBtn');
    if (saveLimBtn) saveLimBtn.addEventListener('click', () => SettingsController.saveAdvancedLimits());
    if (closeLimBtn) closeLimBtn.addEventListener('click', () => document.getElementById('limitsModal').style.display = 'none');

    // 8. Target Preset Change Listener
    const presetSelector = document.getElementById('optAnimalCategory');
    if (presetSelector) {
      presetSelector.addEventListener('change', () => {
        // 🟢 Instantly update max limits when the animal dropdown changes!
        if (typeof window.syncOptimizerLimits === 'function') {
          window.syncOptimizerLimits(); 
        }
      });
    }

    // 9. Optimizer PDF Download Listener
    const mixPdfBtn = document.getElementById('downloadMixPdfBtn');
    if (mixPdfBtn) {
      mixPdfBtn.addEventListener('click', () => {
        if (typeof window.downloadMixSheetPDF === 'function') {
          window.downloadMixSheetPDF();
        }
      });
    }

    // 10. Inventory Depletion Listener
    const deductBtn = document.getElementById('deductInventoryBtn');
    if (deductBtn) {
      deductBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to mix this batch and permanently deduct these items from your inventory?")) {
          if (typeof window.mixBatchAndUpdateInventory === 'function') {
            window.mixBatchAndUpdateInventory();
          }
        }
      });
    }
  },

  // --- 🍞 TOAST NOTIFICATION SYSTEM ---
  setupToastContainer: function() {
    // Inject the container safely if it doesn't exist yet
    if (!document.getElementById('unifarm-toast-container')) {
      const container = document.createElement('div');
      container.id = 'unifarm-toast-container';
      // Inline styling so it floats perfectly in the bottom right corner
      container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px; pointer-events: none;';
      document.body.appendChild(container);
    }
  },

  showToast: function(message, type = 'info') {
    const container = document.getElementById('unifarm-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    
    // Assign colors and icons based on the type of message
    let bgColor = '#333';
    let icon = 'ℹ️';
    if (type === 'success') { bgColor = '#2e7d32'; icon = '✅'; }
    if (type === 'error') { bgColor = '#d32f2f'; icon = '❌'; }
    if (type === 'warning') { bgColor = '#f57f17'; icon = '⚠️'; }

    // Style the individual toast card
    toast.style.cssText = `background-color: ${bgColor}; color: white; padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); font-family: sans-serif; font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 10px; opacity: 0; transform: translateY(20px); transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); pointer-events: auto; max-width: 300px; line-height: 1.4;`;
    toast.innerHTML = `<span style="font-size: 18px;">${icon}</span> <span>${message}</span>`;

    container.appendChild(toast);

    // Trigger the slide-in animation
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    // Automatically dismiss and remove it after 3.5 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => toast.remove(), 300); // Wait for fade out before deleting
    }, 3500);
  },

  renderUserProfile: function(user) {
    const nameDisplay = document.getElementById('userNameDisplay');
    const avatarDisplay = document.getElementById('userAvatarDisplay');
    if (!user) return;

    let displayName = "Farmer";
    if (user.email) {
      displayName = user.email.split('@')[0]; 
      displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
    }

    if (nameDisplay) nameDisplay.innerText = displayName;

    if (avatarDisplay) {
      // 🟢 Check the device's memory for a saved photo for THIS specific user
      const savedAvatar = localStorage.getItem(`unifarm_avatar_${user.id}`);
      
      if (savedAvatar) {
        avatarDisplay.src = savedAvatar; // Display the custom photo!
      } else {
        // Fallback to the initials if they haven't uploaded one yet
        avatarDisplay.src = `https://ui-avatars.com/api/?name=${displayName}&background=fbc02d&color=1b5e20&rounded=true&bold=true&size=128`;
      }
    }
  },

  handleAvatarUpload: function(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Convert the image into a Base64 string so it can be saved in LocalStorage
    const reader = new FileReader();
    reader.onload = function(e) {
      const base64Image = e.target.result;
      
      // 1. Instantly show the new image on the screen
      document.getElementById('userAvatarDisplay').src = base64Image;
      
      // 2. Save it to the browser's memory so it stays there after refreshing!
      if (AppState.user.id) {
        localStorage.setItem(`unifarm_avatar_${AppState.user.id}`, base64Image);
      }
    };
    reader.readAsDataURL(file);
  },  

  exportInventoryCSV: async function(btn) {
    const originalText = btn.innerText;
    btn.innerText = "⏳ Generating Report...";
    const { data, error } = await supabaseClient.from('inventory').select('*').order('name'); 

    if (error || !data || data.length === 0) {
      alert(error ? "Error fetching data: " + error.message : "Your inventory is currently empty.");
      btn.innerText = originalText;
      return;
    }

    let csvContent = "Item Name,Quantity,Unit,Cost per Unit (PHP),Total Value (PHP)\n";
    data.forEach(item => {
      const totalValue = item.qty * item.cost;
      csvContent += `"${item.name}",${item.qty},"${item.unit}",${item.cost},${totalValue}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `Unifarm_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    btn.innerText = originalText;
  },

  switchSpeciesContext: function(species) {
    window.unifarm_species_context = species;
    document.querySelectorAll('.species-module').forEach(m => m.style.display = 'none');
    document.querySelectorAll(`.${species}-view`).forEach(m => m.style.display = 'block');

    const titleEl = document.getElementById('dynamicGrowthTitle');
    const adgEl = document.getElementById('adg');
    const fcrEl = document.getElementById('fcr');
    const animalTypeEl = document.getElementById('animalType'); 
    const bannerEl = document.getElementById('dynamicBannerImage');

    const defaults = (typeof PredictorController !== 'undefined') ? PredictorController.animalDefaults[species] : null;

    const config = {
      'poultry': { title: "📈 Poultry Growth Predictor", banner: "poultry-banner.jpg", type: "broiler" },
      'swine':   { title: "🐷 Swine Fattening Predictor", banner: "swine-banner.jpg", type: "swine" },
      'beef':    { title: "🐂 Beef Cattle Fattening", banner: "beef-banner.jpg", type: "beef" },
      'goat':    { title: "🐐 Goat & Sheep Fattening", banner: "goat-banner.jpg", type: "goat" },
      'dairy':   { title: "🥛 Dairy Production Estimator", banner: "dairy-banner.jpg", type: "dairy" }
    };

    if (config[species]) {
      if(titleEl) titleEl.innerText = config[species].title;
      if(bannerEl) bannerEl.src = config[species].banner;
      if(animalTypeEl) animalTypeEl.value = config[species].type;
      
      if (defaults) {
        if(adgEl && defaults.adg !== undefined) adgEl.value = defaults.adg;
        if(fcrEl && defaults.fcr !== undefined) fcrEl.value = defaults.fcr;
      }
    }
  },

  handleOptimizerAutofill: function(event) {
    if (event.target.classList.contains('opt-name')) {
      const ingredientName = event.target.value.toLowerCase().trim();
      if (AppState.optimizer.matrix && AppState.optimizer.matrix[ingredientName]) {
        const row = event.target.closest('.opt-ingredient-row');
        const data = AppState.optimizer.matrix[ingredientName];
        
        row.querySelector('.opt-cost').value = data.cost;
        row.querySelector('.opt-protein').value = data.protein;
        row.querySelector('.opt-energy').value = data.energy;
        row.querySelector('.opt-calcium').value = data.calcium;
        row.querySelector('.opt-lysine').value = data.lysine;
        row.querySelector('.opt-phos').value = data.phos || 0;
        row.querySelector('.opt-meth').value = data.meth || 0;
        row.querySelector('.opt-fiber').value = data.fiber || 0;
        // 🟢 SMART CONTEXTUAL LIMITS ENGINE
        const selector = document.getElementById('optAnimalCategory');
        const currentTarget = selector.options[selector.selectedIndex].text.toLowerCase();
        const limits = data.inclusion_limits || {};
        let finalMax = limits['default'] || data.max_percent || 100;

        // Check if the current dropdown target matches any of our specific rules!
        if (currentTarget.includes('broiler') && currentTarget.includes('starter') && limits['broiler_starter']) {
          finalMax = limits['broiler_starter'];
        } else if (currentTarget.includes('broiler') && currentTarget.includes('finisher') && limits['broiler_finisher']) {
          finalMax = limits['broiler_finisher'];
        } else if (currentTarget.includes('layer') && limits['layer_peak']) {
          finalMax = limits['layer_peak'];
        } else if (currentTarget.includes('swine') && currentTarget.includes('starter') && limits['swine_starter']) {
          finalMax = limits['swine_starter'];
        } else if (currentTarget.includes('swine') && currentTarget.includes('finisher') && limits['swine_finisher']) {
          finalMax = limits['swine_finisher'];
        }

        row.querySelector('.opt-max').value = finalMax;
        
        row.style.transition = "background-color 0.5s";
        row.style.backgroundColor = "#e8f5e9";
        setTimeout(() => row.style.backgroundColor = "transparent", 800);
      }
    }
  }
};