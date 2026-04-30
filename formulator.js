import { AppState } from './state.js';
import { supabaseClient } from './db.js';
import { InventoryController } from './inventory.js';

export const FormulatorController = {
  init: function() {
    const addRowBtn = document.getElementById('addIngredientBtn');
    const calcBtn = document.getElementById('calculateFeedBtn');
    const deductBtn = document.getElementById('deductInventoryBtn');

    if (addRowBtn) addRowBtn.addEventListener('click', () => this.addRow());
    if (calcBtn) calcBtn.addEventListener('click', () => this.calculateMix());
    if (deductBtn) deductBtn.addEventListener('click', (e) => this.deductInventory(e.target));
  },

  addRow: function() {
    const list = document.getElementById('ingredientList');
    if (!list) return;

    const newRow = document.createElement('div');
    newRow.className = 'input-row ingredient-row dynamic-row'; 
    
    newRow.innerHTML = `
      <div class="input-group">
        <input type="text" class="ing-name" placeholder="Ingredient name" required>
      </div>
      <div class="input-group">
        <input type="number" class="ing-weight" placeholder="Weight (kg)" required>
      </div>
      <div class="input-group protein-input-group">
        <input type="number" class="ing-protein" placeholder="Protein (%)" required>
        <button type="button" class="remove-btn">X</button>
      </div>
    `;
    
    newRow.querySelector('.remove-btn').addEventListener('click', () => newRow.remove());
    list.appendChild(newRow);
  },

  calculateMix: function() {
    const rows = document.querySelectorAll('#ingredientList .ingredient-row');
    let totalWeight = 0;
    let totalProteinMass = 0;

    rows.forEach(row => {
      const weight = parseFloat(row.querySelector('.ing-weight').value) || 0;
      const proteinPercent = parseFloat(row.querySelector('.ing-protein').value) || 0;

      totalWeight += weight;
      totalProteinMass += weight * (proteinPercent / 100);
    });

    if (totalWeight === 0) {
      alert("Please enter at least one ingredient with a weight greater than 0.");
      return;
    }

    const finalProteinPercent = (totalProteinMass / totalWeight) * 100;

    document.getElementById('resultWeight').innerText = `${totalWeight.toFixed(2)} kg`;
    document.getElementById('resultProtein').innerText = `${finalProteinPercent.toFixed(2)}%`;
  },

  deductInventory: async function(btnElement) {
    const rows = document.querySelectorAll('#ingredientList .ingredient-row');
    let deductionSuccess = true;

    const originalText = btnElement.innerText;
    btnElement.innerText = "Processing...";

    for (const row of rows) {
      const name = row.querySelector('.ing-name').value.trim();
      const weightToDeduct = parseFloat(row.querySelector('.ing-weight').value) || 0;

      if (!name || weightToDeduct <= 0) continue;

      // 1. Search Supabase for this exact item name
      const { data, error } = await supabaseClient
        .from('inventory')
        .select('*')
        .ilike('name', name) 
        .maybeSingle(); 

      if (error || !data) {
        alert(`Could not find "${name}" in your inventory. Skipping this item.`);
        deductionSuccess = false;
        continue;
      }

      // 2. Check stock levels
      if (data.qty < weightToDeduct) {
        alert(`Not enough stock for "${name}". You need ${weightToDeduct}, but only have ${data.qty} left.`);
        deductionSuccess = false;
        continue;
      }

      // 3. Update Supabase
      const newQty = data.qty - weightToDeduct;
      const { error: updateError } = await supabaseClient
        .from('inventory')
        .update({ qty: newQty })
        .eq('name', data.name);

      if (updateError) {
        alert(`Failed to update database for "${name}". Reason: ${updateError.message}`);
        deductionSuccess = false;
      }
    }

    btnElement.innerText = originalText;
    
    if (deductionSuccess) {
      alert("Successfully deducted ingredients from your inventory!");
      // Call our new Inventory Controller to refresh the data!
      if (typeof InventoryController !== 'undefined') {
        InventoryController.fetchAndDisplay(); 
      }
    }
  }
};