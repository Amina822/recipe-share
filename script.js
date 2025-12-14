/*****************
 * CONFIGURATION
 *****************/
const API_URL = "http://127.0.0.1:5000";

// Default image fallback
const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80";

let currentUser = JSON.parse(localStorage.getItem("currentUser")) || null;
let recipes = [];

// per-user states (from backend now)
let likedRecipes = new Set();
let favoriteRecipes = new Set();
let ratingsMap = new Map(); // recipeId -> stars you gave (1..5)

let currentRecipeId = null;
let currentView = "home";

/*****************
 * IMAGE URL RESOLVER
 * - if backend returns "/uploads/..." => convert to full URL
 * - if URL already full => keep it
 *****************/
function resolveImageUrl(img) {
  if (!img) return "";
  const s = String(img).trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/uploads/")) return API_URL + s;
  return s;
}

/*****************
 * API FUNCTIONS
 *****************/
async function fetchRecipes() {
  try {
    const qs = currentUser?.username
      ? `?username=${encodeURIComponent(currentUser.username)}`
      : "";
    const res = await fetch(`${API_URL}/recipes${qs}`);
    if (!res.ok) throw new Error("Failed to fetch recipes");
    const data = await res.json();
    recipes = data;
    syncUserStateFromRecipes(data);
    return data;
  } catch (err) {
    console.error("fetchRecipes:", err);
    showToast("Error loading recipes", "error");
    return [];
  }
}

function syncUserStateFromRecipes(list) {
  // Backend returns userLiked/userFavorited/userRating if username passed
  likedRecipes = new Set();
  favoriteRecipes = new Set();
  ratingsMap = new Map();

  if (!currentUser) return;

  for (const r of list) {
    if (r.userLiked) likedRecipes.add(r.id);
    if (r.userFavorited) favoriteRecipes.add(r.id);
    if (r.userRating) ratingsMap.set(r.id, r.userRating);
  }
}

// ✅ add recipe uses FormData for file/url
async function addRecipeAPI(formData) {
  const response = await fetch(`${API_URL}/recipes`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    let msg = "Failed to add recipe";
    try {
      const err = await response.json();
      msg = err.error || msg;
    } catch (_) {}
    throw new Error(msg);
  }
  return await response.json();
}

async function updateRecipeAPI(recipeId, recipeData) {
  const response = await fetch(
    `${API_URL}/recipes/${recipeId}?username=${encodeURIComponent(currentUser.username)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recipeData)
    }
  );

  if (!response.ok) {
    let msg = "Failed to update recipe";
    try {
      const err = await response.json();
      msg = err.error || msg;
    } catch (_) {}
    throw new Error(msg);
  }
  return await response.json();
}

async function deleteRecipeAPI(recipeId) {
  const response = await fetch(
    `${API_URL}/recipes/${recipeId}?username=${encodeURIComponent(currentUser.username)}`,
    { method: "DELETE" }
  );

  if (!response.ok) {
    let msg = "Failed to delete recipe";
    try {
      const err = await response.json();
      msg = err.error || msg;
    } catch (_) {}
    throw new Error(msg);
  }
  return await response.json();
}

async function toggleLikeAPI(recipeId) {
  const response = await fetch(`${API_URL}/recipes/${recipeId}/like`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: currentUser.username })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to toggle like");
  return data; // {status, likes}
}

// per-user favorite toggle
async function toggleFavoriteAPI(recipeId) {
  const response = await fetch(`${API_URL}/recipes/${recipeId}/favorite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: currentUser.username })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to toggle favorite");
  return data; // {status: added|removed}
}

// per-user rating
async function rateRecipeAPI(recipeId, stars) {
  const response = await fetch(`${API_URL}/recipes/${recipeId}/rate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: currentUser.username, stars })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to rate");
  return data; // {avgRating, userRating}
}

async function fetchComments(recipeId) {
  try {
    const response = await fetch(`${API_URL}/comments/${recipeId}`);
    if (!response.ok) throw new Error("Failed to fetch comments");
    return await response.json();
  } catch (error) {
    console.error("fetchComments:", error);
    return [];
  }
}

async function addCommentAPI(recipeId, commentData) {
  const response = await fetch(`${API_URL}/comments/${recipeId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(commentData)
  });

  if (!response.ok) throw new Error("Failed to add comment");
  return await response.json();
}

