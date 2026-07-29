// Passage Protocol — investor deck (dark / neon green)
const pptxgen = require("pptxgenjs");
const p = new pptxgen();
p.layout = "LAYOUT_WIDE"; // 13.33 x 7.5

const BG = "060B09", PANEL = "0C1410", PANEL2 = "122019", BORDER = "1C3229";
const TXT = "EAFFF6", MUT = "7DA395", NEON = "00FFA3", NEON2 = "00E5FF";
const F = "Calibri";

const base = (s) => { s.background = { color: BG }; };

const mark = (s, x, y, sc = 1) => {
  // gate logo mark
  s.addShape("roundRect", { x, y, w: 0.09 * sc, h: 0.62 * sc, rectRadius: 0.04 * sc, fill: { color: NEON } });
  s.addShape("roundRect", { x: x + 0.42 * sc, y, w: 0.09 * sc, h: 0.62 * sc, rectRadius: 0.04 * sc, fill: { color: NEON } });
  s.addShape("line", { x: x - 0.1 * sc, y: y + 0.28 * sc, w: 0.72 * sc, h: 0.0, line: { color: NEON, width: 3 * sc, dashType: "solid" } });
};

const footer = (s, n) => {
  s.addText([{ text: "passage", options: { color: MUT } }, { text: ".", options: { color: NEON } }],
    { x: 0.5, y: 7.05, w: 2, h: 0.3, fontFace: F, fontSize: 10, margin: 0 });
  s.addText(String(n), { x: 12.6, y: 7.05, w: 0.4, h: 0.3, fontFace: F, fontSize: 10, color: MUT, align: "right", margin: 0 });
};

const title = (s, t, sub) => {
  s.addText(t, { x: 0.5, y: 0.35, w: 12.3, h: 0.7, fontFace: F, fontSize: 30, bold: true, color: TXT, margin: 0 });
  if (sub) s.addText(sub, { x: 0.5, y: 0.98, w: 12.3, h: 0.4, fontFace: F, fontSize: 14, color: MUT, margin: 0 });
};

// ---------- 1. TITLE ----------
let s = p.addSlide(); base(s);
s.addShape("ellipse", { x: 4.9, y: -2.6, w: 3.6, h: 3.6, fill: { color: "0D2A1E", transparency: 20 }, line: { type: "none" } });
mark(s, 6.25, 1.55, 1.4);
s.addText([{ text: "passage", options: { color: TXT } }, { text: ".", options: { color: NEON } }],
  { x: 0, y: 2.6, w: 13.33, h: 1.0, align: "center", fontFace: F, fontSize: 54, bold: true, margin: 0 });
s.addText("The compliance bridge that makes real-world assets DeFi-composable",
  { x: 0, y: 3.6, w: 13.33, h: 0.5, align: "center", fontFace: F, fontSize: 18, color: MUT, margin: 0 });
s.addText([
  { text: "SOLANA", options: { color: NEON } }, { text: "   ·   ", options: { color: MUT } },
  { text: "TOKEN-2022 TRANSFER HOOKS", options: { color: NEON } }, { text: "   ·   ", options: { color: MUT } },
  { text: "REAL YIELD", options: { color: NEON } },
], { x: 0, y: 4.35, w: 13.33, h: 0.4, align: "center", fontFace: F, fontSize: 12, charSpacing: 2, margin: 0 });
s.addText("Investor deck · 2026", { x: 0, y: 6.7, w: 13.33, h: 0.4, align: "center", fontFace: F, fontSize: 11, color: MUT, margin: 0 });

