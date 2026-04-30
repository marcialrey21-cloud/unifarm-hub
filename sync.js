import { supabaseClient } from './db.js';
import { AppState } from './state.js';

export const SyncController = {
  init: function() {
    console.log("Cloud Sync Engine initialized.");
    
    // 1. Keep your existing manual sync button
    const syncBtn = document.getElementById('btnSyncData');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        this.syncLocalToCloud(false); // 'false' means it is a manual sync (show alerts)
      });
    }

    // 2. 🟢 ENTERPRISE UPGRADE: The Background Auto-Sync Listener
    // This listens to the browser/device network status. 
    // The moment the internet connects, it fires the sync automatically!
    window.addEventListener('online', () => {
      console.log("Network connection restored! Attempting background sync...");
      // Check if there is actually data to sync before running
      const rawData = localStorage.getItem('unifarm_field_log');
      const localLog = JSON.parse(rawData) || [];
      
      if (localLog.length > 0) {
        this.syncLocalToCloud(true); // 'true' means it is an auto-sync (silent mode)
      }
    });
  },

  // Added 'isAutoSync' parameter. Defaults to false so manual clicks still show alerts.
  syncLocalToCloud: async function(isAutoSync = false) {
    // 1. Check if the user is actually logged in
    const userId = AppState?.user?.id;
    if (!userId) {
      if (!isAutoSync) alert("You must be logged in to sync data to the cloud.");
      return;
    }

    // 2. Grab the offline data from the phone's memory
    const rawData = localStorage.getItem('unifarm_field_log');
    const localLog = JSON.parse(rawData) || [];

    if (localLog.length === 0) {
      if (!isAutoSync) alert("Your offline storage is empty! No data to sync.");
      return;
    }

    // 3. Update the UI to show the user we are working
    const syncBtn = document.getElementById('btnSyncData');
    const syncText = document.getElementById('syncText');
    
    if (syncBtn && syncText) {
        syncBtn.disabled = true;
        syncBtn.style.opacity = "0.7";
        syncText.innerText = `Syncing ${localLog.length} records...`;
    }

    console.log(`Preparing to sync ${localLog.length} records to Supabase...`);

    // 4. Format the local data so Supabase accepts it perfectly
    const payload = localLog.map(record => {
      return {
        user_id: userId,
        lat: record.lat,
        lng: record.lng,
        diagnosis: record.diagnosis || "Unknown",
        plantLocal: record.plantLocal || record.plantlocal || "Farm Record",
        color: record.color || "#d32f2f"
      };
    });

    try {
        // 5. Blast the data up to the Supabase Cloud
        const { error } = await supabaseClient
          .from('field_logs')
          .insert(payload);

        if (error) throw error;

        // 6. SUCCESS! Clear the phone's local memory to prevent duplicates
        localStorage.removeItem('unifarm_field_log');

        // 7. Update UI to show success
        if (syncBtn && syncText) {
            syncBtn.style.backgroundColor = "#16a34a"; // Turn button green
            syncText.innerText = "Sync Complete!";
            
            setTimeout(() => {
                syncBtn.disabled = false;
                syncBtn.style.opacity = "1";
                syncBtn.style.backgroundColor = "#0284c7"; // Back to default blue
                syncText.innerText = "Sync Offline Data to Cloud";
            }, 3000); // Reset button after 3 seconds
        }

        // Show a non-intrusive toast notification if available, otherwise only alert if manual
        if (typeof UIController !== 'undefined' && UIController.showToast) {
            UIController.showToast(`Success! ${localLog.length} field scans backed up.`, 'success');
        } else if (!isAutoSync) {
            alert(`Success! ${localLog.length} field scans have been safely backed up to your cloud account.`);
        } else {
            console.log(`Auto-Sync Success! ${localLog.length} records backed up silently.`);
        }

    } catch (error) {
        // Handle the result on failure
        console.error("Sync Error:", error.message);
        
        if (syncBtn && syncText) {
            syncBtn.disabled = false;
            syncBtn.style.opacity = "1";
            syncText.innerText = "Sync Offline Data to Cloud";
        }

        if (!isAutoSync) {
            alert("Failed to sync data to the cloud. Please check your connection.");
        }
    }
  }
};