export const SandboxController = {
    init: function() {
        // console.log("Sandbox initialized.");
        this.bindEvents();
        this.calculate(); // Run once on load
    },

    bindEvents: function() {
        const sliders = document.querySelectorAll('.sandbox-slider');
        sliders.forEach(slider => {
            slider.addEventListener('input', (e) => {
                // Update the little text label next to the slider
                document.getElementById(e.target.id + 'Val').innerText = e.target.value + '%';
                // Recalculate everything
                this.calculate();
            });
        });
    },

    calculate: function() {
        // 1. Get values from sliders
        const corn = parseFloat(document.getElementById('sbCorn').value);
        const sbm = parseFloat(document.getElementById('sbSbm').value);
        const bran = parseFloat(document.getElementById('sbBran').value);

        // Prices per kg (Mock data for sandbox)
        const priceCorn = 15;
        const priceSbm = 35;
        const priceBran = 12;

        // 2. Perform Math
        const totalInclusion = corn + sbm + bran;
        const protein = (corn * 0.08) + (sbm * 0.48) + (bran * 0.13);
        const totalCost = (corn * priceCorn) + (sbm * priceSbm) + (bran * priceBran);
        const costPerKg = totalCost / 100;

        // 3. Update UI
        const totalEl = document.getElementById('sbTotal');
        const warningEl = document.getElementById('sbWarning');
        
        totalEl.innerText = totalInclusion + '%';
        document.getElementById('sbProtein').innerText = protein.toFixed(2) + '%';
        document.getElementById('sbCost').innerText = '₱' + costPerKg.toFixed(2);

        // Handle the 100% Warning Logic
        if (totalInclusion !== 100) {
            totalEl.style.color = '#d32f2f'; // Red
            warningEl.style.display = 'block';
        } else {
            totalEl.style.color = '#2E7D32'; // Green
            warningEl.style.display = 'none';
        }
    }
};