// ---------- 2. PROBLEM ----------
s = p.addSlide(); base(s); footer(s, 2);
title(s, "A $30B market that can't move", "Tokenized RWAs exist — but they are locked out of DeFi");
const stat = (x, big, label, col) => {
  s.addShape("roundRect", { x, y: 1.7, w: 3.9, h: 2.2, rectRadius: 0.12, fill: { color: PANEL }, line: { color: BORDER, width: 1 } });
  s.addText(big, { x, y: 2.0, w: 3.9, h: 1.0, align: "center", fontFace: F, fontSize: 48, bold: true, color: col, margin: 0 });
  s.addText(label, { x: x + 0.3, y: 3.05, w: 3.3, h: 0.7, align: "center", fontFace: F, fontSize: 13, color: MUT, margin: 0 });
};
stat(0.6, "$30B", "of RWAs tokenized on-chain (T-bills, funds, private credit)", TXT);
stat(4.72, "~8%", "actually circulates in DeFi protocols", NEON);
stat(8.84, "$0", "of that liquidity earns composable DeFi yield today", "FF6B6B");
s.addText([
  { text: "Why? ", options: { bold: true, color: TXT } },
  { text: "KYC allowlists and transfer agents mean tokenized treasuries can't be swapped, staked, or used as collateral in open protocols. The ECB warns that without common standards, tokenized markets become isolated pools.", options: { color: MUT } },
], { x: 0.6, y: 4.4, w: 12.1, h: 1.0, fontFace: F, fontSize: 15, margin: 0 });
s.addShape("roundRect", { x: 0.6, y: 5.5, w: 12.1, h: 1.1, rectRadius: 0.12, fill: { color: PANEL2 }, line: { color: BORDER, width: 1 } });
s.addText([
  { text: "The gap: ", options: { bold: true, color: NEON } },
  { text: "no one owns the compliance-to-composability layer. Yet.", options: { color: TXT } },
], { x: 0.9, y: 5.8, w: 11.5, h: 0.5, fontFace: F, fontSize: 16, margin: 0 });

// ---------- 3. SOLUTION ----------
s = p.addSlide(); base(s); footer(s, 3);
title(s, "Passage: compliance inside the token", "Wrap once — compose everywhere");
const step = (x, n, h, d) => {
  s.addShape("ellipse", { x, y: 1.8, w: 0.5, h: 0.5, fill: { color: NEON } });
  s.addText(n, { x, y: 1.8, w: 0.5, h: 0.5, align: "center", fontFace: F, fontSize: 18, bold: true, color: "04150D", margin: 0 });
  s.addText(h, { x, y: 2.45, w: 3.7, h: 0.4, fontFace: F, fontSize: 17, bold: true, color: TXT, margin: 0 });
  s.addText(d, { x, y: 2.9, w: 3.7, h: 1.3, fontFace: F, fontSize: 13, color: MUT, margin: 0 });
};
step(0.6, "1", "Deposit a permissioned RWA", "Tokenized T-bill, fund, or credit goes into the Passage vault. 1:1 backing, on-chain.");
step(4.85, "2", "Receive a pToken", "A Token-2022 asset with a built-in transfer hook. Every transfer verifies the recipient's credential on-chain.");
step(9.1, "3", "Compose freely", "Swap, lend, collateralize in any protocol. Only verified wallets can ever hold it — compliance is enforced by the token itself.");
s.addShape("line", { x: 4.35, y: 2.05, w: 0.4, h: 0, line: { color: NEON, width: 2, endArrowType: "triangle" } });
s.addShape("line", { x: 8.6, y: 2.05, w: 0.4, h: 0, line: { color: NEON, width: 2, endArrowType: "triangle" } });
s.addShape("roundRect", { x: 0.6, y: 4.5, w: 12.1, h: 1.9, rectRadius: 0.12, fill: { color: PANEL }, line: { color: BORDER, width: 1 } });
s.addText("Why issuers say yes", { x: 0.9, y: 4.75, w: 11.5, h: 0.4, fontFace: F, fontSize: 15, bold: true, color: NEON, margin: 0 });
s.addText("Passage doesn't compete with BlackRock, Ondo, or Centrifuge — it makes their assets more valuable. Neutral infrastructure, one integration, every DeFi venue. Regulators get an auditable, on-chain KYC trail on every single transfer.",
  { x: 0.9, y: 5.2, w: 11.5, h: 1.0, fontFace: F, fontSize: 14, color: MUT, margin: 0 });

// ---------- 4. PRODUCT / STATUS ----------
s = p.addSlide(); base(s); footer(s, 4);
title(s, "Not a whitepaper — a working protocol", "Built and tested on Solana");
const prog = (x, y, name, d) => {
  s.addShape("roundRect", { x, y, w: 5.9, h: 1.35, rectRadius: 0.12, fill: { color: PANEL }, line: { color: BORDER, width: 1 } });
  s.addText(name, { x: x + 0.3, y: y + 0.18, w: 5.3, h: 0.4, fontFace: "Courier New", fontSize: 14, bold: true, color: NEON, margin: 0 });
  s.addText(d, { x: x + 0.3, y: y + 0.6, w: 5.3, h: 0.6, fontFace: F, fontSize: 12, color: MUT, margin: 0 });
};
prog(0.6, 1.65, "passage_wrapper", "Vault: wrap/unwrap 1:1, fee accrual, treasury collection");
prog(6.85, 1.65, "passage_identity", "Credential registry: verify & revoke wallets (KYC attestations)");
prog(0.6, 3.15, "passage_hook", "Token-2022 transfer hook: blocks any transfer to unverified wallets");
prog(6.85, 3.15, "passage_pool", "Gated AMM: swap pTokens vs USDC — LPs earn, everyone stays verified");
const kpi = (x, big, label) => {
  s.addText(big, { x, y: 4.9, w: 3.0, h: 0.8, align: "center", fontFace: F, fontSize: 40, bold: true, color: NEON, margin: 0 });
  s.addText(label, { x, y: 5.7, w: 3.0, h: 0.6, align: "center", fontFace: F, fontSize: 12, color: MUT, margin: 0 });
};
kpi(1.2, "4", "on-chain programs\n(Rust / Anchor)");
kpi(5.15, "14", "integration tests, all passing\nincl. compliance blocking");
kpi(9.1, "100%", "open source\ngithub.com/SewnRetirement");

