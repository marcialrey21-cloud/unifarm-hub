export const FCRController = {
    init: function() {
        console.log("FCR & Profit Tracker initialized.");
        this.bindEvents();
    },

    bindEvents: function() {
        const calcBtn = document.getElementById('btnCalculateFCR');
        if (calcBtn) {
            calcBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.calculateMetrics();
            });
        }
    },

    calculateMetrics: function() {
        // 1. Gather all inputs
        const headcount = parseFloat(document.getElementById('fcrHeadcount').value) || 0;
        const animalCost = parseFloat(document.getElementById('fcrAnimalCost').value) || 0;
        const mortality = parseFloat(document.getElementById('fcrMortality').value) || 0;
        const totalFeed = parseFloat(document.getElementById('fcrTotalFeed').value) || 0;
        const harvestWeight = parseFloat(document.getElementById('fcrHarvestWeight').value) || 0;
        const feedCost = parseFloat(document.getElementById('fcrFeedCost').value) || 0;
        const sellingPrice = parseFloat(document.getElementById('fcrSellingPrice').value) || 0;

        // Prevent division by zero
        if (harvestWeight <= 0) {
            alert("Harvest Weight must be greater than 0 to calculate FCR.");
            return;
        }

        // 2. Perform the Math
        const fcr = totalFeed / harvestWeight;
        const totalAnimalCost = headcount * animalCost;
        const totalFeedCost = totalFeed * feedCost;
        const totalProductionCost = totalAnimalCost + totalFeedCost;
        
        const totalRevenue = harvestWeight * sellingPrice;
        const netProfit = totalRevenue - totalProductionCost;
        const breakEvenCostPerKg = totalProductionCost / harvestWeight;
        const profitPerKg = sellingPrice - breakEvenCostPerKg;

        // 3. Update the UI
        this.updateUI(fcr, totalProductionCost, totalRevenue, netProfit, profitPerKg);
    },

    updateUI: function(fcr, totalCost, revenue, netProfit, profitPerKg) {
        // Show the results panel
        document.getElementById('fcrResults').style.display = 'block';

        // Format Currency
        const formatMoney = (amount) => '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Display basic numbers
        document.getElementById('resFCR').innerText = fcr.toFixed(2);
        document.getElementById('fcrResTotalCost').innerText = formatMoney(totalCost);
        document.getElementById('resRevenue').innerText = formatMoney(revenue);
        
        // Handle Profit Styling (Green for profit, Red for loss)
        const profitEl = document.getElementById('resNetProfit');
        const profitKgEl = document.getElementById('resProfitPerKg');
        profitEl.innerText = formatMoney(netProfit);
        profitKgEl.innerText = formatMoney(profitPerKg);
        
        if (netProfit >= 0) {
            profitEl.style.color = '#2E7D32'; // Green
            profitKgEl.style.color = '#2E7D32';
        } else {
            profitEl.style.color = '#c62828'; // Red
            profitKgEl.style.color = '#c62828';
        }

        // Handle FCR Status Badge
        const statusEl = document.getElementById('resFCRStatus');
        if (fcr < 1.5) {
            statusEl.innerText = "Excellent Efficiency";
            statusEl.style.backgroundColor = '#e8f5e9';
            statusEl.style.color = '#2e7d32';
        } else if (fcr <= 2.0) {
            statusEl.innerText = "Average Efficiency";
            statusEl.style.backgroundColor = '#fff3e0';
            statusEl.style.color = '#ef6c00';
        } else {
            statusEl.innerText = "Poor - Check Feed/Health";
            statusEl.style.backgroundColor = '#ffebee';
            statusEl.style.color = '#c62828';
        }
    }
};