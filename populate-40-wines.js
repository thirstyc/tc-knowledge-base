// Uses the shared client rather than building its own. A second service-role
// client in this repo is a second way to reach the app's tables without the
// ownership guard in lib/supabase.mjs seeing it, which is the whole point of
// having the guard. This script only writes `regions` (pipeline-owned), so
// routing it through changes nothing about what it does.
import { supabase } from "./lib/supabase.mjs";

const regions = [
  { name: "Tuscany", country: "Italy", is_appellation: false, obsidian_file: "region-italy-central" },
  { name: "Rioja", country: "Spain", is_appellation: false, obsidian_file: "region-spain-north" },
  { name: "Burgundy", country: "France", is_appellation: false, obsidian_file: "region-burgundy" },
  { name: "Loire Valley", country: "France", is_appellation: false, obsidian_file: "region-loire" },
  { name: "Rhône Valley", country: "France", is_appellation: false, obsidian_file: "region-rhone" },
  { name: "Languedoc-Roussillon", country: "France", is_appellation: false, obsidian_file: "region-languedoc-roussillon" },
  { name: "Beaujolais", country: "France", is_appellation: false, obsidian_file: "region-beaujolais-provence-southwest" },
  { name: "Douro", country: "Portugal", is_appellation: false, obsidian_file: "region-portugal-port-madeira" },
  { name: "Piedmont", country: "Italy", is_appellation: false, obsidian_file: "region-italy-northwest" },
  { name: "Mendoza", country: "Argentina", is_appellation: false, obsidian_file: "region-south-america" },
  { name: "Central Valley", country: "Chile", is_appellation: false, obsidian_file: "region-south-america" },
  { name: "Barossa Valley", country: "Australia", is_appellation: false, obsidian_file: "region-australia" },
  { name: "Marlborough", country: "New Zealand", is_appellation: false, obsidian_file: "region-new-zealand" },
  { name: "Swartland", country: "South Africa", is_appellation: false, obsidian_file: "region-south-africa" },
  { name: "Okanagan Valley", country: "Canada", is_appellation: false, obsidian_file: "region-canada" },
];

const importers = [
  { name: "Sélections Oeno Inc", country: "Canada", specialty: "Rhône, Loire, Burgundy", relationship_stage: "PREFERRED" },
  { name: "Univins et spiritueux Inc", country: "Canada", specialty: "Italy, Spain, Portugal", relationship_stage: "ACTIVE" },
  { name: "Noble Sélection", country: "Canada", specialty: "Italy, Tuscany", relationship_stage: "PREFERRED" },
  { name: "Vins Balthazard Inc", country: "Canada", specialty: "Loire, Languedoc, Burgundy", relationship_stage: "ACTIVE" },
];

const producers = [
  { name: "Altesino", country: "Italy", region_name: "Tuscany", philosophy: "Traditional, structured", quality_tier: "EXEMPLARY", is_curated: true },
  { name: "Argiano", country: "Italy", region_name: "Tuscany", philosophy: "Modern, ripe fruit", quality_tier: "EXEMPLARY", is_curated: true },
  { name: "Carpineto", country: "Italy", region_name: "Tuscany", philosophy: "Traditional Chianti", quality_tier: "STANDARD", is_curated: true },
];

const wines = [
  { name: "Altesino Brunello di Montalcino 2020", producer_name: "Altesino", region_name: "Tuscany", vintage: 2020, colour: "red", appellation: "Brunello di Montalcino", varietal_blend: [{ grape: "Sangiovese", pct: 100 }], is_curated: true, curation_reason: "Traditional, structured — teaches Sangiovese excellence" },
  { name: "Argiano Rosso di Montalcino 2024", producer_name: "Argiano", region_name: "Tuscany", vintage: 2024, colour: "red", appellation: "Rosso di Montalcino", varietal_blend: [{ grape: "Sangiovese", pct: 100 }], is_curated: true, curation_reason: "Modern, riper — shows how producers are shifting" },
  { name: "Carpineto Chianti Classico Riserva 2020", producer_name: "Carpineto", region_name: "Tuscany", vintage: 2020, colour: "red", appellation: "Chianti Classico", varietal_blend: [{ grape: "Sangiovese", pct: 80 }], is_curated: true, curation_reason: "Entry point, accessible structure" },
];

async function populate() {
  console.log("🍷 Populating database...\n");
  
  const regionMap = {};
  for (const region of regions) {
    const { data, error } = await supabase.from("regions").insert([region]).select("id, name");
    if (!error && data && data.length > 0) {
      regionMap[region.name] = data[0].id;
      console.log(`✓ Region: ${region.name}`);
    } else if (error) {
      console.log(`⚠ Region "${region.name}" error or already exists`);
    }
  }
  
  console.log("\n✅ Database population started!");
}

await populate().catch(err => console.error("❌ Error:", err));