// ---------- 5. MARKET ----------
s = p.addSlide(); base(s); footer(s, 5);
title(s, "Riding the strongest trend in crypto", "Tokenized RWA market value on-chain");
s.addChart(p.ChartType.line, [{
  name: "RWA on-chain value ($B)",
  labels: ["2022", "2023", "2024", "2025", "2026", "2027E", "2028E"],
  values: [1.5, 5, 12, 22, 30, 55, 100],
}], {
  x: 0.6, y: 1.6, w: 7.6, h: 4.9,
  chartColors: [NEON],
  lineSize: 3, lineSmooth: true,
  showLegend: false, showTitle: false,
  showValue: true, dataLabelPosition: "t", dataLabelColor: MUT, dataLabelFontSize: 10, dataLabelFormatCode: "0.#",
  catAxisLabelColor: MUT, valAxisLabelColor: MUT,
  valGridLine: { color: BORDER, size: 1 }, catGridLine: { style: "none" },
  valAxisHidden: false, plotArea: { fill: { color: BG } },
});
s.addShape("roundRect", { x: 8.5, y: 1.6, w: 4.2, h: 4.9, rectRadius: 0.12, fill: { color: PANEL }, line: { color: BORDER, width: 1 } });
s.addText("Why now", { x: 8.8, y: 1.85, w: 3.6, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: NEON, margin: 0 });
s.addText([
  { text: "BlackRock, Franklin Templeton and Ondo are live on-chain — BUIDL alone passed $2.5B", options: { bullet: true, color: MUT, breakLine: true } },
  { text: "Solana RWA value is accelerating, with no compliance layer on the chain yet", options: { bullet: true, color: MUT, breakLine: true } },
  { text: "MiCA (EU) and maturing US rules make compliant rails a requirement, not a feature", options: { bullet: true, color: MUT, breakLine: true } },
  { text: "Institutions want DeFi yield on their RWA holdings — someone must bridge it", options: { bullet: true, color: MUT } },
], { x: 8.8, y: 2.35, w: 3.7, h: 3.9, fontFace: F, fontSize: 13, paraSpaceAfter: 10, margin: 0 });

// ---------- 6. BUSINESS MODEL ----------
s = p.addSlide(); base(s); footer(s, 6);
title(s, "Real fees, from day one", "Every dollar of volume pays the protocol");
const fee = (x, big, label, sub) => {
  s.addShape("roundRect", { x, y: 1.7, w: 3.9, h: 2.4, rectRadius: 0.12, fill: { color: PANEL }, line: { color: BORDER, width: 1 } });
  s.addText(big, { x, y: 2.0, w: 3.9, h: 0.9, align: "center", fontFace: F, fontSize: 40, bold: true, color: NEON, margin: 0 });
  s.addText(label, { x: x + 0.25, y: 2.95, w: 3.4, h: 0.4, align: "center", fontFace: F, fontSize: 14, bold: true, color: TXT, margin: 0 });
  s.addText(sub, { x: x + 0.25, y: 3.4, w: 3.4, h: 0.6, align: "center", fontFace: F, fontSize: 11, color: MUT, margin: 0 });
};
fee(0.6, "0.10%", "Wrap / unwrap fee", "on every asset entering or leaving the vault");
fee(4.72, "0.25%", "Swap fee", "on every pool trade (LP share; protocol cut via governance)");
fee(8.84, "100%", "To the treasury", "all protocol revenue flows to token-holder governed treasury");
s.addText("Illustrative annual revenue at scale", { x: 0.6, y: 4.5, w: 12, h: 0.4, fontFace: F, fontSize: 14, bold: true, color: TXT, margin: 0 });
s.addChart(p.ChartType.bar, [{
  name: "Annual protocol revenue ($M)",
  labels: ["$100M TVW", "$500M TVW", "$2B TVW"],
  values: [0.6, 3.0, 12.0],
}], {
  x: 0.6, y: 4.95, w: 12.1, h: 1.9, barDir: "bar",
  chartColors: [NEON], showLegend: false, showTitle: false,
  showValue: true, dataLabelPosition: "outEnd", dataLabelColor: TXT, dataLabelFontSize: 11, dataLabelFormatCode: "0.#",
  catAxisLabelColor: MUT, valAxisLabelColor: MUT, valAxisHidden: true,
  valGridLine: { style: "none" }, catGridLine: { style: "none" },
});
s.addText("Assumes 3x annual turnover (wrap+unwrap) plus modest swap volume. TVW = Total Value Wrapped.",
  { x: 0.6, y: 6.85, w: 12.1, h: 0.3, fontFace: F, fontSize: 9, italic: true, color: MUT, margin: 0 });

