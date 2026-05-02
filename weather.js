export const WeatherController = {
    // 🛑 GET YOUR FREE KEY FROM OPENWEATHERMAP.ORG AND PASTE IT HERE:
    apiKey: '46bb9a303b9cd3bfb09752260d50bcc8', 
    
    init: function() {
        // console.log("Initializing Weather Radar...");
        this.getLocationAndFetchWeather();
    },

    getLocationAndFetchWeather: function() {
        // Try to get the user's real GPS location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.fetchWeather(position.coords.latitude, position.coords.longitude);
                },
                (error) => {
                    console.warn("GPS Denied or unavailable. Using default location (Cateel, Davao).");
                    // Fallback coordinates for Cateel, Davao Region
                    this.fetchWeather(7.7850, 126.4468); 
                }
            );
        } else {
            // Browser doesn't support GPS
            this.fetchWeather(7.7850, 126.4468);
        }
    },

    fetchWeather: async function(lat, lon) {
        try {
            const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${this.apiKey}`);
            
            if (!response.ok) throw new Error("Weather API failed");
            
            const data = await response.json();
            this.updateUI(data);
            
        } catch (error) {
            console.error("Weather fetch error:", error);
            document.getElementById('weatherLocation').innerText = "Weather Unavailable";
            document.getElementById('weatherDescription').innerText = "Check your internet connection.";
        }
    },

    updateUI: function(data) {
        // Capitalize the description (e.g., "broken clouds" -> "Broken clouds")
        const desc = data.weather[0].description;
        const capitalizedDesc = desc.charAt(0).toUpperCase() + desc.slice(1);

        // Update the HTML we pasted earlier
        document.getElementById('weatherLocation').innerText = data.name;
        document.getElementById('weatherDescription').innerText = capitalizedDesc;
        // Round the temperature to a whole number
        document.getElementById('weatherTemp').innerText = `${Math.round(data.main.temp)}°C`;
    }
};