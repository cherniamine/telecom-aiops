def build_copilot_panel_html() -> str:
    return """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Telecom AI Copilot</title>
  <style>
    :root {
      --bg: #f5efe4;
      --ink: #1b2430;
      --muted: #5d6674;
      --card: rgba(255, 251, 245, 0.9);
      --line: rgba(27, 36, 48, 0.12);
      --accent: #c44c35;
      --accent-dark: #8f301f;
      --secondary: #0f6a73;
      --success: #2f7d4a;
      --shadow: 0 20px 50px rgba(27, 36, 48, 0.12);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Segoe UI Variable Display", "Trebuchet MS", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(196, 76, 53, 0.20), transparent 28%),
        radial-gradient(circle at bottom right, rgba(15, 106, 115, 0.20), transparent 30%),
        linear-gradient(135deg, #f7f1e8 0%, #efe4d3 45%, #eadcca 100%);
      padding: 32px 18px 48px;
    }

    .shell {
      max-width: 1120px;
      margin: 0 auto;
      display: grid;
      gap: 18px;
    }

    .hero, .panel, .result {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 24px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(12px);
    }

    .hero {
      padding: 26px;
      position: relative;
      overflow: hidden;
    }

    .hero::after {
      content: "";
      position: absolute;
      inset: auto -10% -30% auto;
      width: 260px;
      height: 260px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(196, 76, 53, 0.16), transparent 68%);
    }

    .eyebrow {
      font-size: 12px;
      letter-spacing: 0.24em;
      text-transform: uppercase;
      color: var(--secondary);
      font-weight: 700;
      margin-bottom: 10px;
    }

    h1 {
      margin: 0 0 8px;
      font-size: clamp(30px, 5vw, 54px);
      line-height: 0.95;
    }

    .hero p {
      max-width: 720px;
      margin: 0;
      color: var(--muted);
      font-size: 17px;
      line-height: 1.5;
    }

    .grid {
      display: grid;
      gap: 18px;
      grid-template-columns: 1.2fr 1.8fr;
    }

    .panel {
      padding: 22px;
    }

    .label {
      display: block;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      margin-bottom: 8px;
    }

    input, textarea {
      width: 100%;
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.72);
      border-radius: 14px;
      padding: 14px 15px;
      font: inherit;
      color: var(--ink);
    }

    textarea {
      min-height: 106px;
      resize: vertical;
    }

    .actions {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      margin-top: 16px;
    }

    button {
      border: 0;
      border-radius: 16px;
      padding: 16px 14px;
      color: #fff;
      cursor: pointer;
      font: inherit;
      font-weight: 700;
      transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
      box-shadow: 0 14px 28px rgba(0, 0, 0, 0.12);
    }

    button:hover {
      transform: translateY(-2px);
    }

    button:disabled {
      opacity: 0.6;
      cursor: wait;
      transform: none;
    }

    .btn-explain { background: linear-gradient(135deg, #c44c35, #8f301f); }
    .btn-root { background: linear-gradient(135deg, #0f6a73, #12474d); }
    .btn-best { background: linear-gradient(135deg, #2f7d4a, #1e5d36); }

    .result {
      padding: 22px;
      min-height: 420px;
    }

    .result-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(15, 106, 115, 0.1);
      color: var(--secondary);
      font-size: 13px;
      font-weight: 700;
    }

    .cards {
      display: grid;
      gap: 14px;
    }

    .card {
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.55);
    }

    .card h3 {
      margin: 0 0 8px;
      font-size: 14px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .card p {
      margin: 0;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .empty {
      display: grid;
      place-items: center;
      min-height: 320px;
      border: 1px dashed var(--line);
      border-radius: 18px;
      color: var(--muted);
      text-align: center;
      padding: 28px;
      background:
        linear-gradient(135deg, rgba(255,255,255,0.45), rgba(255,255,255,0.18));
    }

    .hint {
      color: var(--muted);
      font-size: 14px;
      line-height: 1.6;
      margin-top: 12px;
    }

    @media (max-width: 900px) {
      .grid { grid-template-columns: 1fr; }
      .actions { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <div class="eyebrow">Telecom Incident Copilot</div>
      <h1>Explain. Root Cause. Best Action.</h1>
      <p>
        Panneau de demo pour la soutenance. Il s'appuie sur les endpoints
        IA du dashboard pour expliquer un incident, isoler la cause racine
        et recommander la meilleure action corrective en un clic.
      </p>
    </section>

    <section class="grid">
      <div class="panel">
        <label class="label" for="incidentId">Incident ID</label>
        <input id="incidentId" placeholder="Laisser vide pour utiliser le dernier incident" />

        <label class="label" for="question" style="margin-top:16px;">Question Copilot</label>
        <textarea id="question" placeholder="Ex: What is the root cause and the best action?"></textarea>

        <div class="actions">
          <button id="btnExplain" class="btn-explain">Explain</button>
          <button id="btnRoot" class="btn-root">Root Cause</button>
          <button id="btnBest" class="btn-best">Best Action</button>
        </div>

        <p class="hint">
          Si aucun ID n'est fourni, <strong>Explain</strong> et <strong>Root Cause</strong>
          utilisent automatiquement le dernier incident connu.
          <strong>Best Action</strong> accepte aussi <code>latest</code>.
        </p>
      </div>

      <div class="result">
        <div class="result-head">
          <strong>AI Copilot Output</strong>
          <div id="status" class="badge">Ready</div>
        </div>
        <div id="output" class="empty">
          Clique sur un bouton pour generer une explication de l'incident.
        </div>
      </div>
    </section>
  </div>

  <script>
    const incidentIdInput = document.getElementById("incidentId");
    const questionInput = document.getElementById("question");
    const statusEl = document.getElementById("status");
    const outputEl = document.getElementById("output");
    const buttons = [
      document.getElementById("btnExplain"),
      document.getElementById("btnRoot"),
      document.getElementById("btnBest"),
    ];

    function currentIncidentId() {
      const value = incidentIdInput.value.trim();
      return value || "latest";
    }

    function setLoading(label) {
      statusEl.textContent = label;
      buttons.forEach((button) => { button.disabled = true; });
    }

    function setReady(label = "Ready") {
      statusEl.textContent = label;
      buttons.forEach((button) => { button.disabled = false; });
    }

    function renderCards(cards, meta = "") {
      const cardsHtml = cards.map((card) => `
        <div class="card">
          <h3>${card.title}</h3>
          <p>${card.body}</p>
        </div>
      `).join("");

      outputEl.className = "cards";
      outputEl.innerHTML = cardsHtml + (meta ? `<p class="hint">${meta}</p>` : "");
    }

    function renderError(message) {
      outputEl.className = "empty";
      outputEl.innerHTML = `<div>${message}</div>`;
    }

    async function explainIncident() {
      setLoading("Explaining...");

      try {
        const response = await fetch("/dashboard/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            incident_id: incidentIdInput.value.trim() || null
          })
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "Unable to explain incident");
        }

        renderCards([
          { title: "Manager Summary", body: data.manager_summary || "N/A" },
          { title: "Technical Explanation", body: data.technical_explanation || "N/A" },
          { title: "Recommended Action", body: data.recommended_action || "N/A" },
        ], `Source: ${data.source} | Model: ${data.model || "N/A"}`);
        setReady("Explained");
      } catch (error) {
        renderError(`Explain failed: ${error.message}`);
        setReady("Error");
      }
    }

    async function askRootCause() {
      setLoading("Finding root cause...");

      try {
        const response = await fetch("/dashboard/copilot/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            incident_id: incidentIdInput.value.trim() || null,
            question: "What is the root cause of this telecom incident?"
          })
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "Unable to answer");
        }

        renderCards([
          { title: "Root Cause Answer", body: data.answer || "N/A" },
        ], `Source: ${data.source} | Fallback: ${data.used_fallback ? "yes" : "no"}`);
        setReady("Root Cause Ready");
      } catch (error) {
        renderError(`Root Cause failed: ${error.message}`);
        setReady("Error");
      }
    }

    async function getBestAction() {
      setLoading("Simulating best action...");

      try {
        const response = await fetch(`/dashboard/what-if/best-action/${encodeURIComponent(currentIncidentId())}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "Unable to get best action");
        }

        const best = data.best_action || {};
        renderCards([
          { title: "Best Action", body: best.action_label || best.action_id || "N/A" },
          { title: "MTTR Improvement", body: `Before: ${data.incident_mttr_baseline || "N/A"} min\\nAfter: ${best.mttr_after || "N/A"} min\\nReduction: ${best.mttr_reduction_pct || "N/A"}%` },
          { title: "Recommendation", body: best.recommendation || "Use the best action shown above." },
        ], `Actions compared: ${data.actions_compared || 0}`);
        setReady("Best Action Ready");
      } catch (error) {
        renderError(`Best Action failed: ${error.message}`);
        setReady("Error");
      }
    }

    document.getElementById("btnExplain").addEventListener("click", explainIncident);
    document.getElementById("btnRoot").addEventListener("click", askRootCause);
    document.getElementById("btnBest").addEventListener("click", getBestAction);

    questionInput.value = "What is the root cause and the best action?";
  </script>
</body>
</html>
""".strip()
