// ----- Data (flat categories) -----
const ITEMS = [
  { title: "Loan Loader - Badge", src: "./assets/rive/loan_loader_badge.riv", category: "Loaders" },
  { title: "Loan Loader - Bank",  src: "./assets/rive/loan_loader_bank.riv",  category: "Loaders" },
  { title: "Loan Loader - Fetch", src: "./assets/rive/loan_loader_fetch.riv", category: "Loaders" },
  { title: "Loan Loader - Load",  src: "./assets/rive/loan_loader_load.riv",  category: "Loaders" },
  { title: "Loan Loader - Verify",src: "./assets/rive/loan_loader_verify.riv",category: "Loaders" },

  { title: "Spinner",             src: "./assets/rive/spinner.riv",          category: "Common UI" },
  { title: "Confetti",            src: "./assets/rive/confetti.riv",         category: "Effects"   },
];

// Optional state machine name (set to null if not used)
const STATE_MACHINE = "State Machine 1";

// ----- DOM -----
const grid = document.getElementById("grid");
const catsEl = document.getElementById("cats");
const activeFilterEl = document.getElementById("activeFilter");
const countEl = document.getElementById("count");
const searchEl = document.getElementById("search");

// ----- State -----
let activeCategory = "All";
let searchTerm = "";

// ----- Build sidebar (flat) -----
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
      // update active UI
      catsEl.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderGrid();
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
  // size to CSS box
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

  // simple responsive sizing
  const onResize = () => {
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.max(1, Math.floor(rect.width));
    canvas.height = Math.max(1, Math.floor(rect.height));
    r.resizeDrawingSurfaceToCanvas();
  };
  window.addEventListener("resize", onResize, { passive: true });
}

// ----- Grid render -----
function renderGrid() {
  grid.innerHTML = "";
  const data = filterItems();
  countEl.textContent = `${data.length} item${data.length === 1 ? "" : "s"}`;
  data.forEach(it => {
    const canvas = makeCanvas(grid);
    mountRive(canvas, it.src);
  });
}

// ----- Init -----
document.addEventListener("DOMContentLoaded", () => {
  renderCategories();

  // Search (material-style label behavior uses :valid/:placeholder-shown)
  searchEl.setAttribute("placeholder", " "); // enables floating label
  searchEl.addEventListener("input", (e) => {
    searchTerm = e.target.value || "";
    renderGrid();
  });

  activeFilterEl.textContent = activeCategory;
  renderGrid();
});