async function registerAPI(userData) {
  const response = await fetch(`${API_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Registration failed");
  }
  return await response.json();
}

async function loginAPI(credentials) {
  const response = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Login failed");
  }
  return await response.json();
}

/*****************
 * INITIALIZATION
 *****************/
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      if (currentView === "home") renderRecipes();
      else rerenderCurrentView();
    });
  }

  document.getElementById("recipeForm")?.addEventListener("submit", submitRecipe);
  document.getElementById("loginForm")?.addEventListener("submit", handleLogin);
  document.getElementById("signupForm")?.addEventListener("submit", handleSignup);

  // Image upload handlers
  const imageURL = document.getElementById("recipeImageURL");
  const imageFile = document.getElementById("recipeImageFile");

  if (imageURL) {
    imageURL.addEventListener("input", () => {
      if (imageURL.value.trim()) {
        if (imageFile) imageFile.value = "";
        const fileNameDisplay = document.getElementById("fileNameDisplay");
        if (fileNameDisplay) fileNameDisplay.textContent = "Choose image from device";
        updateImagePreview(imageURL.value);
      } else {
        updateImagePreview("");
      }
    });
  }

  if (imageFile) {
    imageFile.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        if (imageURL) imageURL.value = "";
        const fileName = e.target.files[0].name;
        const fileNameDisplay = document.getElementById("fileNameDisplay");
        if (fileNameDisplay) fileNameDisplay.textContent = fileName;

        const reader = new FileReader();
        reader.onload = (event) => updateImagePreview(event.target.result);
        reader.readAsDataURL(e.target.files[0]);
      } else {
        const fileNameDisplay = document.getElementById("fileNameDisplay");
        if (fileNameDisplay) fileNameDisplay.textContent = "Choose image from device";
      }
    });
  }

  // Modal close on backdrop click
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", function (e) {
      if (e.target === this) {
        this.classList.remove("active");
        document.body.style.overflow = "auto";
      }
    });
  });

  // init
  updateAuthArea();
  loadRecipes();
  showHome();
});

function updateImagePreview(src) {
  const preview = document.getElementById("imagePreview");
  if (!preview) return;

  const finalSrc = resolveImageUrl(src);

  if (finalSrc && finalSrc.trim()) {
    preview.innerHTML = `<img src="${finalSrc}" alt="Preview">`;
    preview.style.display = "block";
  } else {
    preview.innerHTML = "";
    preview.style.display = "none";
  }
}

/*****************
 * USER SYSTEM
 *****************/
function updateAuthArea() {
  const area = document.getElementById("authArea");
  if (!area) return;

  if (!currentUser) {
    area.innerHTML = `
      <div class="auth-buttons">
        <button class="auth-btn login" onclick="openLoginModal()">
          <i class="fas fa-sign-in-alt"></i>
          Login
        </button>
        <button class="auth-btn signup" onclick="openSignupModal()">
          <i class="fas fa-user-plus"></i>
          Sign Up
        </button>
      </div>
    `;
  } else {
    area.innerHTML = `
      <div class="user-info">
        <div class="user-avatar" title="${currentUser.username}">
          ${currentUser.username.charAt(0).toUpperCase()}
        </div>
        <button class="logout-btn" onclick="logout()">
          <i class="fas fa-sign-out-alt"></i>
          Logout
        </button>
      </div>
    `;
  }

  const addBtn = document.getElementById("addRecipeBtn");
  if (addBtn) addBtn.style.display = currentUser ? "inline-flex" : "none";
}

/*****************
 * LOGIN/SIGNUP MODALS
 *****************/
function openLoginModal() {
  const modal = document.getElementById("loginModal");
  if (!modal) return;
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
  switchAuthTab("login");
}

function openSignupModal() {
  const modal = document.getElementById("loginModal");
  if (!modal) return;
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
  switchAuthTab("signup");
}

function closeLoginModal() {
  const modal = document.getElementById("loginModal");
  if (!modal) return;
  modal.classList.remove("active");
  document.body.style.overflow = "auto";
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const tabs = document.querySelectorAll(".auth-tab");
  const modalTitle = document.getElementById("loginModalTitle");

  tabs.forEach((t) => t.classList.remove("active"));

  document.querySelectorAll(".auth-tab").forEach((btn) => {
    const text = btn.textContent.toLowerCase();
    if (tab === "login" && text.includes("login")) btn.classList.add("active");
    if (tab === "signup" && (text.includes("sign") || text.includes("signup")))
      btn.classList.add("active");
  });

  if (tab === "login") {
    if (loginForm) loginForm.style.display = "block";
    if (signupForm) signupForm.style.display = "none";
    if (modalTitle) modalTitle.textContent = "Login";
  } else {
    if (loginForm) loginForm.style.display = "none";
    if (signupForm) signupForm.style.display = "block";
    if (modalTitle) modalTitle.textContent = "Sign Up";
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const username = document.getElementById("loginUsername")?.value.trim();
  const password = document.getElementById("loginPassword")?.value.trim();

  if (!username || !password) {
    showToast("Please fill in all fields", "error");
    return;
  }

  try {
    const result = await loginAPI({ username, password });

    currentUser = {
      id: result.user.id,
      username: result.user.username,
      role: result.user.role
    };

    localStorage.setItem("currentUser", JSON.stringify(currentUser));

    closeLoginModal();
    updateAuthArea();
    await loadRecipes();
    showToast(`Welcome back, ${username}!`);

    document.getElementById("loginUsername").value = "";
    document.getElementById("loginPassword").value = "";
  } catch (error) {
    showToast(error.message || "Login failed. Please try again.", "error");
    console.error(error);
  }
}

async function handleSignup(event) {
  event.preventDefault();

  const username = document.getElementById("signupUsername")?.value.trim();
  const password = document.getElementById("signupPassword")?.value.trim();
  const confirmPassword = document.getElementById("signupConfirmPassword")?.value.trim();

  if (!username || username.length < 3) {
    showToast("Username must be at least 3 characters", "error");
    return;
  }

  if (!password || password.length < 6) {
    showToast("Password must be at least 6 characters", "error");
    return;
  }

  if (password !== confirmPassword) {
    showToast("Passwords do not match", "error");
    return;
  }

  try {
    const result = await registerAPI({ username, password, role: "user" });

    currentUser = {
      id: result.user.id,
      username: result.user.username,
      role: result.user.role
    };

    localStorage.setItem("currentUser", JSON.stringify(currentUser));

    closeLoginModal();
    updateAuthArea();
    await loadRecipes();
    showToast(`Account created! Welcome, ${username}!`);

    document.getElementById("signupUsername").value = "";
    document.getElementById("signupPassword").value = "";
    document.getElementById("signupConfirmPassword").value = "";
  } catch (error) {
    showToast(error.message || "Registration failed. Please try again.", "error");
    console.error(error);
  }
}

function logout() {
  localStorage.removeItem("currentUser");
  currentUser = null;

  // reset per-user sets
  likedRecipes = new Set();
  favoriteRecipes = new Set();
  ratingsMap = new Map();

  updateAuthArea();
  loadRecipes();
  showToast("Logged out successfully");
}

/*****************
 * VIEW MANAGEMENT
 *****************/
function showHome() {
  currentView = "home";
  updateNavigation("Home");
  showView("homeView");
  loadRecipes();
}

// ✅ Instead of separate categories page, we use it as FILTERS view
function showCategories() {
  currentView = "categories";
  updateNavigation("Categories");
  showView("categoriesView");
  renderCategories(); // ✅ bring back categories list/cards
}


function showFavorites() {
  if (!currentUser) {
    showToast("Please login to view favorites", "error");
    openLoginModal();
    return;
  }
  currentView = "favorites";
  updateNavigation("Favorites");
  showView("favoritesView");
  renderFavorites();
}

function showMyRecipes() {
  if (!currentUser) {
    showToast("Please login to view your recipes", "error");
    openLoginModal();
    return;
  }
  currentView = "myRecipes";
  updateNavigation("My Recipes");
  showView("myRecipesView");
  renderMyRecipes();
}

function showAbout() {
  currentView = "about";
  updateNavigation("About");
  showView("aboutView");
}

function updateNavigation(activeLink) {
  const navLinks = document.querySelectorAll(".nav-link");
  navLinks.forEach((link) => {
    link.classList.remove("active");
    const label = link.getAttribute("data-label");
    if (label === activeLink) link.classList.add("active");
  });
}

function showView(viewId) {
  const views = ["homeView", "categoriesView", "favoritesView", "myRecipesView", "aboutView"];
  views.forEach((v) => document.getElementById(v)?.classList.remove("active"));
  document.getElementById(viewId)?.classList.add("active");
}
function rerenderCurrentView() {
  if (currentView === "home") renderRecipes();
  else if (currentView === "categories") renderCategories();
  else if (currentView === "favorites") renderFavorites();
  else if (currentView === "myRecipes") renderMyRecipes();
}


/*****************
 * FILTERS VIEW (replaces categories list)
 *****************/
function renderStarsAvg(avg) {
  const rating = Number(avg || 0);
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  let html = "";

  for (let i = 1; i <= 5; i++) {
    if (i <= full) html += `<i class="fas fa-star star"></i>`;
    else if (i === full + 1 && half) html += `<i class="fas fa-star-half-alt star"></i>`;
    else html += `<i class="far fa-star star empty"></i>`;
  }
  return html;
}

// clickable rating for user
function renderUserRating(recipeId) {
  const my = Number(ratingsMap.get(recipeId) || 0);
  let html = `<div class="rate-box" data-recipe="${recipeId}">`;
  for (let i = 1; i <= 5; i++) {
    html += `
      <button class="rate-star ${i <= my ? "active" : ""}"
              type="button"
              aria-label="Rate ${i}"
              onclick="event.stopPropagation(); setRating(${recipeId}, ${i})">
        <i class="${i <= my ? "fas" : "far"} fa-star"></i>
      </button>
    `;
  }
  html += `</div>`;
  return html;
}

async function setRating(recipeId, stars) {
  if (!currentUser) {
    showToast("Please login to rate recipes", "error");
    openLoginModal();
    return;
  }

  try {
    const res = await rateRecipeAPI(recipeId, stars);
    ratingsMap.set(recipeId, stars);

    // update recipe avg rating locally
    const r = recipes.find(x => x.id === recipeId);
    if (r) {
      r.rating = res.avgRating;
      r.userRating = res.userRating;
    }

    showToast(`Rated ${stars}★`);
    rerenderCurrentView();

    // if modal open for this recipe, update it
    if (currentRecipeId === recipeId) {
      document.getElementById("modalRating").textContent = res.avgRating ?? 0;
      document.getElementById("modalRatingStars").innerHTML = renderStarsAvg(res.avgRating || 0);
      document.getElementById("modalUserRate").innerHTML = renderUserRating(recipeId);
    }
  } catch (e) {
    console.error("setRating:", e);
    showToast(e.message || "Error rating", "error");
  }
}

/*****************
 * RECIPE MANAGEMENT
 *****************/
async function loadRecipes() {
  recipes = await fetchRecipes();
  rerenderCurrentView();
}

function createRecipeCard(recipe) {
  const isLiked = likedRecipes.has(recipe.id);
  const isFavorited = favoriteRecipes.has(recipe.id);
  const isMyRecipe = currentUser && recipe.author === currentUser.username;

  let imgSrc = resolveImageUrl(recipe.image);
  if (!imgSrc) imgSrc = DEFAULT_IMAGE;

  return `
    <div class="recipe-card">
      <div class="recipe-image-container">
        <img src="${imgSrc}" alt="${escapeHtml(recipe.title || "")}" class="recipe-image" onclick="showRecipeDetail(${recipe.id})">

        <div class="recipe-actions">
          <button class="action-btn save-btn ${isFavorited ? "saved" : ""}"
                  onclick="event.stopPropagation(); toggleFavorite(${recipe.id}, this)"
                  title="Save">
            <i class="fas fa-bookmark"></i>
          </button>
        </div>

        <div class="recipe-category">${escapeHtml(recipe.category || "")}</div>
        ${isMyRecipe ? `<div class="recipe-category" style="right:10px; left:auto; background: var(--success); color:#fff;">My Recipe</div>` : ""}
      </div>

      <div class="recipe-info">
        <h3 class="recipe-title" onclick="showRecipeDetail(${recipe.id})">${escapeHtml(recipe.title || "")}</h3>

        <p class="recipe-author">
          <i class="fas fa-user"></i>
          by ${escapeHtml(recipe.author || "Unknown")}
        </p>

        <div class="recipe-meta">
          <div class="recipe-stats">
            <div class="stat-item">
              <i class="fas fa-clock"></i>
              ${recipe.prepTime ?? ""} min
            </div>
            <div class="stat-item">
              <i class="fas fa-heart"></i>
              ${recipe.likes ?? 0} likes
            </div>
          </div>

          <div class="recipe-rating" title="Average rating">
            <div class="star-rating">${renderStarsAvg(recipe.rating || 0)}</div>
            <span class="rating-value">${Number(recipe.rating || 0).toFixed(1)}</span>
          </div>
        </div>

        <div class="user-rate-row">
          <span class="user-rate-label">Your rating:</span>
          ${renderUserRating(recipe.id)}
        </div>

        <div class="recipe-actions-bottom">
          <button class="btn-small like-btn ${isLiked ? "liked" : ""}"
                  onclick="event.stopPropagation(); toggleLike(${recipe.id}, this)">
            <i class="fas fa-heart"></i>
            <span class="like-count">${recipe.likes ?? 0}</span>
          </button>

          <button class="btn-small" onclick="event.stopPropagation(); shareRecipe(${recipe.id})">
            <i class="fas fa-share"></i>
            Share
          </button>

          ${isMyRecipe ? `
            <button class="btn-small" onclick="event.stopPropagation(); editRecipe(${recipe.id})">
              <i class="fas fa-edit"></i>
              Edit
            </button>
            <button class="btn-small" onclick="event.stopPropagation(); deleteRecipe(${recipe.id})">
              <i class="fas fa-trash"></i>
              Delete
            </button>
          ` : ""}
        </div>
      </div>
    </div>
  `;
}

function renderRecipes() {
  const grid = document.getElementById("recipeGrid");
  if (!grid) return;

  const list = getFilteredRecipes();

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-search"></i>
        <h3>No recipes found</h3>
        <p>Try adjusting your search or filters.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(createRecipeCard).join("");
}
function getCategoryIcon(category) {
  const c = String(category || "").toLowerCase();

  if (c.includes("dessert")) return "fa-ice-cream";
  if (c.includes("breakfast")) return "fa-mug-hot";
  if (c.includes("quick")) return "fa-bolt";
  if (c.includes("vegetarian")) return "fa-leaf";
  if (c.includes("main")) return "fa-drumstick-bite";

  return "fa-utensils"; // default
}

function renderCategories() {
  const grid = document.getElementById("categoriesGrid");
  if (!grid) return;

  const counts = {};
  for (const r of recipes) {
    const cat = (r.category || "").trim();
    if (!cat) continue;
    counts[cat] = (counts[cat] || 0) + 1;
  }

  const categories = Object.keys(counts).sort((a, b) => a.localeCompare(b));

  if (categories.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-th-large"></i>
        <h3>No categories yet</h3>
        <p>Add some recipes first and categories will appear here.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = categories
    .map((cat) => `
      <div class="category-card" onclick="openCategory('${escapeHtml(cat)}')">
        <i class="fas ${getCategoryIcon(cat)}"></i>
        <h3>${escapeHtml(cat)}</h3>
        <p>Browse recipes in this category</p>
        <span class="category-count">${counts[cat]} recipes</span>
      </div>
    `)
    .join("");
}
function openCategory(categoryName) {
  // optional: jump to home and show only this category (simple)
  currentView = "home";
  updateNavigation("Home");
  showView("homeView");

  // simple filter: render only category (without your old filters system)
  const grid = document.getElementById("recipeGrid");
  if (!grid) return;

  const list = recipes.filter(r => (r.category || "").trim() === categoryName);

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-search"></i>
        <h3>No recipes found</h3>
        <p>No recipes in ${escapeHtml(categoryName)} yet.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(createRecipeCard).join("");
}


function getFilteredRecipes() {
  let filtered = [...recipes];

  // search text ONLY
  const searchInput = document.getElementById("searchInput");
  const q = searchInput ? searchInput.value.toLowerCase().trim() : "";

  if (q) {
    filtered = filtered.filter(
      (r) =>
        (r.title || "").toLowerCase().includes(q) ||
        (r.author || "").toLowerCase().includes(q) ||
        (r.category || "").toLowerCase().includes(q) ||
        (Array.isArray(r.ingredients) &&
          r.ingredients.some((ing) => (ing || "").toLowerCase().includes(q)))
    );
  }

  return filtered; // ✅ no category/time/sort filtering anymore
}


/*****************
 * FAVORITES VIEW
 *****************/
function renderFavorites() {
  const favoritesGrid = document.getElementById("favoritesGrid");
  if (!favoritesGrid) return;

  const list = recipes.filter((r) => favoriteRecipes.has(r.id));

  if (list.length === 0) {
    favoritesGrid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-bookmark"></i>
        <h3>No favorites yet</h3>
        <p>Start exploring recipes and save your favorites!</p>
      </div>
    `;
    return;
  }

  favoritesGrid.innerHTML = list.map(createRecipeCard).join("");
}

