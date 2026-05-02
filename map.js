import { supabaseClient } from './db.js';
import { AppState } from './state.js';

export const MapController = {
    map: null,
    markers: [],
    allScans: [], // 🟢 NEW: Stores our database records locally for instant filtering
    isFirstRender: true, // 🟢 NEW: Prevents the map from jumping around when sliding

    init: function() {
        setTimeout(() => {
            const mapContainer = document.getElementById('outbreakMap');
            
            if (!mapContainer) return; 

            mapContainer.style.display = "block";
            mapContainer.style.height = "600px";
            mapContainer.style.minHeight = "600px";
            mapContainer.style.width = "100%";
            mapContainer.style.position = "relative";
            mapContainer.style.backgroundColor = "#e2e8f0"; 
            mapContainer.style.border = "1px solid #cbd5e1"; 
            mapContainer.style.borderRadius = "8px";
            mapContainer.style.marginTop = "15px";

            if (this.map) {
                this.map.invalidateSize();
                this.fetchAndPlotScans(); 
                return;
            }

            // console.log("Initializing Map Engine...");
            
            this.map = L.map('outbreakMap').setView([7.7944, 126.4531], 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap'
            }).addTo(this.map);

            // 🟢 NEW: Create the interactive slider control and add it to the map
            this.createSliderControl();

            setTimeout(() => {
                this.map.invalidateSize();
                this.fetchAndPlotScans();
            }, 100);

        }, 300); 
    },

    // 🟢 NEW: Builds the slider UI directly inside the map window
    createSliderControl: function() {
        const FilterControl = L.Control.extend({
            options: { position: 'topright' }, // Places it safely in the corner
            onAdd: function (map) {
                const div = L.DomUtil.create('div', 'info legend');
                
                // Style our control panel
                div.style.backgroundColor = 'white';
                div.style.padding = '12px';
                div.style.borderRadius = '8px';
                div.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
                div.style.fontFamily = 'Arial, sans-serif';
                div.style.textAlign = 'center';

                // Build the HTML for the slider
                div.innerHTML = `
                    <label style="font-weight:bold; font-size: 13px; color: #333;">Time Filter</label><br>
                    <input type="range" id="daysFilter" min="0" max="30" value="30" 
                           style="width: 150px; cursor: pointer; margin: 8px 0;"><br>
                    <span id="daysLabel" style="font-size: 12px; color: #666; font-weight: bold;">Showing: All Time</span>
                `;
                
                // Prevent dragging the map when the user tries to drag the slider
                L.DomEvent.disableClickPropagation(div);
                return div;
            }
        });

        this.map.addControl(new FilterControl());

        // Wire up the slider so it actively filters when moved
        setTimeout(() => {
            const slider = document.getElementById('daysFilter');
            const label = document.getElementById('daysLabel');
            
            if (slider) {
                slider.addEventListener('input', (e) => {
                    const days = parseInt(e.target.value);
                    
                    // Update the text label based on slider position
                    if (days === 30) {
                        label.innerText = "Showing: All Time";
                    } else if (days === 0) {
                        label.innerText = "Showing: Today Only";
                    } else {
                        label.innerText = `Showing: Last ${days} Days`;
                    }
                    
                    // Instantly re-render the map using our local memory
                    MapController.renderMarkers(days); 
                });
            }
        }, 500); // Slight delay to ensure the DOM element is rendered
    },

    // 🟢 UPDATED: Fetches data ONCE, stores it, and triggers the first render
    fetchAndPlotScans: async function() {
        if (!this.map) return; 

        const userId = AppState?.user?.id;
        if (!userId) {
            console.warn("No user logged in. Waiting to fetch map data.");
            return;
        }

        // console.log("Fetching agricultural records from Supabase Cloud...");

        const { data: log, error } = await supabaseClient
            .from('field_logs')
            .select('*')
            .eq('user_id', userId); 

        if (error) {
            console.error("Error fetching cloud data:", error.message);
            return;
        }

        // console.log(`Successfully downloaded ${log.length} cloud records.`);
        
        // Save to local memory for instant slider filtering
        this.allScans = log; 
        
        // Render the markers (passing 30 as default for "All Time")
        this.renderMarkers(30); 
    },

    // 🟢 NEW: The standalone render function that the slider talks to
    renderMarkers: function(maxDays) {
        // Clear existing markers from the map
        this.markers.forEach(m => this.map.removeLayer(m));
        this.markers = [];

        const bounds = L.latLngBounds();
        const now = new Date();

        this.allScans.forEach(record => {
            if (record.lat && record.lng) {
                
                const recordDate = record.created_at ? new Date(record.created_at) : now;
                const daysOld = Math.floor((now - recordDate) / (1000 * 60 * 60 * 24));

                // 🛑 THE FILTER ENGINE: Skip this pin if it's older than our slider setting!
                // (Unless slider is at 30, which we treat as "All Time")
                if (maxDays < 30 && daysOld > maxDays) {
                    return; 
                }

                let currentOpacity = 0.9;
                if (daysOld > 7) currentOpacity = 0.5;   
                if (daysOld > 30) currentOpacity = 0.2;  

                const marker = L.circleMarker([record.lat, record.lng], {
                    radius: 12, 
                    fillColor: record.color || "#d32f2f", 
                    color: "#ffffff",
                    weight: 3,
                    opacity: currentOpacity,
                    fillOpacity: currentOpacity
                }).addTo(this.map);

                const displayDate = recordDate.toLocaleDateString();
                const ageText = daysOld === 0 ? '(Today)' : `(${daysOld} days ago)`;
                const plantName = record.plantlocal || record.plantLocal || 'Farm Record';

                marker.bindPopup(`
                    <div style="font-family: Arial, sans-serif; min-width: 150px;">
                        <h4 style="margin:0; color:#1e293b;">${plantName}</h4>
                        <p style="margin:5px 0; color:${record.color || '#d32f2f'}; font-weight:bold;">${record.diagnosis || 'Field Scan'}</p>
                        <hr style="border:0; border-top:1px solid #eee;">
                        <small style="color:#64748b;">${displayDate} ${ageText}</small>
                    </div>
                `);
                
                this.markers.push(marker);
                bounds.extend([record.lat, record.lng]);
            }
        });

        // Gently pan/zoom to fit the pins, but ONLY on the first load.
        // We don't want the camera violently jumping around while you drag the slider!
        if (this.isFirstRender && bounds.isValid()) {
            this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
            this.isFirstRender = false;
        }
    }
};