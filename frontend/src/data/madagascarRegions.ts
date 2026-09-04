export interface MadagascarRegion {
    name: string;
    capital: string;
    lat: number;
    lng: number;
    color: string;
  }
  
  // Les 24 régions administratives actuelles de Madagascar, à jour :
  // - 22 régions historiques (loi n°2004-001)
  // - Vatovavy-Fitovinany scindée en Vatovavy + Fitovinany (2021)
  // - Ambatosoa créée à partir du nord d'Analanjirofo (loi 2023, inaugurée 2025)
  //
  // `color` : teinte distincte par région pour le remplissage de la carte
  // (purement visuel, façon carte administrative classique).
  export const MADAGASCAR_REGIONS: MadagascarRegion[] = [
    { name: "Diana", capital: "Antsiranana", lat: -12.279, lng: 49.292, color: "#f472b6" },
    { name: "Sava", capital: "Sambava", lat: -14.266, lng: 50.173, color: "#facc15" },
    { name: "Sofia", capital: "Antsohihy", lat: -14.879, lng: 47.987, color: "#4ade80" },
    { name: "Boeny", capital: "Mahajanga", lat: -15.717, lng: 46.317, color: "#60a5fa" },
    { name: "Betsiboka", capital: "Maevatanana", lat: -16.933, lng: 46.833, color: "#c084fc" },
    { name: "Melaky", capital: "Maintirano", lat: -18.065, lng: 44.026, color: "#fb923c" },
    { name: "Alaotra-Mangoro", capital: "Ambatondrazaka", lat: -17.833, lng: 48.417, color: "#2dd4bf" },
    { name: "Analanjirofo", capital: "Fenoarivo Atsinanana", lat: -17.378, lng: 49.402, color: "#a3e635" },
    { name: "Ambatosoa", capital: "Maroantsetra", lat: -15.435, lng: 49.741, color: "#f87171" },
    { name: "Analamanga", capital: "Antananarivo", lat: -18.879, lng: 47.507, color: "#e879f9" },
    { name: "Bongolava", capital: "Tsiroanomandidy", lat: -18.767, lng: 46.05, color: "#38bdf8" },
    { name: "Itasy", capital: "Miarinarivo", lat: -19.0, lng: 46.767, color: "#fbbf24" },
    { name: "Atsinanana", capital: "Toamasina", lat: -18.147, lng: 49.395, color: "#818cf8" },
    { name: "Vakinankaratra", capital: "Antsirabe", lat: -19.866, lng: 47.033, color: "#34d399" },
    { name: "Amoron'i Mania", capital: "Ambositra", lat: -20.53, lng: 47.246, color: "#fb7185" },
    { name: "Vatovavy", capital: "Mananjary", lat: -21.23, lng: 48.344, color: "#22d3ee" },
    { name: "Fitovinany", capital: "Manakara", lat: -22.148, lng: 48.017, color: "#a78bfa" },
    { name: "Menabe", capital: "Morondava", lat: -20.283, lng: 44.317, color: "#fde047" },
    { name: "Haute Matsiatra", capital: "Fianarantsoa", lat: -21.454, lng: 47.086, color: "#4ade80" },
    { name: "Ihorombe", capital: "Ihosy", lat: -22.406, lng: 46.124, color: "#f472b6" },
    { name: "Atsimo-Atsinanana", capital: "Farafangana", lat: -22.817, lng: 47.833, color: "#60a5fa" },
    { name: "Atsimo-Andrefana", capital: "Toliara", lat: -23.35, lng: 43.667, color: "#c084fc" },
    { name: "Anosy", capital: "Tôlanaro", lat: -25.033, lng: 46.983, color: "#fb923c" },
    { name: "Androy", capital: "Ambovombe", lat: -25.174, lng: 46.086, color: "#2dd4bf" },
  ];