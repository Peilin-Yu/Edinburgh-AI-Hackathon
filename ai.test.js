// Tests for the AI layer in index.html, using a fake Anthropic API (no key or network needed).
// Run from the project folder:  node tests/ai.test.js

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const start = html.indexOf("/* ---------- real AI structuring");
const end = html.indexOf("/* ---------- AI connection");
if (start < 0 || end < 0) throw new Error("Could not find the AI section in index.html");
const AI = new Function(html.slice(start, end) + "\nreturn { callClaudeAPI, fromAI, fromAIOffers, fromAIScore, fromAIQuestion, fromAIMatches, matchPrompt, aiPrompt, offersPrompt, STRUCTURE_SCHEMA, OFFERS_SCHEMA, MATCH_SCHEMA };")();

function fakeFetch(status, body, seen) {
  return async (url, opts) => {
    seen.url = url; seen.opts = opts; seen.body = JSON.parse(opts.body);
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
}

const tests = {
  async "sends a correct Messages API request and returns the tool input"() {
    const seen = {};
    const reply = { content: [{ type: "tool_use", name: "structure_request", input: { category: "Laptop", summary: "Quiet laptop" } }] };
    const out = await AI.callClaudeAPI({ key: "sk-test", model: "claude-haiku-5-5", prompt: AI.aiPrompt("quiet laptop £800"), tool: { name: "structure_request", description: "d", schema: AI.STRUCTURE_SCHEMA } }, fakeFetch(200, reply, seen));
    assert.strictEqual(seen.url, "https://api.anthropic.com/v1/messages");
    assert.strictEqual(seen.opts.headers["x-api-key"], "sk-test");
    assert.strictEqual(seen.opts.headers["anthropic-version"], "2023-06-01");
    assert.strictEqual(seen.opts.headers["anthropic-dangerous-direct-browser-access"], "true");
    assert.strictEqual(seen.body.model, "claude-haiku-5-5");
    assert.deepStrictEqual(seen.body.tool_choice, { type: "tool", name: "structure_request" });
    assert.strictEqual(seen.body.tools[0].input_schema.properties.category.enum.length, 7);
    assert.ok(seen.body.messages[0].content.includes("quiet laptop £800"));
    assert.strictEqual(out.category, "Laptop");
  },
  async "maps HTTP errors to friendly codes"() {
    for (const [status, code] of [[401, "bad_key"], [429, "rate_limited"], [529, "rate_limited"], [404, "bad_model"], [500, "api_error"]]) {
      await assert.rejects(AI.callClaudeAPI({ key: "k", model: "m", prompt: "p", tool: { name: "t", schema: {} } }, fakeFetch(status, { error: { message: "x" } }, {})), (e) => e.code === code);
    }
  },
  async "rejects a reply with no tool call"() {
    await assert.rejects(AI.callClaudeAPI({ key: "k", model: "m", prompt: "p", tool: { name: "t", schema: {} } }, fakeFetch(200, { content: [{ type: "text", text: "hi" }] }, {})), (e) => e.code === "bad_reply");
  },
  async "structures a request from Claude's JSON"() {
    const r = AI.fromAI({ category: "Goal", label: "Social activity", summary: "Make friends", budget: 40, budget_period: "month", must_haves: ["Meet people regularly"], nice_to_haves: [], deadline: "Within two weeks", location: "Edinburgh", routes: ["Clubs", "Classes"], question: "Group or one-to-one?", options: ["Group", "One-to-one"] }, "text");
    assert.strictEqual(r.cat, "Goal"); assert.strictEqual(r.monthly, true); assert.strictEqual(r.budget, 40); assert.strictEqual(r.ai, true);
    assert.strictEqual(AI.fromAI({ category: "Spaceship", budget: "£1,200" }, "x").cat, "Other");
    assert.strictEqual(AI.fromAI({ category: "Laptop", budget: "£1,200" }, "x").budget, 1200);
  },
  async "cleans up Claude's offers"() {
    const offers = AI.fromAIOffers({ offers: [
      { seller: "Leith Laptops", kind: "local", rating: 4.7, item: "14in ultrabook", price: 749, days: 2, fit: 94, why: "Fits." },
      { seller: "MegaTech Direct", kind: "partner", rating: 9, item: "Laptop", price: "£799", days: 0, fit: 140, why: "Fast." },
      { seller: "Leith Laptops", kind: "local", rating: 4, item: "Duplicate seller", price: 10, days: 1, fit: 50, why: "" },
      { seller: "Broken", item: "No price", price: 0 },
    ] }, { monthly: false });
    assert.strictEqual(offers.length, 2);
    assert.strictEqual(offers[1].via, "API");
    assert.strictEqual(offers[1].price, 799);
    assert.strictEqual(offers[1].days, 1);
    assert.strictEqual(offers[1].fit, 99);
    assert.strictEqual(offers[1].rating, 5);
    assert.strictEqual(AI.fromAIOffers({ offers: [] }, {}), null);
    assert.strictEqual(AI.fromAIOffers({ offers: [{ seller: "A", item: "x", price: 5 }, { seller: "B", item: "y", price: 6 }] }, { monthly: true })[0].unit, "/mo");
  },
  async "labels sellers by kind: business, local person, retailer"() {
    const offers = AI.fromAIOffers({ offers: [
      { seller: "A", kind: "business", item: "x", price: 5 }, { seller: "B", kind: "person", item: "y", price: 6 }, { seller: "C", kind: "retailer", item: "z", price: 7 },
    ] }, {});
    assert.deepStrictEqual(offers.map((o) => o.source), ["business", "person", "retailer"]);
    assert.strictEqual(offers[2].via, "API");
    assert.deepStrictEqual(AI.fromAIQuestion({ seller_question: { seller: "Heriot Walks", question: "Is a level route OK?" } }), { from: "Heriot Walks", q: "Is a level route OK?", a: null });
    assert.strictEqual(AI.fromAIQuestion({}), null);
  },
  async "reads catalogue matches and ignores unknown listings"() {
    const listings = [{ id: "L1", name: "Laptop", price: 600 }, { id: "L2", name: "Chair", price: 90 }];
    const m = AI.fromAIMatches({ matches: [{ id: "L1", match: 93.6, why: "Fits." }, { id: "L9", match: 99, why: "?" }, { id: "L2", match: 140 }] }, listings);
    assert.deepStrictEqual(Object.keys(m).sort(), ["L1", "L2"]);
    assert.strictEqual(m.L1.match, 94);
    assert.strictEqual(m.L2.match, 99);
    assert.strictEqual(AI.fromAIMatches({ matches: [] }, listings), null);
    assert.ok(AI.matchPrompt({ summary: "s", must: [], text: "t" }, listings).includes("L2"));
  },
  async "reads Claude's score of a seller offer"() {
    assert.deepStrictEqual(AI.fromAIScore({ fit: 88.4, why: "Good." }), { fit: 88, why: "Good." });
    assert.strictEqual(AI.fromAIScore({ fit: "n/a" }), null);
  },
};

(async () => {
  let passed = 0;
  const names = Object.keys(tests);
  for (const name of names) {
    try { await tests[name](); passed++; console.log("PASS ", name); }
    catch (e) { console.log("FAIL ", name, "\n      ", e.message); }
  }
  console.log(`\n${passed}/${names.length} passed`);
  process.exit(passed === names.length ? 0 : 1);
})();
