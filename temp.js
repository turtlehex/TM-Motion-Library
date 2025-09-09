// --- Sanity project details (public dataset; no token in browser) ---
const SANITY_PROJECT_ID = "0q5edxhx";
const SANITY_DATASET    = "production";
const SANITY_API_V      = "2025-09-09"; // any YYYY-MM-DD date works

// Build the API CDN URL (fast, cached) + GROQ query
const SANITY_BASE = `https://${SANITY_PROJECT_ID}.apicdn.sanity.io/v${SANITY_API_V}/data/query/${SANITY_DATASET}`;

// We’ll fetch the fields we actually use, and resolve a URL for the file.
// `coalesce(srcUrl, src.asset->url)` means: use external URL if provided, otherwise the uploaded file URL.
const GROQ = encodeURIComponent(`
  *[_type == "animation"] | order(lower(title) asc) {
    title,
    category,
    engine,
    stateMachines,
    "src": coalesce(srcUrl, src.asset->url)
  }
`);





async function loadItemsFromSanity() {
  const url = `${SANITY_BASE}?query=${GROQ}`;
  const res = await fetch(url, { cache: "no-store" }); // always fresh when you refresh
  if (!res.ok) {
    // Helpful message in console if CORS or project ID is wrong
    const text = await res.text().catch(() => "");
    throw new Error(`Sanity fetch failed: ${res.status} ${text}`);
  }
  const { result } = await res.json();

  // Normalize to the shape your grid already expects
  return (result || []).map(it => ({
    title: it.title,
    category: it.category || "Uncategorized",
    src: it.src,
    engine: it.engine || null,          // optional; used if you prefer engine over file extension
    stateMachines: it.stateMachines || [] // optional; you can pass to Rive if you like
  }));
}







// ----- Data (flat categories) -----
// Mix .riv (Rive) and .json (Lottie) freely. Lottie previews if lottie-web is present.
const ITEMS = [
  { title: "Loan Loader - Badge", src: "./assets/rive/loan_loader_badge.riv", category: "Loaders" },
  { title: "Loan Loader - Bank",  src: "./assets/rive/loan_loader_bank.riv",  category: "Loaders" },
  { title: "Loan Loader - Fetch", src: "./assets/rive/loan_loader_fetch.riv", category: "Loaders" },
  { title: "Loan Loader - Load",  src: "./assets/rive/loan_loader_load.riv",  category: "Loaders" },
  { title: "Loan Loader - Verify",src: "./assets/rive/loan_loader_verify.riv",category: "Loaders" },

  { title: "Spinner",             src: "./assets/rive/spinner.riv",          category: "Common UI" },
  { title: "Confetti",            src: "./assets/rive/confetti.riv",         category: "Effects"   },

  // Example Lottie (uncomment + provide a real path if you have one)
  // { title: "Success Check",       src: "./assets/lottie/success.json",       category: "Common UI" },
];

// Optional Rive state machine name (set to null if not used)
const STATE_MACHINE = "State Machine 1";

// ----- DOM -----
const grid = document.getElementById("grid");
const catsEl = document.getElementById("cats");
const activeFilterEl = document.getElementById("activeFilter");
const countEl = document.getElementById("count");
const searchEl = document.getElementById("search");

const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const menuBtn = document.getElementById("menuBtn");
const closeSidebarBtn = document.getElementById("closeSidebar");
const openFiltersBtn = document.getElementById("openFilters");

// ----- State -----
let activeCategory = "All";
let searchTerm = "";