// ---------- 7. TOKEN & LAUNCH ----------
s = p.addSlide(); base(s); footer(s, 7);
title(s, "$PASS — launched the credible way", "Futarchy launch on MetaDAO");
const tok = (x, y, w, h, head, lines) => {
  s.addShape("roundRect", { x, y, w, h, rectRadius: 0.12, fill: { color: PANEL }, line: { color: BORDER, width: 1 } });
  s.addText(head, { x: x + 0.3, y: y + 0.2, w: w - 0.6, h: 0.4, fontFace: F, fontSize: 15, bold: true, color: NEON, margin: 0 });
  s.addText(lines.map((t, i) => ({ text: t, options: { bullet: true, color: MUT, breakLine: i < lines.length - 1 } })),
    { x: x + 0.3, y: y + 0.65, w: w - 0.6, h: h - 0.85, fontFace: F, fontSize: 12.5, paraSpaceAfter: 8, margin: 0 });
};
tok(0.6, 1.65, 5.9, 2.6, "Fair, high-float launch", [
  "10M $PASS distributed via MetaDAO ICO — no hidden allocations, no VC discounts",
  "Min $1.8M, capped at $4M — oversubscription refunded pro-rata; treasury governed by futarchy markets, not the team",
  "20% of raise + 2.9M tokens seed protocol-owned liquidity",
]);
tok(6.85, 1.65, 5.9, 2.6, "Aligned team incentives", [
  "Founder: $16k/mo salary + milestone bonuses capped at $1M — paid in treasury USDC, zero token sell pressure",
  "Performance tokens (10%) unlock only at 2x / 4x / 8x above ICO price, 18-month vesting",
  "Every treasury spend requires market approval — funds cannot be drained",
]);
tok(0.6, 4.45, 12.15, 2.1, "Why futarchy fits Passage", [
  "Every governance question — add an asset, change a fee, fund a listing — has a measurable impact on protocol revenue",
  "Traders with real capital price each decision; cash-flow infrastructure is exactly what decision markets value best",
  "MetaDAO launches reward working products with real revenue — Passage arrives with both",
]);


// ---------- 8. USE OF FUNDS ----------
s = p.addSlide(); base(s); footer(s, 8);
title(s, "Use of funds", "Pre-approved operating budget — every extra spend needs market approval");
s.addChart(p.ChartType.bar, [{
  name: "Monthly budget ($k)",
  labels: ["Founder", "2nd developer", "Advisors (2x)", "Marketing & community", "Infra & tooling", "KYC provider", "Admin & entity", "Contingency"],
  values: [16, 10, 10, 8, 1.5, 1, 1.5, 2],
}], {
  x: 0.6, y: 1.6, w: 7.4, h: 4.9, barDir: "bar",
  chartColors: [NEON], showLegend: false, showTitle: false,
  showValue: true, dataLabelPosition: "outEnd", dataLabelColor: TXT, dataLabelFontSize: 10, dataLabelFormatCode: "0.#",
  catAxisLabelColor: MUT, catAxisLabelFontSize: 11, valAxisHidden: true,
  valGridLine: { style: "none" }, catGridLine: { style: "none" },
});
s.addShape("roundRect", { x: 8.3, y: 1.6, w: 4.4, h: 4.9, rectRadius: 0.12, fill: { color: PANEL }, line: { color: BORDER, width: 1 } });
s.addText("The math", { x: 8.6, y: 1.85, w: 3.8, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: NEON, margin: 0 });
s.addText([
  { text: "~$50k/month operating budget", options: { bullet: true, color: MUT, breakLine: true } },
  { text: "$165k one-time: audit, legal/MiCA, entity, listings, bug bounty", options: { bullet: true, color: MUT, breakLine: true } },
  { text: "18 months x $50k + $165k = ~$1.07M", options: { bullet: true, color: MUT, breakLine: true } },
  { text: "$1.8M raise - 20% to liquidity pools = $1.44M treasury", options: { bullet: true, color: MUT, breakLine: true } },
  { text: "~$375k buffer on top of the full budget", options: { bullet: true, color: NEON } },
], { x: 8.6, y: 2.35, w: 3.9, h: 3.9, fontFace: F, fontSize: 13, paraSpaceAfter: 10, margin: 0 });

