/**
 * Seed a few demo leads under org "default". Run with: npm run seed
 * (Requires MONGODB_URI. Ownership is a placeholder user id for demo only.)
 */
import { leads } from "@/data/leads";

const DEMO_ORG = "default";
const DEMO_OWNER = "seed-user";

const demo = [
  { name: "Aarav Sharma", company: "Kolhapur Textiles", email: "aarav@ktex.in" },
  { name: "Priya Menon", company: "Lyndoc Clinics", email: "priya@lyndoc.in" },
  { name: "Rahul Verma", company: "NCR Digital Agency", email: "rahul@ncrdigital.in" },
];

async function main() {
  for (const d of demo) {
    await leads.insert({ orgId: DEMO_ORG, ownerId: DEMO_OWNER, ...d });
    console.log(`seeded lead: ${d.name}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