// ----- Helpers -----
function isLottie(src = "") { return /\.json(\?|#|$)/i.test(src); }

function fileNameFromSrc(src) {
  const last = (src || "").split("/").pop() || "";
  return last || "asset";
}
function sanitizeForFileName(str) {
  return (str || "asset").replace(/[^\w\d\-_.]+/g, "_");
}
function suggestedDownloadName(item) {
  const ext = fileNameFromSrc(item.src).split(".").pop() || "riv";
  return `${sanitizeForFileName(item.title || "asset")}.${ext}`;
}

function uniqueCategories(items) {
  const set = new Set(items.map(i => i.category || "Uncategorized"));
  return ["All", ...Array.from(set).sort()];
}

// ----- Sidebar controls (mobile) -----
function openSidebar() {
  sidebar.classList.add("open");
  overlay.hidden = false;
  void overlay.offsetWidth;
  overlay.classList.add("show");
  menuBtn?.setAttribute("aria-expanded", "true");
}
function closeSidebar() {
  sidebar.classList.remove("open");
  overlay.classList.remove("show");
  menuBtn?.setAttribute("aria-expanded", "false");
  setTimeout(() => { if (!overlay.classList.contains("show")) overlay.hidden = true; }, 200);
}
function toggleSidebar() {
  if (sidebar.classList.contains("open")) closeSidebar(); else openSidebar();
}

// ----- Build sidebar (flat) -----
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

// ----- Filtering -----
function filterItems() {
  const q = searchTerm.trim().toLowerCase();
  return ITEMS.filter(it => {
    const inCat = activeCategory === "All" || it.category === activeCategory;
    if (!inCat) return false;
    if (!q) return true;
    return (it.title + " " + (it.category || "")).toLowerCase().includes(q);
  });
}

// ----- Rive mounting -----
function makeCanvas(container) {
  const c = document.createElement("canvas");
  c.className = "rv";
  container.appendChild(c);
  const rect = c.getBoundingClientRect();
  c.width  = Math.max(1, Math.floor(rect.width || 260));
  c.height = Math.max(1, Math.floor(rect.height || 240));
  return c;
}

function mountRive(canvas, src) {
  const r = new rive.Rive({
    src,
    canvas,
    autoplay: true,
    ...(STATE_MACHINE ? { stateMachines: STATE_MACHINE } : {}),
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

// ----- Lottie mounting -----
function makeLottieContainer(container) {
  const d = document.createElement("div");
  d.className = "lv";
  container.appendChild(d);
  return d;
}
function mountLottie(el, src) {
  if (!window.lottie) return;
  window.lottie.loadAnimation({
    container: el,
    renderer: "svg",
    loop: true,
    autoplay: true,
    path: src,
  });
}

// ----- Card builder -----
function makeCard(item) {
  const card = document.createElement("div");
  card.className = "card";

  // Download icon button (top-left overlay)
  const dl = document.createElement("a");
  dl.className = "card-action";
  dl.href = item.src;
  dl.setAttribute("download", suggestedDownloadName(item));
  dl.setAttribute("aria-label", `Download ${item.title}`);
  dl.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M12 4v10m0 0l4-4m-4 4l-4-4M5 20h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  card.appendChild(dl);

  // Preview
  if (isLottie(item.src)) {
    const holder = makeLottieContainer(card);
    mountLottie(holder, item.src);
  } else {
    const canvas = makeCanvas(card);
    mountRive(canvas, item.src);
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

// ----- Grid render -----
function renderGrid() {
  grid.innerHTML = "";
  const data = filterItems();
  countEl.textContent = `${data.length} item${data.length === 1 ? "" : "s"}`;
  data.forEach(it => grid.appendChild(makeCard(it)));
}

// ----- Init -----
document.addEventListener("DOMContentLoaded", () => {
  // Build UI
  renderCategories();
  activeFilterEl.textContent = activeCategory;
  renderGrid();

  // Search (material-style label behavior uses :valid/:placeholder-shown)
  searchEl.setAttribute("placeholder", " "); // enables floating label
  searchEl.addEventListener("input", (e) => {
    searchTerm = e.target.value || "";
    renderGrid();
  });

  // Sidebar toggles (mobile)
  menuBtn?.addEventListener("click", toggleSidebar);
  openFiltersBtn?.addEventListener("click", openSidebar);
  closeSidebarBtn?.addEventListener("click", closeSidebar);
  overlay?.addEventListener("click", closeSidebar);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sidebar.classList.contains("open")) closeSidebar();
  });
});
