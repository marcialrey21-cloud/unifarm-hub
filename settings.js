import { AppState } from './state.js';
import { supabaseClient } from './db.js';
import { UIController } from './ui.js';
import { Utils } from './utils.js';
// --- ⚙️ UNIFARM SETTINGS & SYNC CONTROLLER ---
export const SettingsController = {
  init: function() {
    // 1. Setup Offline/Online Listeners
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // 2. Wire up the Matrix Form
    const matrixForm = document.getElementById('matrixForm');
    if (matrixForm) {
      matrixForm.addEventListener('submit', (e) => this.handleMatrixSubmit(e));
    }

    // 3. Connect to the existing global fetch system
    window.displayMatrixSettings = () => this.displayMatrixSettings();

    // 4. Check for offline data waiting to be synced on load
    this.pushOfflineQueueToCloud();
  },

  handleOnline: function() {
    const header = document.querySelector('.app-header');
    const title = document.querySelector('.app-header h1');
    if (header && title) {
      header.style.backgroundColor = '#2e7d32'; // Success Green
      title.innerText = "Unifarm Hub";
    }
    this.pushOfflineQueueToCloud(); 
  },

  handleOffline: function() {
    const header = document.querySelector('.app-header');
    const title = document.querySelector('.app-header h1');
    if (header && title) {
      header.style.transition = "background-color 0.5s";
      header.style.backgroundColor = '#f57f17'; // Warning Orange
      title.innerText = "Unifarm Hub (Offline Mode - Saving Locally)";
    }
  },

  pushOfflineQueueToCloud: async function() {
    if (!navigator.onLine) return; 

    const queue = JSON.parse(localStorage.getItem('unifarm_offline_queue') || '[]');
    
    if (queue.length > 0) {
      console.log(`Found ${queue.length} items waiting in the offline queue. Syncing...`);
      
      const { error } = await supabaseClient.from('feed_matrix').upsert(queue);
      
      if (!error) {
        localStorage.removeItem('unifarm_offline_queue'); // Clear the local cache
        alert("✅ Internet connection detected. Offline data successfully synced to the cloud!");
        if (typeof fetchFeedMatrix === 'function') fetchFeedMatrix(); 
      } else {
        console.error("Failed to sync offline data:", error);
      }
    }
  },

  handleMatrixSubmit: async function(e) {
    e.preventDefault();

    const currentUserId = AppState.user.id;
    if (!currentUserId) {
      alert("Security Error: Could not find your ID. Please refresh the page while online.");
      return;
    }

    const newIngredient = {
      name: document.getElementById('matName').value.toLowerCase().trim(),
      cost: parseFloat(document.getElementById('matCost').value) || 0,
      protein: parseFloat(document.getElementById('matProtein').value) || 0,
      energy: parseFloat(document.getElementById('matEnergy').value) || 0,
      calcium: parseFloat(document.getElementById('matCalcium').value) || 0,
      phosphorus: parseFloat(document.getElementById('matPhos').value) || 0,
      lysine: parseFloat(document.getElementById('matLysine').value) || 0,
      methionine: parseFloat(document.getElementById('matMeth').value) || 0,
      fiber: parseFloat(document.getElementById('matFiber').value) || 0,
      max_percent: parseFloat(document.getElementById('matMax').value) || 100,
      owner_id: currentUserId 
    };

    const formEl = e.target;
    const btn = formEl.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerText = "Saving...";

    // Try to save to the cloud first
    const { error } = await supabaseClient.from('feed_matrix').upsert([newIngredient]);
    btn.innerText = originalText;

    // The Bulletproof Fallback
    if (!navigator.onLine || (error && error.message.includes('fetch'))) {
      let queue = JSON.parse(localStorage.getItem('unifarm_offline_queue') || '[]');
      queue.push(newIngredient);
      localStorage.setItem('unifarm_offline_queue', JSON.stringify(queue));
      
      alert(`📵 No Signal! "${newIngredient.name}" saved to your phone. It will upload automatically when you get a signal.`);
      formEl.reset();
      return; 
    }

    if (error) {
      UIController.showToast("Error saving to database: " + error.message, 'error');
    } else {
      // Trigger the sleek success toast!
      UIController.showToast(`Saved "${newIngredient.name}" to your Dictionary!`, 'success');
      formEl.reset();            
      if (typeof fetchFeedMatrix === 'function') fetchFeedMatrix();
      this.displayMatrixSettings();
    }
  },

  openLimitsModal: function(ingredientName) {
    const item = AppState.optimizer.matrix[ingredientName];
    if (!item) return;

    document.getElementById('modalIngredientName').innerText = `Limits: ${item.name.toUpperCase()}`;
    AppState.optimizer.editingIngredient = item.name;

    // Load existing limits or default to blank
    const limits = item.inclusion_limits || {};
    document.getElementById('limDefault').value = limits['default'] || item.max_percent || 100;
    document.getElementById('limBroilerStarter').value = limits['broiler_starter'] || '';
    document.getElementById('limBroilerFinisher').value = limits['broiler_finisher'] || '';
    document.getElementById('limLayerPeak').value = limits['layer_peak'] || '';
    document.getElementById('limSwineStarter').value = limits['swine_starter'] || '';
    document.getElementById('limSwineFinisher').value = limits['swine_finisher'] || '';

    document.getElementById('limitsModal').style.display = 'flex';
  },

  saveAdvancedLimits: async function() {
    const ingredientName = AppState.optimizer.editingIngredient;
    if (!ingredientName) return;

    // Build the JSON dictionary from the inputs
    const newLimits = {
      default: parseFloat(document.getElementById('limDefault').value) || 100,
      broiler_starter: parseFloat(document.getElementById('limBroilerStarter').value) || null,
      broiler_finisher: parseFloat(document.getElementById('limBroilerFinisher').value) || null,
      layer_peak: parseFloat(document.getElementById('limLayerPeak').value) || null,
      swine_starter: parseFloat(document.getElementById('limSwineStarter').value) || null,
      swine_finisher: parseFloat(document.getElementById('limSwineFinisher').value) || null
    };

    // Remove empty null values to keep the database clean
    Object.keys(newLimits).forEach(key => newLimits[key] == null && delete newLimits[key]);

    // Save to Supabase (Removed the strict owner check, relying safely on DB RLS)
    document.getElementById('saveLimitsBtn').innerText = 'Saving...';
    
    const { error } = await supabaseClient.from('feed_matrix')
      .update({ inclusion_limits: newLimits })
      .eq('name', ingredientName);

    if (error) {
      alert("Database Error: Could not save limits. Check console.");
      console.error(error);
    }

    document.getElementById('saveLimitsBtn').innerText = 'Save Limits';
    document.getElementById('limitsModal').style.display = 'none';
    window.fetchFeedMatrix(); // Refresh the data!
  },

  displayMatrixSettings: async function() {
    const container = document.getElementById('matrixDisplayList');
    if (!container) return; 
    
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return; 

    const { data, error } = await supabaseClient
      .from('feed_matrix')
      .select('*')
      .or(`owner_id.is.null,owner_id.eq.${user.id}`);

    if (error || !data) {
      container.innerHTML = '<p class="warning-text">Failed to load database.</p>';
      return;
    }

    let html = `
      <div class="opt-grid-row header-row" style="border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 10px;">
        <div style="text-align: left;">Name</div>
        <div>Cost</div><div>CP%</div><div>Energy</div><div>Ca%</div><div>Phos%</div><div>Lys%</div><div>Meth%</div><div>Fiber%</div><div>Max%</div><div>Action</div>
      </div>
    `;

    data.forEach(item => {
      // Sanitize the name before using it
      const safeName = Utils.escapeHTML(item.name);
      const displayName = safeName.charAt(0).toUpperCase() + safeName.slice(1);
      
      html += `
        <div class="opt-grid-row" style="border-bottom: 1px solid #f1f5f9; padding: 8px 0; font-size: 14px;">
          <div style="font-weight: bold; text-align: left;">${displayName}</div>
          <div>₱${item.cost}</div>
          <div>${item.protein}%</div>
          <div>${item.energy}</div>
          <div>${item.calcium}%</div>
          <div>${item.phosphorus || 0}%</div>
          <div>${item.lysine || 0}%</div>
          <div>${item.methionine || 0}%</div>
          <div>${item.fiber || 0}%</div>
          <div>${item.max_percent || 100}%</div>
          <div style="display:flex; gap:5px;">
            <button class="limit-btn" onclick="SettingsController.openLimitsModal('${safeName}')" style="background:#fbc02d; color:#000; border:none; border-radius:4px; cursor:pointer; padding:2px 8px; font-weight:bold;">⚙️ Limits</button>
            <button class="remove-btn delete-matrix-btn" data-name="${safeName}" style="background:#e53e3e; color:#fff; border:none; border-radius:4px; cursor:pointer; padding:2px 8px; font-weight:bold;">X</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Attach Delete Logic
    document.querySelectorAll('.delete-matrix-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const nameToDel = e.target.getAttribute('data-name');
        if(confirm(`Are you sure you want to permanently delete "${nameToDel}" from the database?`)) {
          await supabaseClient.from('feed_matrix').delete().eq('name', nameToDel);
          if (typeof fetchFeedMatrix === 'function') fetchFeedMatrix();       
          this.displayMatrixSettings(); 
        }
      });
    });
  }
};