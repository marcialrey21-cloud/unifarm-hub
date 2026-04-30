// --- CENTRAL STATE MANAGER ---
export const AppState = {
  user: {
    id: null,
    ownerId: null,
    role: 'free'
  },
  inventory: {
    chartInstance: null
  },
  optimizer: {
    matrix: {},
    rawResults: null,
    baseWeight: 100,
    lastRecipe: [],
    lastFormulatedFeed: null,
    editingIngredient: null
  },
  ui: {
    speciesContext: 'poultry' // Replaces window.unifarm_species_context
  }
};