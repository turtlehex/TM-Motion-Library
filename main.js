/************************************************************
 * SANITY LOADER (public dataset; no token in browser)
 ************************************************************/

// 1) Project settings — replace with yours
const SANITY_PROJECT_ID = "0q5edxhx";
const SANITY_DATASET    = "production";
const SANITY_API_V      = "2025-07-01"; // any YYYY-MM-DD date works
const SANITY_BASE       = `https://${SANITY_PROJECT_ID}.apicdn.sanity.io/v${SANITY_API_V}/data/query/${SANITY_DATASET}`;

// 2) GROQ query
const GROQ = encodeURIComponent(`
  *[_type == "animation"] | order(lower(title) asc) {
    title,
    category,
    engine,
    stateMachines,
    "src": coalesce(srcUrl, src.asset->url)
  }
`);

// 3) Fetch + normalize to the shape our UI expects
async function loadItemsFromSanity() {
  const res = await fetch(`${SANITY_BASE}?query=${GROQ}`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Sanity fetch failed: ${res.status} ${text}`);
  }
  const { result } = await res.json();
  return (result || []).map(it => ({
    title: it.title,
    category: it.category || "Uncategorized",
    src: it.src,
    engine: it.engine || null,
    stateMachines: Array.isArray(it.stateMachines) ? it.stateMachines : []
  }));
}

/************************************************************
 * HELPERS
 ************************************************************/

function isLottie(itemOrSrc) {
  if (typeof itemOrSrc === "string") return /\.json(\?|#|$)/i.test(itemOrSrc);
  const it = itemOrSrc || {};
  if (it.engine) return it.engine === "lottie";
  return /\.json(\?|#|$)/i.test(it.src || "");
}

function extractExtFromUrl(url) {
  try {
    const u = new URL(url, window.location.href);
    const last = (u.pathname.split("/").pop() || "").toLowerCase();
    const dot = last.lastIndexOf(".");
    return dot > -1 ? last.slice(dot + 1) : "";
  } catch {
    const clean = (url || "").split("?")[0].split("#")[0];
    const last = clean.split("/").pop() || "";
    const dot = last.lastIndexOf(".");
    return dot > -1 ? last.slice(dot + 1).toLowerCase() : "";
  }
}

function sanitizeForFileName(str) {
  return (str || "asset").replace(/[^\w\d\-_.]+/g, "_");
}

function suggestedDownloadName(item) {
  let ext = item.engine === "lottie" ? "json"
         : item.engine === "rive"   ? "riv"
         : extractExtFromUrl(item.src) || "riv";
  return `${sanitizeForFileName(item.title || "asset")}.${ext}`;
}

/************************************************************
 * DOM REFERENCES
 ************************************************************/

const grid = document.getElementById("grid");
const catsEl = document.getElementById("cats");
const activeFilterEl = document.getElementById("activeFilter");
const countEl = document.getElementById("count");
const searchEl = document.getElementById("search");

// Responsive sidebar bits (if present)
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const menuBtn = document.getElementById("menuBtn");
const closeSidebarBtn = document.getElementById("closeSidebar");
const openFiltersBtn = document.getElementById("openFilters");

/************************************************************
 * APP STATE
 ************************************************************/

let ITEMS = [];                 // populated from Sanity
let activeCategory = "All";
let searchTerm = "";
const STATE_MACHINE_DEFAULT = "State Machine 1";

/************************************************************
 * CATEGORY RENDER
 ************************************************************/

function uniqueCategories(items) {
  const set = new Set(items.map(i => i.category || "Uncategorized"));
  return ["All", ...Array.from(set).sort()];
}

function renderCategories() {
  catsEl.innerHTML = "";
  uniqueCategories(ITEMS).forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "cat-btn" + (cat === activeCategory ? " active" : "");
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      activeCategory = cat;
      activeFilterEl.textContent = cat;
      catsEl.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderGrid();
      if (window.matchMedia("(max-width: 900px)").matches) closeSidebar();
    });
    catsEl.appendChild(btn);
  });
}

/************************************************************
 * FILTERING
 ************************************************************/

function filterItems() {
  const q = searchTerm.trim().toLowerCase();
  return ITEMS.filter(it => {
    const inCat = activeCategory === "All" || it.category === activeCategory;
    if (!inCat) return false;
    if (!q) return true;
    return (it.title + " " + (it.category || "")).toLowerCase().includes(q);
  });
}

/************************************************************
 * RIVE + LOTTIE MOUNTING
 ************************************************************/

function makeCanvas(container) {
  const c = document.createElement("canvas");
  c.className = "rv";
  container.appendChild(c);
  const rect = c.getBoundingClientRect();
  c.width  = Math.max(1, Math.floor(rect.width || 260));
  c.height = Math.max(1, Math.floor(rect.height || 240));
  return c;
}

function mountRive(canvas, item) {
  const stateMachines = item.stateMachines && item.stateMachines.length
    ? item.stateMachines
    : (STATE_MACHINE_DEFAULT ? [STATE_MACHINE_DEFAULT] : undefined);

  const r = new rive.Rive({
    src: item.src,
    canvas,
    autoplay: true,
    ...(stateMachines ? { stateMachines } : {}),
    onLoad: () => r.resizeDrawingSurfaceToCanvas(),
  });

  const onResize = () => {
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.max(1, Math.floor(rect.width));
    canvas.height = Math.max(1, Math.floor(rect.height));
    r.resizeDrawingSurfaceToCanvas();
  };
  window.addEventListener("resize", onResize, { passive: true });
}

function makeLottieContainer(container) {
  const d = document.createElement("div");
  d.className = "lv";
  container.appendChild(d);
  return d;
}

function mountLottie(el, item) {
  if (!window.lottie) return;
  window.lottie.loadAnimation({
    container: el,
    renderer: "svg",
    loop: true,
    autoplay: true,
    path: item.src,
  });
}

/************************************************************
 * CARD + GRID
 ************************************************************/

function makeCard(item) {
  const card = document.createElement("div");
  card.className = "card";

  // Download icon (top-left)
  const dl = document.createElement("a");
  dl.className = "card-action";
  dl.href = item.src;
  dl.setAttribute("download", suggestedDownloadName(item));
  dl.setAttribute("aria-label", `Download ${item.title}`);
  dl.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M12 4v10m0 0l4-4m-4 4l-4-4M5 20h14"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  card.appendChild(dl);

  // Preview
  if (isLottie(item)) {
    const holder = makeLottieContainer(card);
    mountLottie(holder, item);
  } else {
    const canvas = makeCanvas(card);
    mountRive(canvas, item);
  }

  // Footer with centered title
  const footer = document.createElement("div");
  footer.className = "card-footer";

  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = item.title;
  title.title = item.title;

  footer.appendChild(title);
  card.appendChild(footer);

  return card;
}

function renderGrid() {
  grid.innerHTML = "";
  const data = filterItems();
  countEl.textContent = `${data.length} item${data.length === 1 ? "" : "s"}`;
  if (data.length === 0) {
    grid.innerHTML = `<div style="padding:24px;color:#6b7280;">No animations yet. Add one in Studio and click Publish.</div>`;
    return;
  }
  data.forEach(it => grid.appendChild(makeCard(it)));
}

/************************************************************
 * SIDEBAR (MOBILE) CONTROLS
 ************************************************************/

function openSidebar() {
  if (!sidebar || !overlay) return;
  sidebar.classList.add("open");
  overlay.hidden = false;
  void overlay.offsetWidth;
  overlay.classList.add("show");
  menuBtn?.setAttribute("aria-expanded", "true");
}
function closeSidebar() {
  if (!sidebar || !overlay) return;
  sidebar.classList.remove("open");
  overlay.classList.remove("show");
  menuBtn?.setAttribute("aria-expanded", "false");
  setTimeout(() => { if (!overlay.classList.contains("show")) overlay.hidden = true; }, 200);
}
function toggleSidebar() {
  if (!sidebar) return;
  if (sidebar.classList.contains("open")) closeSidebar(); else openSidebar();
}

/************************************************************
 * BOOTSTRAP
 ************************************************************/

document.addEventListener("DOMContentLoaded", async () => {
  try {
    ITEMS = await loadItemsFromSanity();
  } catch (e) {
    console.error(e);
    // Small fallback so the page still shows something
    ITEMS = [
      { title: "Spinner (fallback)", src: "./assets/rive/spinner.riv", category: "Common UI", engine: "rive", stateMachines: [] }
    ];
  }

  renderCategories();
  activeFilterEl.textContent = activeCategory;
  renderGrid();

  // Search (material-style floating label uses placeholder hack)
  searchEl.setAttribute("placeholder", " ");
  searchEl.addEventListener("input", (e) => {
    searchTerm = e.target.value || "";
    renderGrid();
  });

  // Mobile sidebar hooks (if present)
  menuBtn?.addEventListener("click", toggleSidebar);
  openFiltersBtn?.addEventListener("click", openSidebar);
  closeSidebarBtn?.addEventListener("click", closeSidebar);
  overlay?.addEventListener("click", closeSidebar);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sidebar?.classList.contains("open")) closeSidebar();
  });
});
