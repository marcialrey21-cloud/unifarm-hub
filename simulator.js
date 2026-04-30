// simulator.js
export const SimulatorController = {
  chartInstance: null,
  
  // REALISTIC, ITEMIZED MARKET ASSUMPTIONS (PHP)
  assumptions: {
    pricePerTon: 18000,
    
    // Fixed / Base Costs
    landPrep: 8500,
    seeds: 4500,
    plantingLabor: 3500,
    harvestLabor: 9000,
    
    // Material Costs
    priceUrea: 1450, 
    priceComplete: 1650, 
    priceInsecticide: 850, 
    priceFungicide: 1100, 
    priceHerbicide: 900, 
    
    // Application Labor (Per pass)
    fertLabor: 500,
    sprayLabor: 600,
    
    // Utilities
    waterCost: 20 
  },

  init: function() {
    const sliders = document.querySelectorAll('.sim-slider');
    if (sliders.length === 0) return;

    sliders.forEach(slider => {
      slider.addEventListener('input', () => this.runSimulation());
    });

    const settingsBtn = document.getElementById('simSettingsBtn');
    const closeBtn = document.getElementById('closeAssumptionsBtn');
    const saveBtn = document.getElementById('saveAssumptionsBtn');
    
    if(settingsBtn) settingsBtn.addEventListener('click', () => this.openModal());
    if(closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
    if(saveBtn) saveBtn.addEventListener('click', () => this.saveAssumptions());

    this.runSimulation();
  },

  openModal: function() {
    document.getElementById('asmPrice').value = this.assumptions.pricePerTon;
    document.getElementById('asmLandPrep').value = this.assumptions.landPrep;
    document.getElementById('asmSeeds').value = this.assumptions.seeds;
    document.getElementById('asmPlanting').value = this.assumptions.plantingLabor;
    document.getElementById('asmHarvest').value = this.assumptions.harvestLabor;
    
    document.getElementById('asmUrea').value = this.assumptions.priceUrea;
    document.getElementById('asmComplete').value = this.assumptions.priceComplete;
    document.getElementById('asmInsecticideMat').value = this.assumptions.priceInsecticide;
    document.getElementById('asmFungicideMat').value = this.assumptions.priceFungicide;
    document.getElementById('asmHerbicideMat').value = this.assumptions.priceHerbicide;
    
    document.getElementById('asmFertLabor').value = this.assumptions.fertLabor;
    document.getElementById('asmSprayLabor').value = this.assumptions.sprayLabor;
    document.getElementById('asmWater').value = this.assumptions.waterCost;
    
    document.getElementById('assumptionsModal').classList.remove('hidden-section');
  },

  closeModal: function() {
    document.getElementById('assumptionsModal').classList.add('hidden-section');
  },

  saveAssumptions: function() {
    this.assumptions.pricePerTon = parseFloat(document.getElementById('asmPrice').value) || 0;
    this.assumptions.landPrep = parseFloat(document.getElementById('asmLandPrep').value) || 0;
    this.assumptions.seeds = parseFloat(document.getElementById('asmSeeds').value) || 0;
    this.assumptions.plantingLabor = parseFloat(document.getElementById('asmPlanting').value) || 0;
    this.assumptions.harvestLabor = parseFloat(document.getElementById('asmHarvest').value) || 0;
    
    this.assumptions.priceUrea = parseFloat(document.getElementById('asmUrea').value) || 0;
    this.assumptions.priceComplete = parseFloat(document.getElementById('asmComplete').value) || 0;
    this.assumptions.priceInsecticide = parseFloat(document.getElementById('asmInsecticideMat').value) || 0;
    this.assumptions.priceFungicide = parseFloat(document.getElementById('asmFungicideMat').value) || 0;
    this.assumptions.priceHerbicide = parseFloat(document.getElementById('asmHerbicideMat').value) || 0;
    
    this.assumptions.fertLabor = parseFloat(document.getElementById('asmFertLabor').value) || 0;
    this.assumptions.sprayLabor = parseFloat(document.getElementById('asmSprayLabor').value) || 0;
    this.assumptions.waterCost = parseFloat(document.getElementById('asmWater').value) || 0;
    
    this.closeModal();
    this.runSimulation();
  },

  runSimulation: function() {
    const bagsUrea = parseFloat(document.getElementById('simUrea').value);
    const bagsComplete = parseFloat(document.getElementById('simComplete').value);
    const sprayInsect = parseFloat(document.getElementById('simInsecticide').value);
    const sprayFungi = parseFloat(document.getElementById('simFungicide').value);
    const sprayHerb = parseFloat(document.getElementById('simHerbicide').value);
    const water = parseFloat(document.getElementById('simWater').value);

    document.getElementById('valUrea').innerText = bagsUrea;
    document.getElementById('valComplete').innerText = bagsComplete;
    document.getElementById('valInsecticide').innerText = sprayInsect;
    document.getElementById('valFungicide').innerText = sprayFungi;
    document.getElementById('valHerbicide').innerText = sprayHerb;
    document.getElementById('valWater').innerText = water;

    // --- YIELD MATH ---
    const totalN = (bagsUrea * 50 * 0.46) + (bagsComplete * 50 * 0.14);
    const nPenalty = Math.pow((totalN - 130) / 130, 2); 
    const wPenalty = Math.pow((water - 150) / 150, 2);    
    
    let baseHealth = 1 - (nPenalty + wPenalty);
    if (baseHealth < 0.2) baseHealth = 0.2; 

    let pestLoss = 0.25 - (sprayInsect * 0.10); 
    let fungiLoss = 0.15 - (sprayFungi * 0.10); 
    let weedLoss = 0.20 - (sprayHerb * 0.20);   
    
    if (pestLoss < 0) pestLoss = 0;
    if (fungiLoss < 0) fungiLoss = 0;
    if (weedLoss < 0) weedLoss = 0;

    const totalLossFactor = pestLoss + fungiLoss + weedLoss;
    const maxYieldPotential = 13.5; 
    const actualYield = (maxYieldPotential * baseHealth) * (1 - totalLossFactor);

    // --- ACCOUNTING ENGINE ---
    const totalRevenue = actualYield * this.assumptions.pricePerTon;
    
    // 1. Fixed Base Costs
    const fixedBaseCost = this.assumptions.landPrep + this.assumptions.seeds + this.assumptions.plantingLabor + this.assumptions.harvestLabor;
    
    // 2. Fertilizer Material + Labor
    // Assume 1 labor pass per 4 bags applied (just as an example metric)
    const fertPasses = Math.ceil((bagsUrea + bagsComplete) / 4);
    const fertCost = (bagsUrea * this.assumptions.priceUrea) + 
                     (bagsComplete * this.assumptions.priceComplete) + 
                     (fertPasses * this.assumptions.fertLabor);
                     
    // 3. Chemical Material + Labor (1 pass per spray)
    const chemCost = (sprayInsect * this.assumptions.priceInsecticide) + (sprayInsect * this.assumptions.sprayLabor) +
                     (sprayFungi * this.assumptions.priceFungicide) + (sprayFungi * this.assumptions.sprayLabor) +
                     (sprayHerb * this.assumptions.priceHerbicide) + (sprayHerb * this.assumptions.sprayLabor);
                     
    // 4. Utilities
    const waterCost = water * this.assumptions.waterCost;
    
    const totalCosts = fixedBaseCost + fertCost + chemCost + waterCost;
    const netProfit = totalRevenue - totalCosts;
    const roi = (netProfit / totalCosts) * 100;

    // --- UPDATE UI ---
    document.getElementById('simYieldResult').innerText = actualYield.toFixed(2) + " Tons/ha";
    
    const profitDisplay = document.getElementById('simProfitResult');
    profitDisplay.innerText = "PHP " + netProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    profitDisplay.style.color = netProfit >= 0 ? "#0277bd" : "#d32f2f"; 
    
    const roiDisplay = document.getElementById('simRoiResult');
    roiDisplay.innerText = `Projected ROI: ${roi.toFixed(1)}%`;
    roiDisplay.style.color = roi >= 0 ? "#2e7d32" : "#d32f2f";

    // Update Chart with highly detailed financial sectors
    this.updateChart(fixedBaseCost, fertCost, chemCost, netProfit > 0 ? netProfit : 0);
  },

  updateChart: function(base, fert, chem, profit) {
    const ctx = document.getElementById('simFinancialChart');
    if (!ctx) return;

    if (!this.chartInstance) {
      this.chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Fixed Prep/Harvest', 'Fertilizer & Labor', 'Chemicals & Labor', 'Net Profit'],
          datasets: [{
            data: [base, fert, chem, profit],
            backgroundColor: ['#94a3b8', '#f59e0b', '#ef4444', '#2e7d32'], 
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 400 }, 
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } }
          }
        }
      });
    } else {
      this.chartInstance.data.datasets[0].data = [base, fert, chem, profit];
      this.chartInstance.update();
    }
  },
  // 🟢 NEW: Receive diagnoses from the Scanner
  applyPrescription: function(diagnosisId) {
    if (diagnosisId === 'nitrogen') {
      // The AI recommended Urea. Let's automatically add 2 bags!
      let currentUrea = parseFloat(document.getElementById('simUrea').value);
      document.getElementById('simUrea').value = currentUrea + 2;
    } 
    else if (diagnosisId === 'phosphorus') {
      // The AI recommended Complete. Let's add 2 bags!
      let currentComplete = parseFloat(document.getElementById('simComplete').value);
      document.getElementById('simComplete').value = currentComplete + 2;
    }

    // Re-run the simulation so the charts update with the new yield and costs
    this.runSimulation();
  }
};