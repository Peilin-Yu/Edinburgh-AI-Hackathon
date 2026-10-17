# Reverse Market

**Flip the Script hackathon entry.** Shopping assumes the buyer does all the searching. Reverse Market flips it: the buyer posts a need once, in their own words, and sellers who can meet it come to them and compete.

## Run it

Open `index.html` in any modern browser. No install or build step.

**Live version:** the site is also published as a Claude artifact. There, Claude is built in and no API key is needed; viewers are asked once to allow it.

**Turn on the AI locally:** click the **AI: offline** button in the bottom-right corner (the presenter's demo controls), paste an Anthropic API key (from console.anthropic.com), pick a model and press **Save and test**. The button turns green and shows the model. From then on Claude:

1. reads each posted need and turns it into a structured request,
2. writes the sellers' offers for that exact request (any product or service, not only the built-in categories),
3. checks and scores any offer you send from the Seller view.

Claude Haiku 5.5 is the default because it answers in a couple of seconds, which suits a live demo. The key is stored only in that browser (localStorage) and sent only to `api.anthropic.com`. Remove it with **Remove key** after the demo, and never publish the page with a key inside it.

Without a key the page still works: it uses the offline parser and the example offers, and the request card says "offline parser". If the browser refuses to call the API from a file opened directly (some browsers block requests from `file://` pages), serve the folder instead: `python -m http.server 8000` in this folder, then open http://localhost:8000.

Run the tests (Node 18+, no dependencies, no key needed; the AI tests use a fake API):

```
node tests/parser.test.js
node tests/ai.test.js
```

## What the prototype does

One marketplace, one account: anyone can post a need (**Buying**) and anyone can answer one (**Selling**).

1. **Buyer posts a need** in plain language, for a product ("quiet laptop under £800 by next week") or an outcome ("I just moved to Edinburgh and want to make friends, about £40 a month"). The home page also shows open requests from other buyers, with **I want this too** (join as a group) and **Make an offer**.
2. **Claude structures the need** into a request sellers can act on: category, summary, budget (total or per month), must-haves, deadline and location. Open-ended goals get one follow-up question.
3. **Four kinds of answer arrive, ranked together** by fit, price and timing, with a filter for each:
   - **Business**: local shops and companies replying by hand.
   - **Retailer · via API**: large retailers replying automatically.
   - **Local person**: individuals with a skill or second-hand item, no shop needed (a student who guides tours).
   - **Found online**: real listings already on the web, with price, link and the date checked. Those sellers haven't seen the request, so the button opens their site instead of "Accept".
4. **Questions from sellers** appear on the request; the buyer answers publicly so every seller benefits. Other buyers can join the request, turning it into a group order.
5. **Seller inbox (Selling).** Claude matches each new request against the seller's catalogue. The seller sees match %, budget and how many offers are competing, then sends an offer drafted from a listing, asks the buyer a question, or passes. A box shows where the offer would rank on fit and price without revealing other sellers' prices. One offer per request, improvable twice.
6. **Catalogue autopilot.** For sellers with lots of stock: when the best-fitting listing meets the rules (minimum match, in stock, at most 10% over budget, daily limit), the offer goes out automatically and shows under **Sent by autopilot**. Each listing can be included or left for manual review.
7. **Buyer accepts** an offer. Their details are shared with that seller only.

Presenter controls (bottom-right button): AI connection, **Other sellers reply automatically**, and **Reset demo**.

## What is real and what is simulated

| Part | Status |
|---|---|
| Demand structuring | **Real AI.** Claude via the Anthropic API (your key), or via Claude itself when the page is opened as a Claude artifact. Offline parser only as a fallback. The request card shows which one ran. |
| Catalogue matching and autopilot | **Real AI and real rules.** Claude scores every listing in the demo shop's catalogue against the request; the autopilot rules run in the page. |
| Found online | **Real listings**, found by web search and checked on 17 Oct 2026, for the six example requests only (the example buttons). Prices can change; each card links to the source. A request typed by hand gets no web results, and the page says so. |
| Other sellers' offers and seller questions | **AI-simulated.** Claude writes plausible offers and a question from invented sellers. Example offers are the fallback. |
| Other buyers joining ("want this too") and the open-requests feed | **Simulated** for the demo. |
| Scoring an offer you send from Selling | **Real AI** ("Checked by Claude"). |
| Offer ranking | **Real.** Same formula for every kind of seller. |

## Stack and why we chose it

| Layer | What we used | Why |
|---|---|---|
| Front end | One `index.html`: plain HTML, CSS and JavaScript. No framework, no build step | Opens on any judge's laptop with a double-click. Nothing to install, nothing to break during setup, and every change shows up on refresh, which matters with one day to build. |
| Styling | CSS variables for colours, an automatic dark theme, Google Fonts (Bricolage Grotesque, IBM Plex Sans and Mono) with system fallbacks | One set of colour values keeps the buyer and seller screens consistent. The fonts are optional: if the venue Wi-Fi is down, the page falls back to system fonts and still looks right. |
| AI model | Claude, through the Anthropic Messages API. Default model Claude Haiku 5.5; Sonnet 5.5 and Opus 5.5 can be chosen in AI settings | The core of the idea is understanding a need written in everyday language ("400 quid", "make friends in a new city"), which rules can't fully cover. Haiku answers in about a second or two, so the demo doesn't stall on stage. The larger models are there for harder requests. |
| Structured output | Claude's tool use with a forced tool and a JSON Schema for each task | Claude must answer by filling in a fixed form (category, budget, must-haves…), so the page always receives data in the same shape instead of free text it would have to guess at. |
| Calling the API | Called directly from the browser, with the key entered in AI settings and kept in that browser | No server to build or host for a demo. Trade-off: the key lives in the browser, so it's for a presenter's laptop only. In production the call would go through our own small server that holds the key. |
| Second AI route | Claude's built-in "sample" feature when the page is opened as a Claude artifact | The same page can run inside Claude with no key at all. |
| Fallback | Rule-based offline parser (regular expressions) and example offers | Hackathon Wi-Fi and API limits are unpredictable. If the AI is unreachable, the demo keeps working and the request card says which engine ran. |
| Ranking | A fixed formula in JavaScript, not the AI | Ranking has to be explainable and fair to sellers. The AI judges how well an offer fits; the formula decides the order, so a seller can't game the ranking by writing a persuasive description. |
| Storage | One in-memory `state` object; `localStorage` only for the API key and chosen model | A demo needs no database. Each screen is redrawn from `state`, so buyer and seller views always agree. |
| Tests | Node's built-in `assert`; no test framework | `node tests/...` runs anywhere with Node 18+. The tests pull the code straight out of `index.html`, so they always check the real page. The AI tests use a fake API, so no key or network is needed. |
| Pitch | `Reverse_Market_Pitch.pptx` with a timed script in the speaker notes | Ready for the stage without extra tools. |

## How the key parts work

### The flow

```
Buyer types a need ──► 1. Claude structures it ──► request card
                                                      │ (open-ended goal? Claude asks one follow-up)
                                                      ▼
                       2. Claude writes the sellers' offers ──► arrive one by one ──► ranked list
                                                                                         ▲
Seller view: seller sends an offer ──► 3. Claude scores its fit ─────────────────────────┘
                                                                                         │
                                                              Buyer accepts ◄────────────┘
```

### 1. Understanding the request
The buyer's text goes to Claude with a short instruction (`aiPrompt`) and a JSON Schema (`STRUCTURE_SCHEMA`) listing the fields sellers need: category, a short summary, budget and whether it is per month, must-haves, nice-to-haves, deadline, location. For an outcome rather than a product ("make friends"), Claude marks it as a Goal, suggests kinds of solution (clubs, classes…) and writes one follow-up question with two or three answer buttons. `fromAI` then checks every field (for example, an unknown category becomes "Other", "£1,200" becomes 1200) before anything is shown.

### 2. Offers coming to the buyer
With the request structured, a second call (`offersPrompt`, `OFFERS_SCHEMA`) asks Claude to play the sellers: 4–5 offers from invented UK businesses, one of them a large retailer replying automatically by API. The prompt asks for a realistic spread (a strong all-round match, the cheapest with a trade-off, the fastest, a premium option slightly over budget) and honest fit scores. `fromAIOffers` drops anything malformed or duplicated and keeps numbers within sensible limits (price above £0, rating 3–5, fit 30–99, delivery 1–60 days). The offers then arrive a few seconds apart, as they would from real sellers. In the real product this step is replaced by actual sellers and retailer APIs; the rest of the system stays the same.

### 3. Ranking
Every time an offer arrives, the list is re-sorted (`rankOffers`):

> score = fit × 0.6 + price score × 30 + speed bonus

- **Fit** (up to about 59 points): how well the offer meets the must-haves, scored by Claude.
- **Price** (up to 30 points): full marks at or under budget. Points drop off quickly over budget, reaching zero at a third over.
- **Speed** (up to 8 points): 2 points for each day faster than five days.

Labels (Best match, Lowest price, Fastest, Large partner) are worked out from the list itself.

### 4. Seller side
The new request shows up in the seller's feed. When the seller sends an offer, a third call (`scorePrompt`, `SCORE_SCHEMA`) has Claude rate its fit against the must-haves, budget and deadline and write a one-line reason for the buyer. The offer then joins the same ranked list as everyone else's, marked "Checked by Claude".

### 5. Reliability
- **One way to call Claude** (`askClaude`): it uses the API key if one is set, otherwise Claude's built-in route inside an artifact. Every task goes through it.
- **Clear errors**: a wrong key, rate limits, an unknown model and network problems each get their own plain message, and the page falls back to the offline path instead of freezing.
- **No mixed-up results**: each posted request has a token. If the demo is reset while Claude is still answering, the late answer is ignored.

## Code map

A single self-contained HTML file with plain JavaScript and CSS. There is no framework and no build step. The only external resources are fonts from Google Fonts; the page still works without them.

Main parts of the script in `index.html`:

- **Offline parser** (`parse` and helpers): regular-expression rules that extract the budget (for example "£800", "under 400 quid", "1.2k", "£40 a month"), the deadline ("by Friday", "within 5 days", "asap"), the location, the category, and must-haves (adjectives before the product, "with …" / "that …" / "must …" clauses, comma lists, specs such as "16GB+ RAM").
- **AI layer** (`callClaudeAPI`, `askClaude`): calls the Anthropic Messages API from the browser and forces Claude to answer through a tool with a JSON schema, so replies always have the right shape. Three tasks share it: structuring (`aiPrompt`, `STRUCTURE_SCHEMA`, `fromAI`), writing offers (`offersPrompt`, `OFFERS_SCHEMA`, `fromAIOffers`) and scoring a seller's offer (`scorePrompt`, `SCORE_SCHEMA`, `fromAIScore`). Every reply is validated and clamped before it reaches the screen; any failure falls back to the offline path with a short message.
- **Demo controls** (`demo-panel`, bottom-right): AI connection (key, model, connection test), automatic seller replies on or off, and reset.
- **Site structure**: three views in one page: home (hero with the request box, how it works, outcomes, seller pricing, FAQ), My request (structured request, activity log, offers with sorting, accept confirmation) and the seller dashboard.
- **Offers and ranking** (`OFFERS`, `buildOffers`, `rankOffers`): example offers per category; the score combines fit (60%), price against budget and delivery speed.
- **Marketplace data** (`EXAMPLES`, `OPEN_REQS`, `LISTINGS`): the example requests with their real Found online listings, the open-requests feed, and the demo shop's catalogue.
- **Catalogue matching and autopilot** (`matchPrompt`, `MATCH_SCHEMA`, `fromAIMatches`, `runMatching`, `autopilot`): Claude scores each listing; the best one that passes the rules is offered automatically. Without AI, a keyword match is used.
- **Views** (`renderStatus`, `renderTicket`, `renderQA`, `renderMetoo`, `renderOffers`, `renderSell`, `renderOfferPanel`, `renderAutopilot`, `renderListings`): every screen is redrawn from one shared state object.

## Platform roadmap

- Small sellers reply in person from a dashboard; large retailers plug in by API and reply automatically. Both appear in one ranked list.
- Free for buyers. Sellers pay per qualified lead or a small commission. Aggregated demand data is a second revenue stream.
- Pilot with student essentials in Edinburgh, then expand by category.

## Files

- `index.html`: the prototype
- `tests/parser.test.js`: tests for the offline parser
- `tests/ai.test.js`: tests for the AI layer against a fake API
- `Reverse_Market_Pitch.pptx`: 2-slide pitch deck with a timed script in the speaker notes

## Credits

Built during the hackathon with help from Claude (Anthropic), which was used to generate and refine the prototype code and pitch deck.
