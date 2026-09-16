import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// =========================================================================
// TC Knowledge Processor: Obsidian → Supabase → knowledge.thirstyc.com
// =========================================================================

const SUPABASE_URL = "https://qcyzcjikyqnzvnvmfwtk.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const OBSIDIAN_DIR = "/Users/cathe/Documents/Thirsty Cunt/AI sommelier";

// =========================================================================
// Read Obsidian file
// =========================================================================
function readObsidianFile(folderName, fileName) {
  const filePath = path.join(OBSIDIAN_DIR, folderName, `${fileName}.md`);
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    console.error(`❌ Error reading ${folderName}/${fileName}:`, error.message);
    return null;
  }
}

// =========================================================================
// Parse Obsidian markdown into chunks
// =========================================================================
function parseMarkdownChunks(content, sourceFile) {
  const chunks = [];
  const sections = content.split(/^## /m);

  sections.forEach((section, index) => {
    if (section.trim().length > 0) {
      const lines = section.split("\n");
      const title = lines[0] || sourceFile;
      const body = lines.slice(1).join("\n").trim();

      chunks.push({
        source_doc: sourceFile,
        chunk_index: index,
        section_title: title,
        content: body,
        chunk_type: determineCategoryFromTitle(title),
        tags: extractTags(body),
        status: "draft",
      });
    }
  });

  return chunks;
}

// =========================================================================
// Determine category from title
// =========================================================================
function determineCategoryFromTitle(title) {
  if (title.includes("Philosophy") || title.includes("Teaching")) return "concept";
  if (title.includes("Old World") || title.includes("New World")) return "regional";
  if (title.includes("Food") || title.includes("Pairing")) return "pairing";
  if (title.includes("Tasting") || title.includes("How to")) return "technique";
  return "knowledge";
}

// =========================================================================
// Extract tags from content
// =========================================================================
function extractTags(content) {
  const tagMatches = content.match(/\[\[(.*?)\]\]/g) || [];
  return tagMatches.map((tag) => tag.replace(/\[\[|\]\]/g, ""));
}

// =========================================================================
// Enrich grape page with Supabase wine data
// =========================================================================
async function enrichGrapeWithWines(grapeName, chunks) {
  console.log(`  Querying Supabase for ${grapeName} wines...`);

  const { data: wines, error } = await supabase
    .from("wines")
    .select("id, name, vintage, producer_id, curation_reason, varietal_blend")
    .filter("varietal_blend", "cs", `"${grapeName}"`)
    .eq("is_curated", true)
    .limit(5);

  if (error) {
    console.warn(`⚠ Could not fetch wines for ${grapeName}:`, error.message);
    return chunks;
  }

  if (wines && wines.length > 0) {
    const wineList = wines
      .map((w) => `- **${w.name}${w.vintage ? ` ${w.vintage}` : ""}**: ${w.curation_reason || "Teaching wine"}`)
      .join("\n");

    const teachingChunk = {
      source_doc: `grapes/${grapeName}`,
      chunk_index: chunks.length,
      section_title: `Teaching Wines: ${grapeName}`,
      content: `These wines exemplify ${grapeName}:\n\n${wineList}`,
      chunk_type: "teaching_wines",
      tags: [grapeName, "curated"],
      status: "draft",
    };

    chunks.push(teachingChunk);
  }

  return chunks;
}

// =========================================================================
// Upsert chunks to knowledge_chunks
// =========================================================================
async function upsertChunks(chunks) {
  console.log(`\n📤 Upserting ${chunks.length} chunks to Supabase...`);

  for (const chunk of chunks) {
    const { error } = await supabase.from("knowledge_chunks").upsert(
      [
        {
          source_doc: chunk.source_doc,
          chunk_index: chunk.chunk_index,
          section_title: chunk.section_title,
          content: chunk.content,
          chunk_type: chunk.chunk_type,
          tags: chunk.tags,
          status: chunk.status,
        },
      ],
      { onConflict: "source_doc,chunk_index" }
    );

    if (error) {
      console.error(`❌ Error upserting chunk "${chunk.section_title}":`, error.message);
    } else {
      console.log(`  ✓ ${chunk.section_title}`);
    }
  }
}

// =========================================================================
// Test: Process Sangiovese grape page
// =========================================================================
async function testSangiovese() {
  console.log("🧪 TEST: Processing Sangiovese grape page...\n");

  const content = readObsidianFile("Grapes", "Sangiovese");
  if (!content) {
    console.error("❌ Failed to read Sangiovese.md");
    return;
  }

  console.log("📖 Parsing Sangiovese into chunks...");
  let chunks = parseMarkdownChunks(content, "grapes/Sangiovese");
  console.log(`  Found ${chunks.length} chunks`);

  chunks = await enrichGrapeWithWines("Sangiovese", chunks);

  await upsertChunks(chunks);

  console.log("\n✅ Test complete!");
  console.log("\n📍 Check Supabase:");
  console.log("1. Go to knowledge_chunks table");
  console.log("2. Filter by source_doc = 'grapes/Sangiovese'");
  console.log("3. Verify chunks + wine enrichment");
}

// =========================================================================
// Main
// =========================================================================
async function main() {
  console.log("=".repeat(60));
  console.log("🍷 TC Knowledge Processor: Obsidian → Supabase");
  console.log("=".repeat(60));
  console.log();

  await testSangiovese();
}

main().catch((err) => console.error("❌ Fatal error:", err));