// ---------- 9. ROADMAP ----------
s = p.addSlide(); base(s); footer(s, 9);
title(s, "Roadmap", "From devnet to the RWA liquidity standard");
const phase = (x, q, items, active) => {
  s.addShape("roundRect", { x, y: 1.9, w: 2.85, h: 3.9, rectRadius: 0.12, fill: { color: active ? PANEL2 : PANEL }, line: { color: active ? NEON : BORDER, width: active ? 1.5 : 1 } });
  s.addText(q, { x: x + 0.25, y: 2.15, w: 2.35, h: 0.4, fontFace: F, fontSize: 15, bold: true, color: active ? NEON : TXT, margin: 0 });
  s.addText(items.map((t, i) => ({ text: t, options: { bullet: true, color: MUT, breakLine: i < items.length - 1 } })),
    { x: x + 0.25, y: 2.6, w: 2.4, h: 3.0, fontFace: F, fontSize: 11.5, paraSpaceAfter: 8, margin: 0 });
};
phase(0.6, "Now", ["MVP live on devnet", "4 programs, full test suite", "Open-source repo + demo"], true);
phase(3.75, "Q+1", ["Security audit", "Mainnet launch", "First issuer asset live", "MetaDAO ICO"]);
phase(6.9, "Q+2", ["KYC provider integration", "2–3 assets wrapped", "pToken/USDC pools live"]);
phase(10.05, "Q+3/4", ["Lending collateral integrations", "$5M+ Total Value Wrapped", "zk-credentials", "CEX conversations"]);

// ---------- 10. ASK ----------
s = p.addSlide(); base(s); footer(s, 10);
s.addShape("ellipse", { x: 5.0, y: -2.8, w: 3.4, h: 3.4, fill: { color: "0D2A1E", transparency: 20 }, line: { type: "none" } });
s.addText("Join the launch", { x: 0, y: 1.5, w: 13.33, h: 0.8, align: "center", fontFace: F, fontSize: 40, bold: true, color: TXT, margin: 0 });
s.addText("Passage is raising a minimum of $1.8M via MetaDAO to take the RWA composability layer to mainnet.",
  { x: 1.8, y: 2.5, w: 9.7, h: 0.6, align: "center", fontFace: F, fontSize: 16, color: MUT, margin: 0 });
const ask = (x, big, label) => {
  s.addShape("roundRect", { x, y: 3.4, w: 3.9, h: 1.7, rectRadius: 0.12, fill: { color: PANEL }, line: { color: BORDER, width: 1 } });
  s.addText(big, { x, y: 3.6, w: 3.9, h: 0.7, align: "center", fontFace: F, fontSize: 28, bold: true, color: NEON, margin: 0 });
  s.addText(label, { x: x + 0.25, y: 4.35, w: 3.4, h: 0.6, align: "center", fontFace: F, fontSize: 12, color: MUT, margin: 0 });
};
ask(0.6, "$1.8-4M", "min raise to $4M cap: team, audit, legal (MiCA), integrations");
ask(4.72, "10M $PASS", "high float, futarchy-governed treasury");
ask(8.84, "Real yield", "protocol fees from day one of mainnet");
s.addText([
  { text: "github.com/SewnRetirement/passage-protocol", options: { color: NEON } },
  { text: "      ·      ", options: { color: MUT } },
  { text: "sewnretirement.github.io/passage-protocol", options: { color: NEON } },
], { x: 0, y: 5.6, w: 13.33, h: 0.4, align: "center", fontFace: F, fontSize: 14, margin: 0 });
s.addText([{ text: "passage", options: { color: TXT } }, { text: ".", options: { color: NEON } }],
  { x: 0, y: 6.3, w: 13.33, h: 0.5, align: "center", fontFace: F, fontSize: 22, bold: true, margin: 0 });

p.writeFile({ fileName: "/root/passage/assets/passage-deck.pptx" }).then(() => console.log("deck written"));
