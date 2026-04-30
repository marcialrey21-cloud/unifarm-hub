import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import OpenAI from "npm:openai"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS Preflight requests
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 1. Extract the data from the frontend (Now including 'mode')
    const { imageBase64, lat, lng, mode } = await req.json()
    const aiKey = Deno.env.get('AZURE_API_KEY')
    const weatherKey = Deno.env.get('OPENWEATHER_API_KEY')

    // 2. Fetch Local Weather Context
    let weatherData = "Weather info unavailable";
    if (lat && lng && weatherKey) {
      try {
        const wRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${weatherKey}&units=metric`);
        const wJson = await wRes.json();
        weatherData = `${wJson.weather[0].description}, ${wJson.main.temp}°C, Hum: ${wJson.main.humidity}%`;
      } catch(e) { 
        console.error("Weather Fetch Fail"); 
      }
    }

    // 3. Setup Azure OpenAI Client
    const client = new OpenAI({
      baseURL: "https://marcialrey21-unifarmhub-resource.openai.azure.com/openai/v1",
      apiKey: aiKey,
      defaultHeaders: { 'api-key': aiKey }
    });

    // 4. 🟢 DYNAMIC PROMPT LOGIC
    let systemPrompt = "";

    if (mode === 'pest') {
        // --- PEST ID INSTRUCTIONS ---
        systemPrompt = `You are an expert agricultural entomologist. You must avoid misidentification at all costs.
Context: Weather is ${weatherData}.
Analyze this image of an insect or pest. 
1. Identify the species (place the insect name into the 'plantName' JSON fields). 
2. Explain the damage it typically causes to crops. 
3. Recommend specific, real-world chemical treatments (list the exact active ingredients, e.g., Imidacloprid, Spinosad) and biological controls to manage it effectively.

If you are unsure, state your confidence is low. DO NOT MOCK THE USER WITH GUESSED DATA.
If weather is risky for spraying, add a warning.

IMPORTANT FOR INVENTORY: For the 'inventoryNeeded' field, output ONLY ONE primary chemical active ingredient (e.g., "Imidacloprid"). Do not use commas, and do not list multiple items.

STRICT JSON OUTPUT ONLY:
{
  "plantName": {"english": "...", "scientific": "...", "common": "...", "local": "..."},
  "diagnosisTitle": "...",
  "confidence": 95,
  "treatment": "...",
  "weatherWarning": "...",
  "inventoryNeeded": "..."
}`;
    } else {
        // --- PLANT HEALTH INSTRUCTIONS ---
        systemPrompt = `You are a Senior Agronomist. You must avoid misidentification at all costs.
Context: Weather is ${weatherData}.
Compare the specimen against these botanical markers:
1. EGGPLANT (Talong): Look for a broad, slightly fuzzy leaf with wavy or lobed edges. Even if elongated, look for the 'midrib' and veins that branching out in a 'pinnate' pattern.
2. BANANA (Saging): Look for a smooth, waxy surface with 'parallel' venation (veins running straight to the edge). Bananas DO NOT have lobed edges.
3. PECHAY: Look for the distinct white, fleshy stalk (petiole).
DIAGNOSIS RULE: If the leaf is an Eggplant with yellowing and holes, do not suggest Banana diseases like Sigatoka. Look for Eggplant-specific issues like 'Cercospora Leaf Spot' or 'Spider Mites'.

If you are unsure, state your confidence is low. DO NOT MOCK THE USER WITH GUESSED DATA.
Identify the plant/disease. If weather is risky for spraying, add a warning.
IMPORTANT FOR INVENTORY: For the 'inventoryNeeded' field, output ONLY ONE primary chemical active ingredient (e.g., "Tricyclazole"). Do not use commas, and do not list multiple items.
STRICT JSON OUTPUT ONLY:
{
  "plantName": {"english": "...", "scientific": "...", "common": "...", "local": "..."},
  "diagnosisTitle": "...",
  "confidence": 95,
  "treatment": "...",
  "weatherWarning": "...",
  "inventoryNeeded": "..."
}`;
    }

    // 5. Send Request to Azure
    const response = await client.chat.completions.create({
      model: "gpt-4o-1",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this image based on your system instructions. Provide ONLY the JSON." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
          ]
        }
      ],
      temperature: 0.1
    });

    // 6. THE JSON GUARD: Extract only the valid JSON part
    const rawContent = response.choices[0].message?.content || "";
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : rawContent;

    // 7. Return the data to the app
    return new Response(cleanJson, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Function Error:", error);
    // Return a safe error structure that won't break the frontend JSON parser
    return new Response(
      JSON.stringify({ 
        error: true, 
        message: error.message || "An unknown error occurred during analysis." 
      }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})