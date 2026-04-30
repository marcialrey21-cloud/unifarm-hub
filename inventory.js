// inventory.js
import { Utils } from './utils.js';
import { AppState } from './state.js';
import { AppConfig, supabaseClient } from './db.js';

// --- 📦 UNIFARM INVENTORY CONTROLLER ---
export const InventoryController = {
  init: function() {
    // Wire up the "Add Batch" form to our new save function
    const addBatchForm = document.getElementById('addBatchForm');
    if (addBatchForm) {
      addBatchForm.addEventListener('submit', (e) => this.handleAddBatch(e));
    }
  },

  fetchAndDisplay: async function() {
    const listContainer = document.getElementById('inventoryList');
    if (!listContainer) return;

    const { data, error } = await supabaseClient.from('inventory').select('*');

    if (error) {
      console.error("Error fetching from cloud:", error);
      return;
    }

    let totalAssets = 0;
    let chartLabels = [];
    let chartValues = [];
    let chartColors = [];
    
    // Fallback just in case AppConfig palette is missing
    const colorPalette = (typeof AppConfig !== 'undefined' && AppConfig.chartPalette) 
      ? AppConfig.chartPalette 
      : ['#2e7d32', '#4caf50', '#81c784', '#c8e6c9', '#fbc02d', '#f57f17'];

    if (!data || data.length === 0) {
      listContainer.innerHTML = '<p class="empty-msg">No items yet.</p>';
      if(document.getElementById('totalValueDisplay')) document.getElementById('totalValueDisplay').innerText = '₱0.00';
      this.updateChart([], [], []); 
      return;
    }

    listContainer.innerHTML = '';
    const dropdown = document.getElementById('predictItemSelect');
    if (dropdown) dropdown.innerHTML = '<option value="">-- Choose an item --</option>';

    data.forEach((item, index) => {
      const itemTotal = parseFloat(item.qty) * parseFloat(item.cost);
      
      // 1. Sanitize all user-provided data
      const safeName = Utils.escapeHTML(item.name);
      const safeUnit = Utils.escapeHTML(item.unit);
      const safeQty = Utils.escapeHTML(item.qty); 
      const safeCost = Utils.escapeHTML(item.cost);

      if(!isNaN(itemTotal)) {
        totalAssets += itemTotal;
        chartLabels.push(item.name); 
        chartValues.push(itemTotal);
        chartColors.push(colorPalette[index % colorPalette.length]);
      }

      let alertBadge = '';
      let stockStyle = 'color: #555;'; 

      if (parseFloat(item.qty) <= 5) {
        alertBadge = '<span class="warning-badge">⚠️ Low Stock</span>';
        stockStyle = 'color: #dc3545; font-weight: bold;'; 
      }

      const itemElement = document.createElement('div');
      itemElement.className = 'inventory-item'; 
      
      itemElement.innerHTML = `
        <div>
          <strong style="font-size: 16px;">${safeName}</strong> ${alertBadge}<br>
          <span style="font-size: 13px; ${stockStyle}">
            ${safeQty} ${safeUnit} 
            <span class="financial-data">| Cost: ₱${safeCost}</span> 
          </span>
        </div>
        <button class="delete-btn worker-restricted" data-id="${item.id}" data-name="${safeName}">Delete</button>
      `;

      // Wire up the delete button securely
      itemElement.querySelector('.delete-btn').addEventListener('click', (e) => this.handleDelete(e));

      if (dropdown) {
        const option = document.createElement('option');
        option.value = safeName;
        option.textContent = `${safeName} (${safeQty} ${safeUnit} left)`;
        dropdown.appendChild(option);
      }

      listContainer.appendChild(itemElement);
    });

    const valueDisplay = document.getElementById('totalValueDisplay');
    if (valueDisplay) {
       valueDisplay.innerText = `₱${totalAssets.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }

    this.updateChart(chartLabels, chartValues, chartColors);
  },

  handleAddBatch: async function(event) {
    event.preventDefault();
    const btn = event.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerText = "Saving...";

    const itemName = document.getElementById('itemName').value;
    const quantity = document.getElementById('quantity').value;
    const unit = document.getElementById('unit').value;
    const cost = document.getElementById('cost').value;

    const currentUserId = AppState.user.id;

    if (!currentUserId) {
      alert("You must be logged in to save data. Please refresh while online.");
      btn.innerText = originalText;
      return;
    }

    const newBatch = { 
      name: itemName, 
      qty: parseFloat(quantity), 
      unit: unit, 
      cost: parseFloat(cost),
      user_id: AppState.user.ownerId 
    };

    const { error } = await supabaseClient.from('inventory').insert([newBatch]);
    btn.innerText = originalText;

    if (error) {
      UIController.showToast("Error saving to cloud: " + error.message, 'error');
    } else {
      event.target.reset();
      this.fetchAndDisplay();
      if(typeof logActivity === 'function') logActivity('ADDED', `${quantity} ${unit} of ${itemName} (Cost: ₱${cost})`);
      
      UIController.showToast(`Successfully added ${itemName} to inventory!`, 'success');
    }
  },

  handleDelete: async function(event) {
     const btn = event.target;
     const itemIdToDel = btn.getAttribute('data-id'); 
     const itemNameToDel = btn.getAttribute('data-name'); 

     if(confirm(`Delete this batch of ${itemNameToDel} from inventory?`)) {
         const { error } = await supabaseClient.from('inventory').delete().eq('id', itemIdToDel);
         if (!error) {
            this.fetchAndDisplay();
            if(typeof logActivity === 'function') logActivity('DELETED', `Removed a batch of ${itemNameToDel}`); 
         } else {
            alert("Failed to delete: " + error.message);
         }
     }
  },

  // 🤖 AI/AUTOMATION HOOK: Deduct stock programmatically
  deductStock: async function(searchKeyword, amountToDeduct) {
    try {
      // 🟢 THE FIX: Strip away any periods, commas, and extra spaces the AI might have added
      const cleanKeyword = searchKeyword.replace(/[.,]/g, '').trim();
      
      console.log(`Smart Search looking for: "${cleanKeyword}"`);

      // 1. Search the cloud database for an item matching the cleaned keyword
      const { data, error } = await supabaseClient
        .from('inventory')
        .select('*')
        .ilike('name', `%${cleanKeyword}%`) 
        .gt('qty', 0) 
        .order('qty', { ascending: false }) 
        .limit(1);
        
      if (error) throw error;

      if (!data || data.length === 0) {
        alert(`Inventory Alert: Could not find any "${cleanKeyword}" in the warehouse. Please ensure it is added to your Inventory tab!`);
        return false;
      }

      const item = data[0];
      const currentQty = parseFloat(item.qty);

      if (currentQty < amountToDeduct) {
        alert(`Low Stock Alert: Not enough ${item.name} in stock! You need ${amountToDeduct}, but only have ${currentQty} ${item.unit} left.`);
        return false;
      }

      // 2. Calculate the new quantity
      const newQty = currentQty - amountToDeduct;

      // 3. Update the cloud database
      const { error: updateError } = await supabaseClient
        .from('inventory')
        .update({ qty: newQty })
        .eq('id', item.id);

      if (updateError) throw updateError;

      // 4. Refresh the Inventory UI and show a success message
      this.fetchAndDisplay();
      if (typeof logActivity === 'function') {
        logActivity('AUTO-DEDUCT', `AI Scanner applied ${amountToDeduct} ${item.unit} of ${item.name}`);
      }
      if (typeof UIController !== 'undefined' && UIController.showToast) {
        UIController.showToast(`Auto-Deducted ${amountToDeduct} ${item.unit} of ${item.name}`, 'success');
      } else {
        alert(`Success: Deducted ${amountToDeduct} ${item.unit} of ${item.name}.`);
      }

      return true;

    } catch (err) {
      console.error("Failed to auto-deduct inventory:", err);
      return false;
    }
  },

  updateChart: function(labels, dataValues, colors) {
    const ctx = document.getElementById('inventoryChart');
    if (!ctx) return; 

    if (AppState.inventory.chartInstance) {
      AppState.inventory.chartInstance.destroy();
    }

    if (labels.length === 0) return; 

    AppState.inventory.chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: dataValues,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { font: { family: "sans-serif" }, usePointStyle: true } },
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.label || '';
                if (label) label += ': ';
                if (context.parsed !== null) {
                  label += new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(context.parsed);
                }
                return label;
              }
            }
          }
        },
        cutout: '65%' 
      }
    });
  }
};