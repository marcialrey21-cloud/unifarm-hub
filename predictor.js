import { AppState } from './state.js';
import { supabaseClient } from './db.js';

export const PredictorController = {
  animalDefaults: {
    'broiler': { adg: 0.065, fcr: 1.6, reqCP: 20, reqEnergy: 3000 },
    'swine':   { adg: 0.85,  fcr: 2.5, reqCP: 16, reqEnergy: 3100 },
    'beef':    { adg: 1.20,  fcr: 6.0, reqCP: 12, reqEnergy: 2600 },
    'goat':    { adg: 0.15,  fcr: 5.0, reqCP: 14, reqEnergy: 2500 },
    'dairy':   { adg: 0,     fcr: 0,   reqCP: 16, reqEnergy: 2700 }, 
    'tilapia': { adg: 0.003, fcr: 1.5, reqCP: 30, reqEnergy: 2800 },
    'custom':  { adg: '',    fcr: '',  reqCP: 0,  reqEnergy: 0 }
  },

  init: function() {
    // 1. Stock Predictor Listeners
    const predictBtn = document.getElementById('predictBtn');
    if (predictBtn) predictBtn.addEventListener('click', () => this.calculateStockRunway());

    // 2. Growth Predictor Listeners
    const animalTypeEl = document.getElementById('animalType');
    if (animalTypeEl) {
        animalTypeEl.addEventListener('change', (e) => this.handleAnimalTypeChange(e.target.value));
        this.handleAnimalTypeChange(animalTypeEl.value); // Trigger once on load
    }

    const useFormulatedFeed = document.getElementById('useFormulatedFeed');
    if (useFormulatedFeed) useFormulatedFeed.addEventListener('change', (e) => this.toggleFeedStats(e.target));

    const calcGrowthBtn = document.getElementById('calcGrowthBtn');
    if (calcGrowthBtn) calcGrowthBtn.addEventListener('click', () => this.calculateHarvest());

    const growthPdfBtn = document.getElementById('downloadPdfBtn');
    if (growthPdfBtn) growthPdfBtn.addEventListener('click', () => this.generateGrowthPdf());

    // 3. Dairy Predictor Listeners
    const dairyForm = document.getElementById('dairyForm');
    if (dairyForm) dairyForm.addEventListener('submit', (e) => this.calculateDairyYield(e));
  },

  // --- STOCK MATH ---
  calculateStockRunway: async function() {
    const predictBtn = document.getElementById('predictBtn');
    const selectedItemName = document.getElementById('predictItemSelect').value;
    const dailyRate = parseFloat(document.getElementById('dailyRate').value);

    if (!selectedItemName) return alert("Please select an item from your inventory first.");
    if (!dailyRate || dailyRate <= 0) return alert("Please enter a valid daily consumption rate greater than 0.");

    const originalText = predictBtn.innerText;
    predictBtn.innerText = "Calculating...";

    const { data, error } = await supabaseClient.from('inventory').select('*').eq('name', selectedItemName).maybeSingle();
    predictBtn.innerText = originalText;

    if (error || !data) return alert("Could not find this item in the database.");

    const currentStock = parseFloat(data.qty);
    const daysLeft = currentStock / dailyRate;

    const today = new Date(); 
    const emptyDate = new Date(today); 
    emptyDate.setDate(today.getDate() + daysLeft); 

    document.getElementById('predCurrentStock').innerText = `${currentStock} ${data.unit}`;
    document.getElementById('predDaysLeft').innerText = `${Math.floor(daysLeft)} Days`;
    document.getElementById('predEmptyDate').innerText = emptyDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('predictionResult').style.display = 'block';
  },

  // --- GROWTH MATH ---
  handleAnimalTypeChange: function(type) {
    const defaults = this.animalDefaults[type] || this.animalDefaults['custom'];
    const adgEl = document.getElementById('adg');
    const fcrEl = document.getElementById('fcr');
    if (adgEl && defaults.adg !== undefined) adgEl.value = defaults.adg;
    if (fcrEl && defaults.fcr !== undefined) fcrEl.value = defaults.fcr;
  },

  toggleFeedStats: function(checkbox) {
    const display = document.getElementById('feedStatsDisplay');
    if (!display) return;
    
    if (checkbox.checked) {
      const savedCost = localStorage.getItem('unifarm_optimized_cost');
      if (AppState.optimizer.lastFormulatedFeed && savedCost) {
        display.innerHTML = `✅ Premium Feed: <strong>${AppState.optimizer.lastFormulatedFeed.protein.toFixed(1)}% CP</strong> | <strong>${AppState.optimizer.lastFormulatedFeed.energy.toFixed(0)} kcal</strong> | <strong>₱${parseFloat(savedCost).toFixed(2)}/kg</strong>`;
        display.style.color = "#2e7d32";
        display.style.display = 'block';
      } else {
        alert("No optimized feed found! Go to the Optimizer tab first to generate a custom feed.");
        checkbox.checked = false;
        display.style.display = 'none';
      }
    } else {
      display.style.display = 'none';
    }
  },

  calculateHarvest: function() {
    const currentW = parseFloat(document.getElementById('currentWeight').value);
    const targetW = parseFloat(document.getElementById('targetWeight').value);
    let activeADG = parseFloat(document.getElementById('adg').value);
    let activeFCR = parseFloat(document.getElementById('fcr').value);

    if (!currentW || !targetW || !activeADG || !activeFCR) return alert("Please fill in all Growth Predictor fields.");
    if (targetW <= currentW) return alert("Target weight must be higher than current weight!");

    let feedCostPerKg = 35; // Default commercial feed
    const useFeedCb = document.getElementById('useFormulatedFeed');
    
    if (useFeedCb && useFeedCb.checked && AppState.optimizer.lastFormulatedFeed) {
      feedCostPerKg = parseFloat(localStorage.getItem('unifarm_optimized_cost')) || 35;
      const type = document.getElementById('animalType').value;
      const reqs = this.animalDefaults[type];

      if (reqs && reqs.reqCP > 0) {
        const cpRatio = AppState.optimizer.lastFormulatedFeed.protein / reqs.reqCP;
        const energyRatio = AppState.optimizer.lastFormulatedFeed.energy / reqs.reqEnergy;
        let performanceScore = Math.max(0.7, Math.min((cpRatio * 0.5) + (energyRatio * 0.5), 1.15));
        activeADG *= performanceScore;
        activeFCR /= performanceScore;
      }
    }

    const weightGain = targetW - currentW;
    const daysNeeded = Math.ceil(weightGain / activeADG);
    const totalFeedNeeded = weightGain * activeFCR;
    const totalCost = totalFeedNeeded * feedCostPerKg;

    const harvestDate = new Date();
    harvestDate.setDate(harvestDate.getDate() + daysNeeded);

    document.getElementById('resDaysToHarvest').innerText = `${daysNeeded} Days`;
    document.getElementById('resHarvestDate').innerText = harvestDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    document.getElementById('resTotalFeed').innerText = `${totalFeedNeeded.toFixed(2)} kg`;
    
    const costEl = document.getElementById('resTotalCost');
    if (costEl) costEl.innerText = `₱${totalCost.toFixed(2)}`;

    const resBox = document.getElementById('growthResultBox');
    if (resBox) {
        resBox.classList.remove('hidden-result');
        resBox.style.display = 'block';
    }
  },

  // --- PDF GENERATOR ---
  generateGrowthPdf: function() {
    if (!window.jspdf) return alert("PDF library is still loading. Please try again.");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(22);
    doc.setTextColor(46, 125, 50);
    doc.text("Unifarm Hub", 14, 20);

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Official Harvest Projection Report", 14, 30);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Date Generated: " + new Date().toLocaleDateString(), 14, 38);

    const days = document.getElementById('resDaysToHarvest').innerText;
    const harvestDate = document.getElementById('resHarvestDate').innerText;
    const totalFeed = document.getElementById('resTotalFeed').innerText;
    const totalCost = document.getElementById('resTotalCost').innerText.replace('₱', 'PHP ');

    doc.autoTable({
      startY: 45,
      head: [['Projection Metric', 'Estimated Value']],
      body: [
        ['Days to Harvest', days],
        ['Target Harvest Date', harvestDate],
        ['Total Feed Needed (per head)', totalFeed],
        ['Estimated Feed Cost (per head)', totalCost]
      ],
      theme: 'grid',
      headStyles: { fillColor: [46, 125, 50] },
      styles: { fontSize: 12, cellPadding: 6 }
    });

    const finalY = doc.lastAutoTable.finalY || 45;
    doc.line(14, finalY + 30, 80, finalY + 30);
    doc.text("Farm Manager (Signature)", 14, finalY + 35);

    doc.save(`Unifarm_Harvest_Report_${new Date().toLocaleDateString('en-US').replace(/\//g, '_')}.pdf`);
  },

  // --- DAIRY MATH ---
  calculateDairyYield: function(e) {
    e.preventDefault();
    const currentYield = parseFloat(document.getElementById('currentYield').value);
    const dim = parseFloat(document.getElementById('dim').value);
    
    let peakYield = (dim <= 50) ? currentYield * 1.1 : currentYield / (1 - ((dim - 50) * 0.002));
    let estimated305Yield = peakYield * 210; 

    document.getElementById('resPeakYield').innerText = peakYield.toFixed(1) + " L/day";
    document.getElementById('resTotalYield').innerText = Math.round(estimated305Yield).toLocaleString() + " Liters";
    
    const resBox = document.getElementById('dairyResultBox');
    if (resBox) resBox.classList.remove('hidden-result');
  }
};