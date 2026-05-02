import { AppState } from './state.js';
import { supabaseClient } from './db.js';
import { SettingsController } from './settings.js';
import { InventoryController } from './inventory.js'; // Added this so it can update the inventory!

// --- ⚡ UNIFARM OPTIMIZER CONTROLLER ---
export const OptimizerController = {
  // Industry-standard baseline targets for Phase Feeding
  speciesProfiles: {
    'broiler_starter':  { cp: 22, energy: 3000, ca: 1.00, phos: 0.45, lys: 1.20, meth: 0.50, fiber: 4.0 },
    'broiler_grower':   { cp: 20, energy: 3100, ca: 0.90, phos: 0.40, lys: 1.05, meth: 0.45, fiber: 5.0 },
    'broiler_finisher': { cp: 18, energy: 3200, ca: 0.85, phos: 0.38, lys: 0.95, meth: 0.40, fiber: 5.0 },
    'layer_pullet':     { cp: 15, energy: 2750, ca: 1.00, phos: 0.40, lys: 0.70, meth: 0.30, fiber: 6.0 },
    'layer_peak':       { cp: 17, energy: 2800, ca: 4.00, phos: 0.45, lys: 0.85, meth: 0.40, fiber: 5.0 },
    'swine_starter':    { cp: 20, energy: 3250, ca: 0.85, phos: 0.45, lys: 1.30, meth: 0.35, fiber: 4.0 },
    'swine_grower':     { cp: 16, energy: 3100, ca: 0.75, phos: 0.35, lys: 0.95, meth: 0.28, fiber: 5.0 },
    'swine_finisher':   { cp: 14, energy: 3100, ca: 0.65, phos: 0.30, lys: 0.75, meth: 0.22, fiber: 6.0 }
  },

  init: function() {
    const animalCategory = document.getElementById('optAnimalCategory');
    const addRowBtn = document.getElementById('optAddRowBtn');
    const optimizeBtn = document.getElementById('optimizeBtn');
    const exportBtn = document.getElementById('exportToFormulatorBtn');

    if (animalCategory) animalCategory.addEventListener('change', (e) => this.handleSpeciesChange(e.target));
    if (addRowBtn) addRowBtn.addEventListener('click', () => this.addIngredientRow());
    if (optimizeBtn) optimizeBtn.addEventListener('click', () => this.runSolverMath());
    if (exportBtn) exportBtn.addEventListener('click', () => this.exportToManual());
  },

  handleSpeciesChange: function(dropdown) {
    const selectedType = dropdown.value;
    if (selectedType !== 'custom' && this.speciesProfiles[selectedType]) {
      const profile = this.speciesProfiles[selectedType];
      
      document.getElementById('optTargetProtein').value = profile.cp;
      document.getElementById('optTargetEnergy').value = profile.energy;
      document.getElementById('optTargetCalcium').value = profile.ca;
      document.getElementById('optTargetPhos').value = profile.phos;
      document.getElementById('optTargetLysine').value = profile.lys;
      document.getElementById('optTargetMeth').value = profile.meth;
      document.getElementById('optTargetFiber').value = profile.fiber;
      
      // Flash green to show auto-fill success
      document.querySelectorAll('.opt-grid input:not(#optTargetWeight)').forEach(input => {
        input.style.transition = "background-color 0.4s";
        input.style.backgroundColor = "#e8f5e9";
        setTimeout(() => input.style.backgroundColor = "transparent", 600);
      });
    }
  },

  addIngredientRow: function() {
    const list = document.getElementById('optIngredientList');
    const newRow = document.createElement('div');
    newRow.className = 'opt-grid-row opt-ingredient-row dynamic-row'; 
    newRow.innerHTML = `
      <input type="text" class="opt-name form-control" placeholder="Name">
      <input type="number" class="opt-cost form-control" placeholder="Cost">
      <input type="number" class="opt-protein form-control" placeholder="CP %">
      <input type="number" class="opt-energy form-control" placeholder="kcal">
      <input type="number" class="opt-calcium form-control" placeholder="Ca %">
      <input type="number" class="opt-phos form-control" placeholder="Phos %">
      <input type="number" class="opt-lysine form-control" placeholder="Lys %">
      <input type="number" class="opt-meth form-control" placeholder="Meth %">
      <input type="number" class="opt-fiber form-control" placeholder="Fiber %">
      <input type="number" class="opt-max form-control" placeholder="Max %">
      <button type="button" class="remove-btn">X</button>
    `;
    newRow.querySelector('.remove-btn').addEventListener('click', () => newRow.remove());
    list.appendChild(newRow);
  },

  runSolverMath: function() {
    if (typeof solver === 'undefined') {
      alert("The Math Solver library hasn't loaded yet. Please refresh the page.");
      return;
    }

    try {
      const tWeight = parseFloat(document.getElementById('optTargetWeight').value);
      const targets = {
        protein: parseFloat(document.getElementById('optTargetProtein').value) || 0,
        energy: parseFloat(document.getElementById('optTargetEnergy').value) || 0,
        calcium: parseFloat(document.getElementById('optTargetCalcium').value) || 0,
        phos: parseFloat(document.getElementById('optTargetPhos').value) || 0,
        lysine: parseFloat(document.getElementById('optTargetLysine').value) || 0,
        meth: parseFloat(document.getElementById('optTargetMeth').value) || 0,
        fiber: parseFloat(document.getElementById('optTargetFiber').value) || 100 
      };

      const model = {
        "optimize": "cost",
        "opType": "min",
        "constraints": {
          "weight": { "equal": tWeight },
          "protein": { "min": tWeight * (targets.protein / 100) },
          "energy": { "min": tWeight * targets.energy }, 
          "calcium": { "min": tWeight * (targets.calcium / 100) },
          "phos": { "min": tWeight * (targets.phos / 100) },
          "lysine": { "min": tWeight * (targets.lysine / 100) },
          "meth": { "min": tWeight * (targets.meth / 100) },
          "fiber": { "max": tWeight * (targets.fiber / 100) } 
        },
        "variables": {}
      };

      const rows = document.querySelectorAll('.opt-ingredient-row'); 
      let ingredientCount = 0;

      rows.forEach(row => {
        const name = row.querySelector('.opt-name').value.trim() || `Ingredient_${ingredientCount}`;
        const cost = parseFloat(row.querySelector('.opt-cost').value) || 0;
        
        if (name && cost > 0) {
          model.variables[name] = {
            "cost": cost, "weight": 1,
            "protein": (parseFloat(row.querySelector('.opt-protein').value) || 0) / 100,
            "energy": parseFloat(row.querySelector('.opt-energy').value) || 0,
            "calcium": (parseFloat(row.querySelector('.opt-calcium').value) || 0) / 100,
            "phos": (parseFloat(row.querySelector('.opt-phos').value) || 0) / 100,
            "lysine": (parseFloat(row.querySelector('.opt-lysine').value) || 0) / 100,
            "meth": (parseFloat(row.querySelector('.opt-meth').value) || 0) / 100,
            "fiber": (parseFloat(row.querySelector('.opt-fiber').value) || 0) / 100
          };

          const maxPercent = parseFloat(row.querySelector('.opt-max').value);
          if (!isNaN(maxPercent)) {
            const maxAllowedKg = tWeight * (maxPercent / 100);
            const customRuleName = `limit_${name}`; 
            model.constraints[customRuleName] = { "max": maxAllowedKg };
            model.variables[name][customRuleName] = 1;
          }
          ingredientCount++;
        }
      });

      if (ingredientCount < 2) {
        alert("Please enter at least 2 valid ingredients with costs.");
        return;
      }

      const results = solver.Solve(model);
      this.displayResults(results, tWeight);

    } catch (error) {
      alert("An error occurred while calculating: " + error.message);
      console.error(error);
    }
  },

  displayResults: function(results, tWeight) {
    const resultBox = document.getElementById('optResultBox');
    const recipeList = document.getElementById('optRecipeList');
    
    if (results.feasible) {
      AppState.optimizer.rawResults = results;
      AppState.optimizer.baseWeight = tWeight;

      if (!document.getElementById('batchScaleInput')) {
        const scalerHTML = `
          <div style="background: #e8f5e9; padding: 12px; border-radius: 6px; margin-bottom: 15px; display: flex; align-items: center; gap: 10px; border: 1px solid #2e7d32; flex-wrap: wrap;">
            <label style="font-weight: bold; color: #2e7d32; margin: 0;">🏭 Production Batch Size (kg):</label>
            <input type="number" id="batchScaleInput" class="form-control" value="${tWeight}" style="width: 120px; font-weight: bold; text-align: center;">
            <button type="button" id="applyScaleBtn" class="btn btn-success btn-sm" style="background: #2e7d32; color: white;">Scale Recipe</button>
          </div>
        `;
        recipeList.insertAdjacentHTML('beforebegin', scalerHTML);
        
        document.getElementById('applyScaleBtn').addEventListener('click', () => {
          const newTarget = parseFloat(document.getElementById('batchScaleInput').value) || tWeight;
          this.renderScaledRecipe(newTarget);
        });
      } else {
         document.getElementById('batchScaleInput').value = tWeight;
      }

      this.renderScaledRecipe(tWeight);
      resultBox.style.display = 'block';

    } else {
      alert("Nutritional Conflict! It is mathematically impossible to meet all those targets with these ingredients.");
      resultBox.style.display = 'none';
    }
  },

  renderScaledRecipe: function(targetBatchSize) {
    const results = AppState.optimizer.rawResults;
    const baseWeight = AppState.optimizer.baseWeight;
    const recipeList = document.getElementById('optRecipeList');
    
    const scale = targetBatchSize / baseWeight;
    const scaledCost = results.result * scale;
    document.getElementById('optFinalCost').innerText = `PHP ${scaledCost.toFixed(2)}`;
    
    let actualProteinMass = 0;
    let actualEnergy = 0;
    
    AppState.optimizer.lastRecipe = []; 

    let recipeHTML = `<strong>Recipe (for ${targetBatchSize} kg mix):</strong><ul style="margin-top: 10px;">`;
    for (const [key, value] of Object.entries(results)) {
      if (!['feasible', 'result', 'bounded', 'isIntegral'].includes(key) && value > 0.01) { 
        const scaledQty = value * scale;
        recipeHTML += `<li>${key}: <strong>${scaledQty.toFixed(2)} kg</strong></li>`;
        
        const ing = AppState.optimizer.matrix ? AppState.optimizer.matrix[key.toLowerCase()] : null;
        
        if(ing) {
           actualProteinMass += scaledQty * (ing.protein / 100);
           actualEnergy += scaledQty * ing.energy;
           AppState.optimizer.lastRecipe.push({ name: key, qty: scaledQty, protein: ing.protein });
        } else {
           AppState.optimizer.lastRecipe.push({ name: key, qty: scaledQty, protein: 0 });
        }
      }
    }
    recipeHTML += '</ul>';
    recipeList.innerHTML = recipeHTML;

    AppState.optimizer.lastFormulatedFeed = {
       protein: (actualProteinMass / targetBatchSize) * 100,
       energy: (actualEnergy / targetBatchSize),
       costPerKg: scaledCost / targetBatchSize
    };
    localStorage.setItem('unifarm_optimized_cost', (scaledCost / targetBatchSize));
    
    recipeList.style.transition = "background-color 0.3s";
    recipeList.style.backgroundColor = "#d4edda";
    setTimeout(() => recipeList.style.backgroundColor = "transparent", 400);
  },

  exportToManual: function() {
    if (!AppState.optimizer.lastRecipe || AppState.optimizer.lastRecipe.length === 0) {
      alert("No recipe to export!");
      return;
    }

    document.querySelectorAll('.nav-tab').forEach(tab => {
      if (tab.innerText.includes('Formulator')) tab.click(); 
    });

    const manualList = document.getElementById('ingredientList');
    if (!manualList) return;
    manualList.innerHTML = '';

    AppState.optimizer.lastRecipe.forEach(item => {
      const newRow = document.createElement('div');
      newRow.className = 'input-row ingredient-row dynamic-row'; 
      newRow.innerHTML = `
        <div class="input-group">
          <label>Ingredient</label>
          <input type="text" class="ing-name form-control" value="${item.name.charAt(0).toUpperCase() + item.name.slice(1)}" required>
        </div>
        <div class="input-group">
          <label>Weight (kg)</label>
          <input type="number" class="ing-weight form-control" step="0.01" value="${item.qty.toFixed(2)}" required>
        </div>
        <div class="input-group">
          <label>Protein (%)</label>
          <input type="number" class="ing-protein form-control" step="0.1" value="${item.protein}" required>
        </div>
        <button type="button" class="remove-btn" style="height: 42px; margin-top: 22px;">X</button>
      `;
      newRow.querySelector('.remove-btn').addEventListener('click', () => newRow.remove());
      manualList.appendChild(newRow);
    });

    manualList.style.transition = "background-color 0.5s";
    manualList.style.backgroundColor = "#e8f5e9";
    setTimeout(() => manualList.style.backgroundColor = "transparent", 800);
    
    const manualCalcBtn = document.getElementById('calculateFeedBtn');
    if (manualCalcBtn) manualCalcBtn.click();
  }, // <-- ADDED COMMA HERE

  // Changed from window.fetchFeedMatrix
  fetchFeedMatrix: async function() {
    const targetId = AppState.user.ownerId || AppState.user.id;
    if (!targetId) return;
  
    const { data, error } = await supabaseClient
      .from('feed_matrix')
      .select('*')
      .or(`owner_id.is.null,owner_id.eq.${targetId}`);
  
    if (error) return console.error("Error fetching dictionary:", error.message);
  
    AppState.optimizer.matrix = {};
    data.forEach(item => {
       AppState.optimizer.matrix[item.name.toLowerCase().trim()] = item;
    });
  
    if (typeof SettingsController !== 'undefined') SettingsController.displayMatrixSettings(); 
    this.populateOptimizerTable(data); // <-- Changed to 'this.'
  }, // <-- ADDED COMMA HERE
  
  // Changed from window.syncOptimizerLimits
  syncOptimizerLimits: function() {
    // console.log("--- 🚀 SYNC STARTED ---");
    const presetSelector = document.getElementById('optAnimalCategory');
    if (!presetSelector) { console.log("❌ ERROR: Dropdown menu not found!"); return; }
  
    const currentTarget = presetSelector.options[presetSelector.selectedIndex].text.toLowerCase();
    // console.log("1. Selected Animal is:", currentTarget);
  
    const maxInputs = document.querySelectorAll('.opt-max');
    // console.log("2. Found this many Max boxes:", maxInputs.length);
  
    maxInputs.forEach((maxInput, index) => {
      const row = maxInput.closest('.opt-ingredient-row') || maxInput.parentElement.parentElement; 
      
      const allInputsInRow = row.querySelectorAll('input');
      if (allInputsInRow.length === 0) { console.log(`Row ${index}: ❌ No inputs found in this row.`); return; }
      const nameInput = allInputsInRow[0]; 
      
      if (!nameInput || !nameInput.value) { console.log(`Row ${index}: ❌ Name input is blank.`); return; }
  
      const ingName = nameInput.value.toLowerCase().trim();
      // console.log(`Row ${index}: Trying to find "${ingName}" in database...`);
  
      const item = AppState.optimizer.matrix[ingName];
      if (!item) { console.log(`Row ${index}: ❌ "${ingName}" NOT FOUND in the cloud dictionary!`); return; }
  
      let limits = item.inclusion_limits || {};
      if (typeof limits === 'string') {
        try { limits = JSON.parse(limits); } catch(e) { limits = {}; }
      }
      // console.log(`Row ${index}: Database Limits =`, limits);
  
      let finalMax = limits['default'] !== undefined ? limits['default'] : (item.max_percent || 100);
  
      if (currentTarget.includes('broiler') && currentTarget.includes('starter') && limits['broiler_starter']) {
        finalMax = limits['broiler_starter'];
      } else if (currentTarget.includes('broiler') && currentTarget.includes('finisher') && limits['broiler_finisher']) {
        finalMax = limits['broiler_finisher'];
      } else if (currentTarget.includes('swine') && currentTarget.includes('starter') && limits['swine_starter']) {
        finalMax = limits['swine_starter'];
      } else if (currentTarget.includes('swine') && currentTarget.includes('finisher') && limits['swine_finisher']) {
        finalMax = limits['swine_finisher'];
      }
  
      // console.log(`Row ${index}: Calculating... Old Max = ${maxInput.value}, New Max = ${finalMax}`);
  
      if (parseFloat(maxInput.value) !== parseFloat(finalMax)) {
          maxInput.value = finalMax;
          maxInput.style.transition = "background-color 0.3s";
          maxInput.style.backgroundColor = "#d4edda"; 
          setTimeout(() => maxInput.style.backgroundColor = "", 600);
          // console.log(`Row ${index}: ✅ SUCCESS! Changed to ${finalMax}`);
      } else {
          // console.log(`Row ${index}: ⏸️ No change needed.`);
      }
    });
    // console.log("--- 🏁 SYNC FINISHED ---");
  }, // <-- ADDED COMMA HERE
  
  // Changed from window.downloadMixSheetPDF
  downloadMixSheetPDF: function() {
    const resultBox = document.getElementById('optResultBox');
    if (!resultBox || resultBox.innerText.trim() === '') {
      alert("Please run the Optimizer to generate a formula first!");
      return;
    }
  
    const pdfBtn = document.getElementById('downloadMixPdfBtn');
    const originalText = pdfBtn.innerText;
    pdfBtn.innerText = "⏳ Generating Report...";
  
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
  
      const targetAnimal = document.getElementById('optAnimalCategory');
      const animalName = targetAnimal ? targetAnimal.options[targetAnimal.selectedIndex].text : 'Feed_Mix';
      const safeFileName = animalName.replace(/[^a-zA-Z0-9]/g, '_');
      const date = new Date().toISOString().split('T')[0];
      
      const batchInput = document.getElementById('batchScaleInput');
      const batchSize = batchInput ? batchInput.value : '100';
  
      doc.setFontSize(22);
      doc.setTextColor(46, 125, 50); 
      doc.text("Unifarm Hub", 14, 25);
  
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0); 
      doc.setFont("helvetica", "bold");
      doc.text("Official Formula Report", 14, 35);
  
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100); 
      doc.setFont("helvetica", "normal");
      doc.text(`Target Animal: ${animalName}`, 14, 45);
      doc.text(`Date Generated: ${date}`, 14, 51);
      
      doc.setFont("helvetica", "bold");
      doc.text(`Target Batch Size: ${batchSize} kg`, 14, 57); 
      doc.setFont("helvetica", "normal");
  
      let rawText = resultBox.innerText.replace(/₱/g, 'PHP ').replace(/🏭/g, ''); 
      let lines = rawText.split('\n').map(l => l.trim()).filter(l => l !== '');
      
      let estimatedCost = "PHP 0.00";
      let tableData = [];
  
      lines.forEach(line => {
        if (line.includes('Estimated Cost')) {
          let parts = line.split(':');
          if (parts.length > 1) estimatedCost = parts[1].trim();
        }
        else if (line.includes(':') && line.includes('kg') && !line.includes('Recipe') && !line.includes('Production Batch Size')) { 
          let cleanLine = line.replace(/^•\s*/, '').trim(); 
          let parts = cleanLine.split(':');
          if (parts.length === 2) {
            tableData.push([parts[0].trim(), parts[1].trim()]);
          }
        }
      });
  
      tableData.push([
        { content: 'Total Estimated Cost', styles: { fontStyle: 'bold', textColor: [46, 125, 50] } },
        { content: estimatedCost, styles: { fontStyle: 'bold', textColor: [46, 125, 50] } }
      ]);
  
      doc.autoTable({
        startY: 63, 
        head: [['Formulation Metric', 'Target Value']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [46, 125, 50], 
          textColor: 255,
          fontSize: 11,
          fontStyle: 'bold',
          halign: 'left'
        },
        columnStyles: {
          0: { cellWidth: 100 }, 
          1: { halign: 'right', fontStyle: 'bold' } 
        },
        styles: {
          fontSize: 10,
          cellPadding: 6,
          font: 'helvetica'
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251] 
        }
      });
  
      let finalY = doc.lastAutoTable.finalY || 60; 
      doc.setDrawColor(150, 150, 150);
      doc.line(14, finalY + 30, 80, finalY + 30);
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text("Nutritionist / Farm Manager (Signature)", 14, finalY + 36);
  
      doc.save(`Unifarm_Formula_${safeFileName}_${date}.pdf`);
      pdfBtn.innerText = originalText;
  
    } catch (err) {
      console.error("Native PDF Error:", err);
      pdfBtn.innerText = "❌ Error";
      setTimeout(() => pdfBtn.innerText = originalText, 2000);
    }
  }, // <-- ADDED COMMA HERE
  
  // Changed from window.mixBatchAndUpdateInventory
  mixBatchAndUpdateInventory: async function() {
    if (!AppState.optimizer.lastRecipe || AppState.optimizer.lastRecipe.length === 0) {
      alert("Please run the Optimizer to generate a formula first!");
      return;
    }
  
    if (!confirm("Are you sure you want to mix this batch and deduct these items from your inventory?")) return;
  
    const btn = document.getElementById('optDeductBtn');
    const originalText = btn ? btn.innerText : "📦 Mix Batch";
    if (btn) btn.innerText = "⏳ Checking Warehouse...";
  
    try {
      const recipe = AppState.optimizer.lastRecipe;
      let shortages = [];
      let updatesToMake = [];
      let deletesToMake = [];
  
      // console.log("--- 📦 STARTING WAREHOUSE CHECK ---");
  
      for (const item of recipe) {
        const requiredQty = item.qty;
        
        const firstWord = item.name.split(' ')[0].trim();
        // console.log(`Searching inventory for: ${firstWord} (Need: ${requiredQty.toFixed(2)} kg)`);
  
        const { data: invRows, error } = await supabaseClient
          .from('inventory')
          .select('*')
          .ilike('name', `%${firstWord}%`) 
          .order('qty', { ascending: true }); 
  
        if (error) {
          console.error("Supabase Error:", error);
          throw error;
        }
  
        let totalAvailable = 0;
        invRows.forEach(row => totalAvailable += parseFloat(row.qty));
  
        if (totalAvailable < requiredQty) {
          shortages.push(`${item.name} (Need: ${requiredQty.toFixed(2)} kg, Have: ${totalAvailable.toFixed(2)} kg)`);
        } else {
          let remainingToDeduct = requiredQty;
          for (let i = 0; i < invRows.length; i++) {
            if (remainingToDeduct <= 0) break;
            let rowQty = parseFloat(invRows[i].qty);
            if (rowQty <= remainingToDeduct) {
              deletesToMake.push(invRows[i].id);
              remainingToDeduct -= rowQty;
            } else {
              updatesToMake.push({ id: invRows[i].id, newQty: rowQty - remainingToDeduct });
              remainingToDeduct = 0;
            }
          }
        }
      }
  
      if (shortages.length > 0) {
        alert("❌ INSUFFICIENT INVENTORY!\n\nYou are short on the following materials:\n\n• " + shortages.join('\n• '));
        if (btn) btn.innerText = originalText;
        return;
      }
  
      if (btn) btn.innerText = "⏳ Updating Cloud...";
      
      for (const update of updatesToMake) {
        await supabaseClient.from('inventory').update({ qty: update.newQty }).eq('id', update.id);
      }
      for (const id of deletesToMake) {
        await supabaseClient.from('inventory').delete().eq('id', id);
      }
  
      alert("✅ BATCH MIXED SUCCESSFULLY!\n\nIngredients have been deducted.");
      if (btn) btn.innerText = originalText;
  
      // Refresh UI using the imported controller!
      if (typeof InventoryController !== 'undefined') {
        InventoryController.fetchAndDisplay();
      }
  
    } catch (err) {
      console.error("Inventory Deduction Error:", err);
      alert("A database error occurred. Press F12 and check the Console for details.");
      if (btn) btn.innerText = originalText;
    }
  }, // <-- ADDED COMMA HERE
  
  // Changed from window.populateOptimizerTable
  populateOptimizerTable: function(data) {
    const list = document.getElementById('optIngredientList');
    if (!list) return;
  
    list.innerHTML = `<div class="opt-grid-row header-row">
        <div>Ingredient</div><div>Cost (₱)</div><div>CP (%)</div><div>Energy</div><div>Ca (%)</div><div>Phos (%)</div><div>Lys (%)</div><div>Meth (%)</div><div>Fiber (%)</div><div>Max (%)</div><div></div>
      </div>`;
  
    data.forEach(item => {
      const row = document.createElement('div');
      row.className = 'opt-grid-row opt-ingredient-row dynamic-row';
      const displayName = item.name.charAt(0).toUpperCase() + item.name.slice(1);
  
      row.innerHTML = `
        <input type="text" class="opt-name form-control" value="${displayName}">
        <input type="number" class="opt-cost form-control" value="${item.cost}">
        <input type="number" class="opt-protein form-control" value="${item.protein || 0}">
        <input type="number" class="opt-energy form-control" value="${item.energy || 0}">
        <input type="number" class="opt-calcium form-control" value="${item.calcium || 0}">
        <input type="number" class="opt-phos form-control" value="${item.phosphorus || 0}">
        <input type="number" class="opt-lysine form-control" value="${item.lysine || 0}">
        <input type="number" class="opt-meth form-control" value="${item.methionine || 0}">
        <input type="number" class="opt-fiber form-control" value="${item.fiber || 0}">
        <input type="number" class="opt-max form-control" value="${item.max_percent || 100}">
        <button type="button" class="remove-btn">X</button>
      `;
      row.querySelector('.remove-btn').addEventListener('click', () => row.remove());
      list.appendChild(row);
    });
    const addBtn = document.getElementById('optAddRowBtn');
    if (addBtn) addBtn.click();
    
    // Call the internal sync method
    this.syncOptimizerLimits(); // <-- Changed to 'this.'
  }
};