import { SimulatorController } from './simulator.js';
import { InventoryController } from './inventory.js';

export const ScannerController = {
  stream: null,
  currentInventoryNeeded: null, // Stores what GPT says we need (e.g., "Fungicide")
  currentDiagnosisId: null, // Used for the simulator
  
  // 🟢 NEW: Track the current scanner mode! Defaults to 'plant'
  currentMode: 'plant', 
  
  // 🟢 YOUR NEW SECURE CLOUD BRIDGE URL
  edgeFunctionUrl: "https://bniwmsoxyuchuoaqjjxo.supabase.co/functions/v1/analyze-crop",

  init: async function() {
    // 1. INTRODUCE ALL BUTTONS FIRST
    const btnStart = document.getElementById('btnStartCamera');
    const btnScan = document.getElementById('btnScanLeaf');
    const btnRetake = document.getElementById('btnRetake');
    const btnApply = document.getElementById('btnApplyPrescription');
    const btnHistory = document.getElementById('btnViewHistory');
    const closeHistory = document.getElementById('closeHistoryBtn');
    const clearHistory = document.getElementById('clearHistoryBtn');
    const btnSpeak = document.getElementById('btnSpeak');
    const btnPlant = document.getElementById('btnModePlant');
    const btnPest = document.getElementById('btnModePest');
    
    // Introduce Payment buttons
    const closePayBtn = document.getElementById('closePaymentBtn');
    const mockPayBtn = document.getElementById('mockPayBtn');
    const paymentModal = document.getElementById('paymentModal');

    // 2. PAYMENT MODAL LISTENERS
    if (closePayBtn) {
        closePayBtn.addEventListener('click', () => {
            paymentModal.style.display = 'none';
        });
    }

    if (mockPayBtn) {
        mockPayBtn.addEventListener('click', async () => {
            // Show processing state
            document.getElementById('payBtnText').style.display = 'none';
            document.getElementById('payBtnLoader').style.display = 'inline';
            mockPayBtn.disabled = true;
            mockPayBtn.style.backgroundColor = '#94a3b8';

            try {
                // 1. Get the currently logged-in user's ID securely from Supabase
                const { data: authData } = await supabase.auth.getUser();
                
                // Safety check: Ensure the app found a logged-in user
                if (!authData || !authData.user) {
                    throw new Error("You must be logged in to purchase scans.");
                }
                
                const currentUserId = authData.user.id;

                // Request a secure payment link from Supabase
                const paymentFunctionUrl = "https://bniwmsoxyuchuoaqjjxo.supabase.co/functions/v1/create-scan-payment";
                
                const response = await fetch(paymentFunctionUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuaXdtc294eXVjaHVvYXFqanhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NTI4NjUsImV4cCI6MjA5MDEyODg2NX0.51_ZCjfKARxqw8pDOIoTQ4e_nxXWG8W-0XSgVVnktKc'
                    },
                    // 2. Send the user ID inside the body of the request!
                    body: JSON.stringify({ userId: currentUserId }) 
                });

                const data = await response.json();

                if (data.checkoutUrl) {
                    // Success! Redirect the user directly to the PayMongo checkout page
                    window.location.href = data.checkoutUrl;
                } else {
                    throw new Error("Could not generate the payment link.");
                }

            } catch (error) {
                console.error("Payment Error:", error);
                alert("We couldn't connect to the payment processor or verify your account. Please check your internet connection and ensure you are logged in.");
                
                // Reset the button if it fails so they can try again
                document.getElementById('payBtnText').style.display = 'inline';
                document.getElementById('payBtnLoader').style.display = 'none';
                mockPayBtn.disabled = false;
                mockPayBtn.style.backgroundColor = '#005ce6';
            }
        });
    }

    // 3. SCANNER & CAMERA LISTENERS
    if (btnPlant) btnPlant.addEventListener('click', () => this.switchMode('plant'));
    if (btnPest) btnPest.addEventListener('click', () => this.switchMode('pest'));

    if (btnSpeak) btnSpeak.addEventListener('click', () => {
        if (this.lastResult) {
                this.speakDiagnosis(this.lastResult);
        } else {
            alert("Please scan an item first!");
        }
    });

    if(btnStart) btnStart.addEventListener('click', () => this.startCamera());
    if(btnScan) btnScan.addEventListener('click', () => this.captureAndScan());
    if(btnRetake) btnRetake.addEventListener('click', () => this.resetScanner());
    if(btnApply) btnApply.addEventListener('click', () => this.applyTreatment());
    if(btnHistory) btnHistory.addEventListener('click', () => this.openHistory());
    if(closeHistory) closeHistory.addEventListener('click', () => {
      document.getElementById('historyModal').style.setProperty('display', 'none', 'important');
    });
    
  }, // <-- The critical closing stitch is perfectly in place here!

  // ==========================================
  // 🟢 NEW: FREEMIUM WALLET LOGIC
  // ==========================================
  checkScanLimit: function() {
    // Look in the phone's local storage for their wallet, or create a new one
    let scanUsage = JSON.parse(localStorage.getItem('uniFarmScannerWallet')) || { 
        freeScansUsed: 0, 
        paidScansRemaining: 0 
    };

    // 1. First Priority: Check if they have purchased paid scans available
    if (scanUsage.paidScansRemaining > 0) {
        scanUsage.paidScansRemaining--;
        localStorage.setItem('uniFarmScannerWallet', JSON.stringify(scanUsage));
        console.log("Paid scan used. Remaining balance:", scanUsage.paidScansRemaining);
        return true; // Tells the scanner to GO
    }

    // 2. Second Priority: Check if they still have their 3 free trial scans
    if (scanUsage.freeScansUsed < 3) {
        scanUsage.freeScansUsed++;
        localStorage.setItem('uniFarmScannerWallet', JSON.stringify(scanUsage));
        console.log("Free scan used. Total free scans used:", scanUsage.freeScansUsed, "/ 3");
        return true; // Tells the scanner to GO
    }

    // 3. The Paywall: If out of free scans AND out of paid scans
    const paymentModal = document.getElementById('paymentModal');
    if (paymentModal) {
        paymentModal.style.display = 'flex';
    }
    // Optional: Redirect them to your payment page when you build it
    // window.location.href = "checkout.html"; 
    
    return false; // Tells the scanner to STOP before Azure gets triggered
  },

  // Helper method for when you build the payment page
  addPaidScansToWallet: function(amount = 10) {
    let scanUsage = JSON.parse(localStorage.getItem('uniFarmScannerWallet')) || { freeScansUsed: 3, paidScansRemaining: 0 };
    scanUsage.paidScansRemaining += amount;
    localStorage.setItem('uniFarmScannerWallet', JSON.stringify(scanUsage));
    alert("Success! " + amount + " scans have been added to your Uni-Farm Hub account.");
  },
  // ==========================================


  switchMode: function(mode) {
    this.currentMode = mode;
    const btnPlant = document.getElementById('btnModePlant');
    const btnPest = document.getElementById('btnModePest');
    const btnScan = document.getElementById('btnScanLeaf'); 
    
    if (mode === 'plant') {
        btnPlant.style.background = '#4CAF50';
        btnPlant.style.color = 'white';
        btnPest.style.background = 'white';
        btnPest.style.color = '#FF9800';
        
        if (btnScan) btnScan.innerText = "Scan Leaf";
    } else {
        btnPest.style.background = '#FF9800';
        btnPest.style.color = 'white';
        btnPlant.style.background = 'white';
        btnPlant.style.color = '#4CAF50';
        
        if (btnScan) btnScan.innerText = "Scan Pest";
    }
  },

  startCamera: async function() {
    const video = document.getElementById('cameraFeed');
    const canvas = document.getElementById('photoCanvas');
    const btnStart = document.getElementById('btnStartCamera');
    const btnScan = document.getElementById('btnScanLeaf');

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      video.srcObject = this.stream;
      video.style.display = 'block';
      canvas.style.display = 'none';
      
      btnStart.style.display = 'none';
      btnScan.style.display = 'block';
      
    } catch (err) {
      console.error("Camera error:", err);
      alert("Could not access camera. Please check permissions or try on a mobile device.");
    }
  },

  stopCamera: function() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  },

  captureAndScan: function() {
    // 🛡️ NEW: RUN THE FREEMIUM CHECK FIRST!
    // If this returns false, the function stops immediately and Azure is saved.
    if (!this.checkScanLimit()) {
        return; 
    }

    const video = document.getElementById('cameraFeed');
    const canvas = document.getElementById('photoCanvas');
    const scannerBox = document.getElementById('scannerBox');
    const btnScan = document.getElementById('btnScanLeaf');
    const btnRetake = document.getElementById('btnRetake');
    const resultCard = document.getElementById('aiResultCard');

    // 1. SNAP THE PHOTO 
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // 2. FREEZE THE FRAME
    video.style.display = 'none';
    canvas.style.display = 'block';
    
    // Swap buttons
    btnScan.style.display = 'none';
    btnRetake.style.display = 'block';
    btnRetake.disabled = true;

    // 3. START THE SCANNING ANIMATION
    scannerBox.classList.add('scanning-active');
    
    // Setup Result Card
    document.getElementById('aiDiagnosisTitle').innerText = "Transmitting to Azure AI...";
    document.getElementById('aiDiagnosisTitle').style.color = "#1e293b";
    
    const loadingText = this.currentMode === 'plant' 
      ? "Analyzing environmental context and visual symptoms..." 
      : "Identifying insect species and analyzing pest threats...";
    document.getElementById('aiRecommendation').innerText = loadingText;
    
    resultCard.style.display = 'block';
    resultCard.style.borderLeftColor = "#94a3b8";

    // 4. TRIGGER REAL AI ENGINE
    this.deliverAIResult();
  },

  deliverAIResult: async function() {
    const scannerBox = document.getElementById('scannerBox');
    const btnRetake = document.getElementById('btnRetake');
    const resultCard = document.getElementById('aiResultCard');
    const canvas = document.getElementById('photoCanvas');

    // The Offline Guard
    if (!navigator.onLine) {
        if (scannerBox) scannerBox.classList.remove('scanning-active');
        if (btnRetake) btnRetake.disabled = false;
        
        document.getElementById('aiDiagnosisTitle').innerText = "📡 No Connection";
        document.getElementById('aiDiagnosisTitle').style.color = "#f59e0b";
        document.getElementById('aiRecommendation').innerText = "AI scanning requires an internet connection to reach the Azure Cloud. Please connect to Wi-Fi or cellular data to analyze this image.";
        
        if (resultCard) resultCard.classList.add('active');
        return; 
    }

    // 1. FIRST: CAPTURE GPS COORDINATES
    let lat = null;
    let lng = null;

    const getGPS = () => {
        return new Promise((resolve) => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => resolve({ lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5) }),
                    () => resolve({ lat: null, lng: null }),
                    { enableHighAccuracy: true, timeout: 5000 }
                );
            } else {
                resolve({ lat: null, lng: null });
            }
        });
    };

    try {
        const coords = await getGPS();
        lat = coords.lat;
        lng = coords.lng;

        if (lat) {
            const gpsStatus = document.getElementById('gpsStatus');
            if (gpsStatus) gpsStatus.style.display = 'inline';
        }

        // 2. CONVERT IMAGE TO BASE64
        const base64Image = canvas.toDataURL('image/jpeg', 1.0).split(',')[1];

        // 3. PING SUPABASE
        const response = await fetch(this.edgeFunctionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageBase64: base64Image,
                lat: lat,
                lng: lng,
                mode: this.currentMode
            })
        });

        if (!response.ok) throw new Error("Cloud bridge failed to respond.");
        const aiResult = await response.json();
        this.lastResult = aiResult;

        // 🛡️ SAFETY GUARDRAIL: Stop if AI is guessing
        if (aiResult.confidence < 90) {
            scannerBox.classList.remove('scanning-active');
            btnRetake.disabled = false;
            
            document.getElementById('aiDiagnosisTitle').innerText = "Uncertain Identification";
            document.getElementById('aiDiagnosisTitle').style.color = "#f59e0b"; 
            document.getElementById('aiRecommendation').innerText = "The image detail is insufficient for a professional diagnosis. To avoid a wrong treatment, please move closer, ensure the subject is clear, and rescan.";
            
            const identityCard = document.getElementById('plantIdentityCard');
            if (identityCard) identityCard.style.display = 'none';

            resultCard.classList.add('active');
            return; 
        }

        // 4. UPDATE UI
        const weatherBox = document.getElementById('weatherAlertBox');
        const identityCard = document.getElementById('plantIdentityCard');
        const speakBtn = document.getElementById('btnSpeak');
        const weatherText = document.getElementById('weatherText');

        if (aiResult.weatherWarning && weatherBox) {
            weatherBox.style.display = 'block';
            if (weatherText) weatherText.innerText = aiResult.weatherWarning;
        } else if (weatherBox) {
            weatherBox.style.display = 'none';    
        }

        if (aiResult.plantName && identityCard) {
            identityCard.style.display = 'block';
            if (speakBtn) speakBtn.style.display = 'flex';

            const eng = document.getElementById('plantEng');
            const sci = document.getElementById('plantSci');
            const com = document.getElementById('plantCom');
            const loc = document.getElementById('plantLoc');

            if (eng) eng.innerText = aiResult.plantName.english || 'N/A';
            if (sci) sci.innerText = aiResult.plantName.scientific || 'N/A';
            if (com) com.innerText = aiResult.plantName.common || 'N/A';
            if (loc) loc.innerText = aiResult.plantName.local || 'N/A';
        }

        const isHealthy = aiResult.diagnosisTitle.toLowerCase().includes('healthy');
        const uiColor = isHealthy ? "#2e7d32" : "#d32f2f";

        const diagTitle = document.getElementById('aiDiagnosisTitle');
        const diagRec = document.getElementById('aiRecommendation');
        const confBadge = document.getElementById('aiConfidenceBadge');

        if (diagTitle) {
            diagTitle.innerText = aiResult.diagnosisTitle;
            diagTitle.style.color = uiColor;
        }
        if (diagRec) diagRec.innerText = aiResult.treatment;
        if (confBadge) {
            confBadge.innerText = aiResult.confidence + '%';
            confBadge.style.color = uiColor;
        }
        if (resultCard) resultCard.style.borderLeftColor = uiColor;

        if (resultCard) resultCard.classList.add('active');
        if (scannerBox) {
            scannerBox.classList.remove('active');
            scannerBox.classList.remove('scanning-active');
        }
        if (btnRetake) btnRetake.disabled = false;

        const pdfBtn = document.getElementById('btnDownloadPDF');
        if (pdfBtn) {
            pdfBtn.style.display = 'block';
            pdfBtn.onclick = () => this.downloadPDF(aiResult);
        }

        // 5. SAVE TO LOG
        const scanRecord = {
            id: Date.now(),
            date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
            plantEnglish: aiResult.plantName ? aiResult.plantName.english : 'Unknown',
            plantLocal: aiResult.plantName ? aiResult.plantName.local : 'Unknown',
            diagnosis: aiResult.diagnosisTitle,
            confidence: aiResult.confidence,
            color: uiColor,
            lat: lat,
            lng: lng,
            mode: this.currentMode 
        };
        this.saveToDatabase(scanRecord);

    } catch (error) {
        console.error("AI Cloud Request Failed:", error);
        if (scannerBox) scannerBox.classList.remove('scanning-active');
        if (btnRetake) btnRetake.disabled = false;
        
        const diagTitle = document.getElementById('aiDiagnosisTitle');
        const diagRec = document.getElementById('aiRecommendation');
        if (diagTitle) {
            diagTitle.innerText = "Connection Error";
            diagTitle.style.color = "#d32f2f";
        }
        if (diagRec) diagRec.innerText = error.message;
        if (resultCard) {
            resultCard.style.borderLeftColor = "#d32f2f";
            resultCard.classList.add('active');
        }
    }
  },

  resetScanner: function() {
    document.getElementById('aiResultCard').style.display = 'none';
    document.getElementById('btnRetake').style.display = 'none';
    
    if (this.stream) {
      document.getElementById('cameraFeed').style.display = 'block';
      document.getElementById('photoCanvas').style.display = 'none';
      document.getElementById('btnScanLeaf').style.display = 'block';
    } else {
      document.getElementById('btnStartCamera').style.display = 'block';
      document.getElementById('photoCanvas').style.display = 'none';
    }
  },
  
  applyTreatment: async function() {
    this.stopCamera(); 

    if (this.lastResult && this.lastResult.inventoryNeeded && this.lastResult.inventoryNeeded.toLowerCase() !== 'none') {
        
        const itemToDeduct = this.lastResult.inventoryNeeded;
        const confirmDeduction = confirm(`The AI recommends applying: ${itemToDeduct}.\n\nWould you like to deduct 1 unit from your Inventory?`);

        if (confirmDeduction) {
            const success = await InventoryController.deductStock(itemToDeduct, 1);
            
            if (success) {
                alert(`Success! 1 unit of ${itemToDeduct} has been deducted from your inventory.`);
            } else {
                alert(`Could not deduct ${itemToDeduct}. Please check if you have it in stock in your Inventory tab.`);
                return; 
            }
        } 
    } else {
        alert("No specific inventory chemical was recommended for this scan.");
    }

    const inventoryNavBtn = document.getElementById('nav-inventory');
    if (inventoryNavBtn) {
        inventoryNavBtn.click();
    }
  },

  openHistory: function() {
    let existingModal = document.getElementById('dynamicHistoryModal');
    if (existingModal) existingModal.remove();

    const log = JSON.parse(localStorage.getItem('unifarm_field_log')) || [];
    let listHTML = '';

    if (log.length === 0) {
      listHTML = '<p style="text-align: center; color: #64748b; margin-top: 20px;">No scans recorded yet.</p>';
    } else {
      log.forEach(record => {
        const locationText = record.lat ? `📍 Lat: ${record.lat}, Lng: ${record.lng}` : `📍 Location Unavailable (Saved Offline)`;
        const icon = record.mode === 'pest' ? '🐛' : '🌱';
        
        listHTML += `
          <div style="border-left: 4px solid ${record.color}; background: #f8fafc; padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <strong style="color: #1e293b; font-size: 1rem;">${icon} ${record.diagnosis}</strong>
              <span style="font-size: 0.85rem; color: #64748b;">${record.date}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
              <span style="font-size: 0.85rem; color: #475569;">${locationText}</span>
              <span style="font-weight: bold; color: ${record.color}; font-size: 0.9rem;">${record.confidence}%</span>
            </div>
          </div>
        `;
      });
    }

    const modal = document.createElement('div');
    modal.id = 'dynamicHistoryModal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); z-index: 2147483647; display: flex; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box;';

    modal.innerHTML = `
      <div style="background: white; width: 100%; max-width: 500px; border-radius: 12px; padding: 20px; max-height: 80vh; display: flex; flex-direction: column; box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ccc; padding-bottom: 10px;">
          <h3 style="margin: 0; color: #1e293b;">📍 Historical Field Log</h3>
          <button id="dynamicCloseBtn" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #1e293b;">&times;</button>
        </div>
        <div style="overflow-y: auto; flex: 1; padding: 10px 0;">
          ${listHTML}
        </div>
        <button id="dynamicClearBtn" style="margin-top: 15px; background-color: #fee2e2; color: #d32f2f; border: 1px solid #f87171; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold;">🗑️ Clear Log</button>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('dynamicCloseBtn').addEventListener('click', () => {
      modal.remove(); 
    });
    
    document.getElementById('dynamicClearBtn').addEventListener('click', () => {
      if(confirm("Are you sure you want to delete all historical scan data?")) {
        localStorage.removeItem('unifarm_field_log');
        this.openHistory(); 
      }
    });
  },

  saveToDatabase: function(record) {
    let log = JSON.parse(localStorage.getItem('unifarm_field_log')) || [];
    log.unshift(record);
    localStorage.setItem('unifarm_field_log', JSON.stringify(log));
  },
  
  speakDiagnosis: function(data) {
    if (!('speechSynthesis' in window)) {
        alert("Sorry, your browser doesn't support voice features.");
        return;
    }

    window.speechSynthesis.cancel();

    const entityName = data.plantName.english;
    const local = data.plantName.local;
    const disease = data.diagnosisTitle;
    const treatment = data.treatment;

    const textToSay = `Identification: ${entityName}, locally known as ${local}. Diagnosis: ${disease}. Recommendation: ${treatment}`;

    const utterance = new SpeechSynthesisUtterance(textToSay);
    
    const voices = window.speechSynthesis.getVoices();
    const localVoice = voices.find(v => v.lang.includes('ph') || v.lang.includes('id')); 
    if (localVoice) utterance.voice = localVoice;

    utterance.pitch = 1;
    utterance.rate = 0.9; 
    
    window.speechSynthesis.speak(utterance);
  },
  
  downloadPDF: function(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFillColor(22, 101, 52); 
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text("UNIFARM HUB", 20, 20);
    doc.setFontSize(10);
    doc.text("Enterprise Agronomy & Field Report", 20, 30);

    doc.setTextColor(100);
    doc.setFontSize(9);
    const dateStr = new Date().toLocaleString();
    doc.text(`Report ID: ${Date.now()}`, 140, 50);
    doc.text(`Date: ${dateStr}`, 140, 55);

    doc.setTextColor(22, 101, 52);
    doc.setFontSize(16);
    doc.text("IDENTIFICATION", 20, 65);
    
    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text(`English Name: ${data.plantName.english}`, 25, 75);
    doc.text(`Local Name: ${data.plantName.local}`, 25, 82);
    doc.text(`Scientific Name: ${data.plantName.scientific}`, 25, 89);

    doc.setTextColor(22, 101, 52);
    doc.setFontSize(16);
    doc.text("DIAGNOSIS & HEALTH", 20, 105);
    
    doc.setTextColor(185, 28, 28); 
    doc.setFontSize(14);
    doc.text(`${data.diagnosisTitle}`, 25, 115);
    doc.setFontSize(10);
    doc.text(`Confidence Score: ${data.confidence}%`, 25, 122);

    doc.setTextColor(22, 101, 52);
    doc.setFontSize(16);
    doc.text("TREATMENT PLAN", 20, 140);
    
    doc.setTextColor(0);
    doc.setFontSize(11);
    const splitTreatment = doc.splitTextToSize(data.treatment, 160);
    doc.text(splitTreatment, 25, 150);

    if (data.weatherWarning) {
        doc.setFillColor(255, 247, 237); 
        doc.rect(20, 200, 170, 20, 'F');
        doc.setTextColor(154, 52, 18);
        doc.setFontSize(10);
        const splitWeather = doc.splitTextToSize(`WEATHER ADVISORY: ${data.weatherWarning}`, 160);
        doc.text(splitWeather, 25, 208);
    }

    doc.setTextColor(150);
    doc.setFontSize(8);
    doc.text("This report was generated by Unifarm Hub AI. Diagnosis is based on visual analysis.", 20, 285);

    doc.save(`Unifarm_Report_${data.plantName.local}_${Date.now()}.pdf`);
  }
};