/*****************
 * MY RECIPES VIEW
 *****************/
function renderMyRecipes() {
  const myRecipesGrid = document.getElementById("myRecipesGrid");
  if (!myRecipesGrid) return;

  const my = recipes.filter((r) => currentUser && r.author === currentUser.username);

  if (my.length === 0) {
    myRecipesGrid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-utensils"></i>
        <h3>No recipes yet</h3>
        <p>Share your first recipe with the community!</p>
      </div>
    `;
    return;
  }

  myRecipesGrid.innerHTML = my.map(createRecipeCard).join("");
}

/*****************
 * LIKE SYSTEM (per-user + animation)
 *****************/
async function toggleLike(recipeId, button = null) {
  if (!currentUser) {
    showToast("Please login to like recipes", "error");
    openLoginModal();
    return;
  }

  try {
    // animation immediately (optimistic)
    if (button) {
      button.classList.add("heart-beat");
      setTimeout(() => button.classList.remove("heart-beat"), 650);
      spawnLikeBurst(button);
    }

    const data = await toggleLikeAPI(recipeId);

    // update local sets
    if (data.status === "liked") likedRecipes.add(recipeId);
    else likedRecipes.delete(recipeId);

    // update local recipe likes count
    const r = recipes.find(x => x.id === recipeId);
    if (r) r.likes = data.likes;

    showToast(`Recipe ${data.status}!`);
    rerenderCurrentView();

    // if modal open, update modal likes too
    if (currentRecipeId === recipeId) {
      const el = document.getElementById("modalLikes");
      if (el) el.textContent = data.likes ?? 0;
    }
  } catch (error) {
    console.error("Like error:", error);
    showToast(error.message || "Error updating like", "error");
  }
}

function spawnLikeBurst(button) {
  // create little hearts that fly up
  const rect = button.getBoundingClientRect();
  const burst = document.createElement("div");
  burst.className = "like-burst";
  burst.style.left = `${rect.left + rect.width / 2}px`;
  burst.style.top = `${rect.top + rect.height / 2}px`;

  burst.innerHTML = `
    <span class="burst-heart">❤</span>
    <span class="burst-heart">❤</span>
    <span class="burst-heart">❤</span>
  `;

  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 700);
}

/*****************
 * FAVORITES SYSTEM (per-user)
 *****************/
async function toggleFavorite(recipeId, button = null) {
  if (!currentUser) {
    showToast("Please login to save recipes", "error");
    openLoginModal();
    return;
  }

  try {
    const data = await toggleFavoriteAPI(recipeId);

    if (data.status === "added") {
      favoriteRecipes.add(recipeId);
      showToast("Added to favorites!");
    } else {
      favoriteRecipes.delete(recipeId);
      showToast("Removed from favorites");
    }

    if (button) {
      button.classList.toggle("saved", favoriteRecipes.has(recipeId));
      button.classList.add("bookmark-pop");
      setTimeout(() => button.classList.remove("bookmark-pop"), 300);
    }

    rerenderCurrentView();
  } catch (e) {
    console.error("toggleFavorite:", e);
    showToast(e.message || "Error updating favorite", "error");
  }
}

/*****************
 * RECIPE DETAIL MODAL
 *****************/
async function showRecipeDetail(id) {
  const recipe = recipes.find((r) => r.id === id);
  if (!recipe) {
    showToast("Recipe not found", "error");
    return;
  }

  currentRecipeId = id;

  const modalImg = resolveImageUrl(recipe.image) || DEFAULT_IMAGE;
  document.getElementById("modalImage").src = modalImg;

  document.getElementById("modalTitle").textContent = recipe.title || "";
  document.getElementById("modalAuthor").textContent = "by " + (recipe.author || "");
  document.getElementById("modalTime").textContent = (recipe.prepTime ?? "") + " min";
  document.getElementById("modalCategory").textContent = recipe.category || "";
  document.getElementById("modalLikes").textContent = recipe.likes ?? 0;

  document.getElementById("modalRating").textContent = Number(recipe.rating || 0).toFixed(1);
  document.getElementById("modalRatingStars").innerHTML = renderStarsAvg(recipe.rating || 0);

  // ✅ Add user rate UI in modal (you need a div with id="modalUserRate" in HTML)
  const modalUserRate = document.getElementById("modalUserRate");
  if (modalUserRate) modalUserRate.innerHTML = renderUserRating(recipe.id);

  const ingredientsList = document.getElementById("modalIngredients");
  ingredientsList.innerHTML = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.map((ing) => `<li>${escapeHtml(ing)}</li>`).join("")
    : "";

  const stepsList = document.getElementById("modalSteps");
  stepsList.innerHTML = Array.isArray(recipe.steps)
    ? recipe.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")
    : "";

  const commentFormContainer = document.getElementById("commentFormContainer");
  if (currentUser) {
    commentFormContainer.innerHTML = `
      <div class="comment-form">
        <textarea id="commentInput" placeholder="Add your comment..."></textarea>
        <button type="button" onclick="addComment()">
          <i class="fas fa-paper-plane"></i>
          Post Comment
        </button>
      </div>
    `;
  } else {
    commentFormContainer.innerHTML = `
      <div class="comment-form">
        <p style="text-align:center; color: var(--gray); padding:20px;">
          <i class="fas fa-lock"></i>
          Please <a href="#" onclick="openLoginModal()" style="color: var(--primary);">login</a> to add comments
        </p>
      </div>
    `;
  }

  await loadComments(id);

  document.getElementById("recipeModal")?.classList.add("active");
  document.body.style.overflow = "hidden";
}

async function loadComments(recipeId) {
  const container = document.getElementById("commentsContainer");
  if (!container) return;

  container.innerHTML = `<p style="color: var(--gray-light); text-align:center; padding:20px;">Loading comments...</p>`;

  try {
    const comments = await fetchComments(recipeId);

    if (!comments || comments.length === 0) {
      container.innerHTML = `<p style="color: var(--gray-light); text-align:center; padding:20px;">No comments yet. Be the first to comment!</p>`;
      return;
    }

    container.innerHTML = comments
      .map(
        (comment) => `
      <div class="comment">
        <div class="avatar">${escapeHtml((comment.user || "U").charAt(0).toUpperCase())}</div>
        <div class="comment-content">
          <div class="comment-header">
            <div class="comment-author">${escapeHtml(comment.user || "Unknown")}</div>
          </div>
          <div class="comment-text">${escapeHtml(comment.content || "")}</div>
        </div>
      </div>
    `
      )
      .join("");
  } catch (error) {
    container.innerHTML = `<p style="color: var(--gray-light); text-align:center; padding:20px;">Error loading comments</p>`;
  }
}

async function addComment() {
  if (!currentUser) {
    showToast("Please login to comment", "error");
    openLoginModal();
    return;
  }

  const commentInput = document.getElementById("commentInput");
  if (!commentInput) return;

  const commentText = commentInput.value.trim();
  if (!commentText) {
    showToast("Please enter a comment", "error");
    return;
  }

  if (!currentRecipeId) return;

  try {
    await addCommentAPI(currentRecipeId, {
      user_id: currentUser.id,
      content: commentText
    });

    commentInput.value = "";
    await loadComments(currentRecipeId);
    showToast("Comment added successfully");
  } catch (error) {
    showToast("Error adding comment", "error");
  }
}

function closeModal() {
  document.getElementById("recipeModal")?.classList.remove("active");
  document.body.style.overflow = "auto";
  currentRecipeId = null;
}

/*****************
 * SHARE FUNCTION
 *****************/
function shareRecipe(id) {
  const recipe = recipes.find((r) => r.id === id);
  if (!recipe) return;

  const shareText = `Check out this recipe: ${recipe.title} on Pocket Chef`;
  const shareUrl = `${window.location.href.split("#")[0]}#recipe-${id}`;

  const shareButtons = document.querySelectorAll(`[onclick*="shareRecipe(${id})"]`);
  shareButtons.forEach((btn) => {
    btn.style.transform = "scale(1.08)";
    setTimeout(() => (btn.style.transform = "scale(1)"), 250);
  });

  if (navigator.share) {
    navigator.share({
      title: recipe.title,
      text: shareText,
      url: shareUrl
    });
  } else {
    const copyText = `${shareText}\n${shareUrl}`;
    navigator.clipboard?.writeText(copyText).then(() => {
      showToast("Link copied to clipboard!");
    }).catch(() => {
      const textArea = document.createElement("textarea");
      textArea.value = copyText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      showToast("Link copied to clipboard!");
    });
  }
}

/*****************
 * ADD RECIPE MODAL
 *****************/
function showAddRecipeModal() {
  if (!currentUser) {
    showToast("Please login to add recipes", "error");
    openLoginModal();
    return;
  }
  document.getElementById("addRecipeModal")?.classList.add("active");
  document.body.style.overflow = "hidden";
  const titleEl = document.querySelector(".modal-title");
  if (titleEl) titleEl.textContent = "Share Your Recipe";
}

function closeAddRecipeModal() {
  document.getElementById("addRecipeModal")?.classList.remove("active");
  document.body.style.overflow = "auto";

  const form = document.getElementById("recipeForm");
  if (form) {
    form.reset();
    delete form.dataset.editId;
  }

  const fileNameDisplay = document.getElementById("fileNameDisplay");
  if (fileNameDisplay) fileNameDisplay.textContent = "Choose image from device";

  updateImagePreview("");
  resetFormFields();
}

function resetFormFields() {
  const ing = document.getElementById("ingredientsContainer");
  const inst = document.getElementById("instructionsContainer");

  if (ing) {
    ing.innerHTML = `
      <div class="ingredient-row">
        <input type="text" class="ingredient-input" placeholder="e.g., 2 cups all-purpose flour">
        <button type="button" class="remove-btn" onclick="removeIngredient(this)">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
  }

  if (inst) {
    inst.innerHTML = `
      <div class="instruction-row">
        <textarea class="instruction-input" placeholder="e.g., Preheat oven to 350°F" rows="2"></textarea>
        <button type="button" class="remove-btn" onclick="removeInstruction(this)">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
  }
}

function addIngredientField() {
  const container = document.getElementById("ingredientsContainer");
  if (!container) return;

  const div = document.createElement("div");
  div.className = "ingredient-row";
  div.innerHTML = `
    <input type="text" class="ingredient-input" placeholder="e.g., 2 cups all-purpose flour">
    <button type="button" class="remove-btn" onclick="removeIngredient(this)">
      <i class="fas fa-times"></i>
    </button>
  `;
  container.appendChild(div);
}

function removeIngredient(button) {
  const rows = document.querySelectorAll(".ingredient-row");
  if (rows.length > 1) button.parentElement.remove();
}

function addInstructionField() {
  const container = document.getElementById("instructionsContainer");
  if (!container) return;

  const div = document.createElement("div");
  div.className = "instruction-row";
  div.innerHTML = `
    <textarea class="instruction-input" placeholder="e.g., Preheat oven to 350°F" rows="2"></textarea>
    <button type="button" class="remove-btn" onclick="removeInstruction(this)">
      <i class="fas fa-times"></i>
    </button>
  `;
  container.appendChild(div);
}

function removeInstruction(button) {
  const rows = document.querySelectorAll(".instruction-row");
  if (rows.length > 1) button.parentElement.remove();
}

// ✅ URL OR file upload: we send FormData always.
async function submitRecipe(event) {
  event.preventDefault();

  const title = document.getElementById("recipeTitle")?.value.trim();
  const category = document.getElementById("recipeCategory")?.value;
  const prepTime = document.getElementById("recipeTime")?.value;

  const imageURL = document.getElementById("recipeImageURL")?.value.trim() || "";
  const imageFile = document.getElementById("recipeImageFile")?.files?.[0] || null;

  const ingredients = Array.from(document.querySelectorAll(".ingredient-input"))
    .map((i) => i.value.trim()).filter(Boolean);

  const steps = Array.from(document.querySelectorAll(".instruction-input"))
    .map((i) => i.value.trim()).filter(Boolean);

  if (!title || !category || !prepTime || ingredients.length === 0 || steps.length === 0) {
    showToast("Please fill all required fields", "error");
    return;
  }

  const form = document.getElementById("recipeForm");
  const editId = form?.dataset?.editId;

  try {
    if (editId) {
      const recipeData = {
        title,
        category,
        prepTime: parseInt(prepTime, 10),
        image: imageURL || (recipes.find((r) => r.id === Number(editId))?.image || ""),
        ingredients,
        steps,
        author: currentUser.username
      };

      await updateRecipeAPI(Number(editId), recipeData);
      showToast("Recipe updated successfully!");
    } else {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("category", category);
      formData.append("prepTime", String(parseInt(prepTime, 10)));
      formData.append("ingredients", JSON.stringify(ingredients));
      formData.append("steps", JSON.stringify(steps));
      formData.append("author", currentUser.username);

      if (imageFile) {
        formData.append("image", imageFile);
      } else if (imageURL) {
        formData.append("image", imageURL);
      }

      await addRecipeAPI(formData);
      showToast("Recipe added successfully!");
    }

    closeAddRecipeModal();
    await loadRecipes();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Error saving recipe. Please try again.", "error");
  }
}

/*****************
 * EDIT / DELETE
 *****************/
function editRecipe(id) {
  const recipe = recipes.find((r) => r.id === id);
  if (!recipe) return;

  document.getElementById("recipeTitle").value = recipe.title || "";
  document.getElementById("recipeCategory").value = recipe.category || "";
  document.getElementById("recipeTime").value = recipe.prepTime ?? "";

  const fullImg = resolveImageUrl(recipe.image);
  document.getElementById("recipeImageURL").value = fullImg || "";
  updateImagePreview(fullImg || "");

  const ingredientsContainer = document.getElementById("ingredientsContainer");
  const instructionsContainer = document.getElementById("instructionsContainer");

  if (ingredientsContainer) ingredientsContainer.innerHTML = "";
  if (instructionsContainer) instructionsContainer.innerHTML = "";

  (recipe.ingredients || []).forEach((ingredient) => {
    const div = document.createElement("div");
    div.className = "ingredient-row";
    div.innerHTML = `
      <input type="text" class="ingredient-input" value="${escapeHtml(ingredient)}">
      <button type="button" class="remove-btn" onclick="removeIngredient(this)">
        <i class="fas fa-times"></i>
      </button>
    `;
    ingredientsContainer.appendChild(div);
  });

  (recipe.steps || []).forEach((step) => {
    const div = document.createElement("div");
    div.className = "instruction-row";
    div.innerHTML = `
      <textarea class="instruction-input" rows="2">${escapeHtml(step)}</textarea>
      <button type="button" class="remove-btn" onclick="removeInstruction(this)">
        <i class="fas fa-times"></i>
      </button>
    `;
    instructionsContainer.appendChild(div);
  });

  const form = document.getElementById("recipeForm");
  form.dataset.editId = id;

  showAddRecipeModal();
  const titleEl = document.querySelector(".modal-title");
  if (titleEl) titleEl.textContent = "Edit Recipe";
}

async function deleteRecipe(id) {
  if (!confirm("Are you sure you want to delete this recipe?")) return;

  try {
    await deleteRecipeAPI(id);

    // also clear local sets
    likedRecipes.delete(id);
    favoriteRecipes.delete(id);
    ratingsMap.delete(id);

    await loadRecipes();
    showToast("Recipe deleted successfully!");
  } catch (error) {
    console.error(error);
    showToast("Error deleting recipe. Please try again.", "error");
  }
}

/*****************
 * TOAST NOTIFICATION
 *****************/
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toastMessage");
  if (!toast || !toastMessage) return;

  toastMessage.textContent = message;

  const icon = toast.querySelector("i");
  if (icon) {
    if (type === "error") {
      icon.className = "fas fa-exclamation-circle";
      icon.style.color = "var(--error)";
    } else {
      icon.className = "fas fa-check-circle";
      icon.style.color = "var(--success)";
    }
  }

  toast.classList.add("show");
  setTimeout(hideToast, 4000);
}

function hideToast() {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.classList.remove("show");
}

/*****************
 * Utils
 *****************/
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
