// Tests for the offline demand parser in index.html.
// Run from the project folder:  node tests/parser.test.js
// No dependencies needed (Node 18+).

const fs = require("fs");
const path = require("path");
const assert = require("assert");

// Pull the parser section out of index.html so the tests always check the real code.
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const start = html.indexOf("/* ---------- offline parser");
const end = html.indexOf("/* ---------- real AI structuring");
if (start < 0 || end < 0) throw new Error("Could not find the parser section in index.html");
const parse = new Function(html.slice(start, end) + "\nreturn parse;")();

const cases = [
  {
    text: "I need a quiet, lightweight laptop for coding with at least 16GB RAM and good battery life. Budget £800, need it by next week.",
    expect: { cat: "Laptop", budget: 800, deadline: "By next week", must: ["16GB+ RAM", "Quiet", "Lightweight", "For coding", "Good battery life"] },
  },
  {
    text: "Looking for a second-hand road bike for commuting in Edinburgh, around £300, this weekend if possible.",
    expect: { cat: "Bike", budget: 300, deadline: "This weekend", location: "Edinburgh", must: ["Second-hand", "For commuting"] },
  },
  {
    text: "I'd like a used iPhone 13, 128GB, unlocked, no scratches. £350 tops. Delivery to Leeds by Thursday",
    expect: { cat: "Phone", budget: 350, deadline: "By Thursday", location: "Leeds", must: ["128GB", "Used", "Unlocked", "No scratches"] },
  },
  {
    text: "need a 15 inch gaming laptop with RTX graphics and 32GB RAM under 1.2k asap",
    expect: { cat: "Laptop", budget: 1200, deadline: "As soon as possible", must: ["32GB RAM", "15 inch", "Gaming", "RTX graphics"] },
  },
  {
    text: "I just moved to Edinburgh and want to make friends. About £40 a month, ideally starting in the next two weeks.",
    expect: { cat: "Goal", budget: 40, monthly: true, deadline: "Within two weeks", location: "Edinburgh", summary: "Make friends" },
  },
  {
    text: "a sofa that fits 3 people, must be grey and under 400 quid by end of the month",
    expect: { cat: "Furniture", budget: 400, deadline: "By end of the month", must: ["Grey", "Fits 3 people"] },
  },
  {
    text: "Can someone fix my bike? Rear brake is broken. £40, tomorrow ideally",
    expect: { cat: "Other", budget: 40, deadline: "Tomorrow", summary: "Fix my bike" },
  },
];

let passed = 0;
for (const c of cases) {
  const r = parse(c.text);
  try {
    for (const [key, want] of Object.entries(c.expect)) {
      if (key === "must") want.forEach((m) => assert.ok(r.must.includes(m), `must-haves should include "${m}", got ${JSON.stringify(r.must)}`));
      else assert.deepStrictEqual(r[key], want, `${key}: expected ${JSON.stringify(want)}, got ${JSON.stringify(r[key])}`);
    }
    passed++;
    console.log("PASS ", c.text.slice(0, 60));
  } catch (e) {
    console.log("FAIL ", c.text.slice(0, 60), "\n      ", e.message);
  }
}
console.log(`\n${passed}/${cases.length} passed`);
process.exit(passed === cases.length ? 0 : 1);
