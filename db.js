// --- APP CONFIGURATION & CLOUD CONNECTION ---
export const AppConfig = {
  supabaseUrl: 'https://bniwmsoxyuchuoaqjjxo.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuaXdtc294eXVjaHVvYXFqanhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NTI4NjUsImV4cCI6MjA5MDEyODg2NX0.51_ZCjfKARxqw8pDOIoTQ4e_nxXWG8W-0XSgVVnktKc',
  chartPalette: ['#2e7d32', '#4caf50', '#81c784', '#c8e6c9', '#fbc02d', '#f57f17']
};
export const supabaseClient = window.supabase.createClient(AppConfig.supabaseUrl, AppConfig.supabaseKey);