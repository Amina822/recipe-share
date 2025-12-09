/*****************
 * CONFIG — BACKEND URL
 *****************/
// For local development
const API = "http://localhost:5000";

// For production (uncomment when deployed)
// const API = "https://recipe-backend-2qex.onrender.com";

/*****************
 * USER SYSTEM
 *****************/
let currentUser = JSON.parse(localStorage.getItem("currentUser")) || null;
let recipes = [];

function updateAuthArea() {
    const area = document.getElementById("authArea");
    const addBtn = document.getElementById("addRecipeBtn");

    if (!currentUser) {
        area.innerHTML = `
            <div class="auth-buttons">
                <button class="login-btn" onclick="openLoginModal()">Login</button>
                <button class="signup-btn" onclick="openSignupModal()">Sign Up</button>
            </div>
        `;
        if (addBtn) addBtn.style.display = "none";
    } else {
        area.innerHTML = `
            <div class="user-info">
                👤 ${currentUser.username} — ${currentUser.role}
                <button class="logout-btn" onclick="logout()">Logout</button>
            </div>
        `;
        if (addBtn) addBtn.style.display = "inline-block";
    }
}

/*****************
 * LOGIN / REGISTER MODALS
 *****************/
function openLoginModal() {
    const modal = document.getElementById("loginModal");
    const box = document.getElementById("loginContent");

    box.innerHTML = `
        <h2 style="font-family:Georgia;margin-bottom:20px">Login</h2>
        <input id="loginUser" placeholder="Username" style="width:100%;padding:12px;margin-bottom:15px">
        <input id="loginPass" type="password" placeholder="Password" style="width:100%;padding:12px;margin-bottom:20px">
        <button onclick="doLogin()" style="padding:12px 24px;cursor:pointer">Login</button>
        <button onclick="closeModal('loginModal')" style="padding:12px 24px;margin-left:10px;cursor:pointer;background:#e9ecef;color:#333">Cancel</button>
        <p style="margin-top:20px;color:#777;font-size:0.9em">
            Don't have an account? <span style="color:#667eea;cursor:pointer;font-weight:500" onclick="openSignupModal()">Sign Up</span>
        </p>
    `;

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
}

function openSignupModal() {
    const modal = document.getElementById("loginModal");
    const box = document.getElementById("loginContent");

    box.innerHTML = `
        <h2 style="font-family:Georgia;margin-bottom:20px">Sign Up</h2>
        <input id="regUser" placeholder="Username (min 3 chars)" style="width:100%;padding:12px;margin-bottom:15px">
        <input id="regPass" type="password" placeholder="Password (min 6 chars)" style="width:100%;padding:12px;margin-bottom:15px">
        <input id="regPass2" type="password" placeholder="Confirm Password" style="width:100%;padding:12px;margin-bottom:20px">
        <button onclick="doRegister()" style="padding:12px 24px;cursor:pointer">Create Account</button>
        <button onclick="closeModal('loginModal')" style="padding:12px 24px;margin-left:10px;cursor:pointer;background:#e9ecef;color:#333">Cancel</button>
        <p style="margin-top:20px;color:#777;font-size:0.9em">
            Already have an account? <span style="color:#667eea;cursor:pointer;font-weight:500" onclick="openLoginModal()">Login</span>
        </p>
    `;

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
}

async function doLogin() {
    const username = document.getElementById("loginUser").value.trim();
    const password = document.getElementById("loginPass").value.trim();

    if (!username || !password) return alert("Fill all fields");

    try {
        let response = await fetch(`${API}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        let data = await response.json();
        if (data.error) return alert("Invalid username or password");

        currentUser = data.user;
        localStorage.setItem("currentUser", JSON.stringify(currentUser));

        closeModal("loginModal");
        updateAuthArea();
        loadRecipes();
        alert(`Welcome back, ${username}!`);
    } catch (error) {
        alert("Connection error. Make sure the backend is running.");
        console.error(error);
    }
}

async function doRegister() {
    const username = document.getElementById("regUser").value.trim();
    const pass = document.getElementById("regPass").value.trim();
    const pass2 = document.getElementById("regPass2").value.trim();

    if (username.length < 3) return alert("Username must be ≥ 3 chars");
    if (pass.length < 6) return alert("Password must be ≥ 6 chars");
    if (pass !== pass2) return alert("Passwords do not match");

    try {
        let response = await fetch(`${API}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password: pass, role: "user" })
        });

        let data = await response.json();
        if (data.error) return alert("Username already taken");

        currentUser = data.user;
        localStorage.setItem("currentUser", JSON.stringify(currentUser));

        closeModal("loginModal");
        updateAuthArea();
        loadRecipes();
        alert(`Account created! Welcome, ${username}!`);
    } catch (error) {
        alert("Connection error. Make sure the backend is running.");
        console.error(error);
    }
}

function logout() {
    localStorage.removeItem("currentUser");
    currentUser = null;
    updateAuthArea();
    loadRecipes();
    alert("Logged out successfully");
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove("active");
    document.body.style.overflow = "auto";
}

/*****************
 * LOAD RECIPES
 *****************/
async function loadRecipes() {
    try {
        const response = await fetch(`${API}/recipes`);
        recipes = await response.json();
        renderHero();
        renderRecipes();
    } catch (error) {
        console.error("Error loading recipes:", error);
        document.getElementById("recipeGrid").innerHTML =
            `<p style="grid-column:1/-1;text-align:center;color:#d63031;">
                Cannot connect to backend. Make sure Flask is running on port 5000.
            </p>`;
    }
}

/*****************
 * HERO SECTION
 *****************/
function renderHero() {
    const hero = document.getElementById("heroSection");

    if (recipes.length === 0) {
        hero.innerHTML = `
            <div class="hero">
                <img class="hero-image" src="https://images.unsplash.com/photo-1504674900247-0877df9cc836">
                <div class="hero-content">
                    <h2 class="hero-title">No recipes yet</h2>
                    <p class="hero-meta">Be the first to add one!</p>
                </div>
            </div>`;
        return;
    }

    let featured = recipes.reduce((a, b) => (a.likes >= b.likes ? a : b));

    hero.innerHTML = `
        <div class="hero" onclick="showRecipeDetail(${featured.id})">
            <img class="hero-image" src="${featured.image}">
            <div class="hero-content">
                <h2 class="hero-title">${featured.title}</h2>
                <p class="hero-meta">⏱️ ${featured.prepTime} min • 📁 ${featured.category} • 👤 ${featured.author} • ❤️ ${featured.likes} likes</p>
                <div class="hero-btn">View Recipe →</div>
            </div>
        </div>
    `;
}

/*****************
 * RENDER STARS — ADDED
 *****************/
function renderStars(rating) {
    return [...Array(5)].map((_, i) =>
        `<i class="fa-solid fa-star" style="color:${i < rating ? "#ffcc00" : "#ccc"}"></i>`
    ).join("");
}

/*****************
 * RECIPE GRID
 *****************/
/*****************
 * OPEN UPLOAD MODAL — FIXED
 *****************/
function openUploadModal() {
    const modal = document.getElementById("uploadModal");
    const box = document.getElementById("uploadContent");

    box.innerHTML = `
        <div style="position:relative; max-height:80vh; overflow-y:auto;">
            <div onclick="closeModal('uploadModal')"
                style="position:sticky;top:0;text-align:right;font-size:32px;color:#555;cursor:pointer;background:white;padding:5px 10px;">
                &times;
            </div>

            <h2 style="font-family:Georgia;margin-bottom:15px">Add New Recipe</h2>

            <input id="upTitle" placeholder="Title" style="width:100%;padding:12px;margin-bottom:15px">

            <select id="upCategory" style="width:100%;padding:12px;margin-bottom:15px">
                <option>Vegetarian</option>
                <option>Dessert</option>
                <option>Quick</option>
                <option>Main Course</option>
                <option>Breakfast</option>
            </select>

            <input id="upTime" type="number" placeholder="Prep Time (min)" style="width:100%;padding:12px;margin-bottom:15px">

            <input id="upImage" placeholder="Image URL" style="width:100%;padding:12px;margin-bottom:15px">

            <textarea id="upIngredients" placeholder="Ingredients (one per line)" 
                style="width:100%;height:120px;padding:12px;margin-bottom:15px"></textarea>

            <textarea id="upSteps" placeholder="Steps (one per line)"
                style="width:100%;height:120px;padding:12px;margin-bottom:15px"></textarea>

            <button onclick="submitNewRecipe()" style="padding:12px 24px;cursor:pointer">Add Recipe</button>
            <button onclick="closeModal('uploadModal')" 
                style="padding:12px 24px;margin-left:10px;cursor:pointer;background:#e9ecef;color:#333">Cancel</button>
        </div>
    `;

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
}

function renderRecipes() {
    const grid = document.getElementById("recipeGrid");
    const search = document.getElementById("searchInput").value.toLowerCase();
    const category = document.getElementById("categoryFilter").value;
    const time = document.getElementById("timeFilter").value;

    let filtered = recipes.filter(r => {
        let matchName = r.title.toLowerCase().includes(search);
        let matchIng = r.ingredients && r.ingredients.some(i => i.toLowerCase().includes(search));
        let matchCat = !category || r.category === category;
        let matchTime = !time || r.prepTime <= Number(time);
        return (matchName || matchIng) && matchCat && matchTime;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#777;">No recipes found.</p>`;
        return;
    }

    grid.innerHTML = filtered.map(r => {
        const isSaved = currentUser?.favorites?.includes(r.id);
        const isLiked = r.likes > 0;

        return `
        <div class="recipe-card" style="position:relative;">
            <button class="fav-btn"
                onclick="event.stopPropagation(); toggleFavorite(${r.id})"
                style="
                    position:absolute;top:10px;right:10px;
                    background:white;border:none;border-radius:50%;
                    width:40px;height:40px;display:flex;align-items:center;
                    justify-content:center;font-size:20px;cursor:pointer;
                    box-shadow:0 2px 6px rgba(0,0,0,0.2);
                ">
                ${isSaved ? "❤️" : "🤍"}
            </button>

            <img class="recipe-image" src="${r.image}" onclick="showRecipeDetail(${r.id})">

            <div class="recipe-content">
                <h3 class="recipe-title" onclick="showRecipeDetail(${r.id})">${r.title}</h3>
                <span class="recipe-category">${r.category}</span>

                <p style="color:#666;margin:10px 0">⏱️ ${r.prepTime} min • ❤️ ${r.likes} likes</p>

                <div class="recipe-rating" style="margin:6px 0;">
                    ${renderStars(r.rating || 0)}
                </div>

                <div class="recipe-actions">
                    <button class="action-btn like-btn ${isLiked ? "liked" : ""}"
                        onclick="event.stopPropagation(); toggleLike(${r.id})">
                        ${isLiked ? "❤️" : "🤍"} ${r.likes}
                    </button>

                    <button class="action-btn" onclick="event.stopPropagation(); shareRecipe(${r.id})">
                        Share
                    </button>
                </div>
            </div>
        </div>`;
    }).join("");
}

/*****************
 * FAVORITES
 *****************/
function showFavorites() {
    if (!currentUser) return openLoginModal();
    window.currentPage = "favorites";

    const grid = document.getElementById("recipeGrid");
    const favIds = currentUser.favorites || [];

    if (favIds.length === 0) {
        grid.innerHTML = `
            <p style="grid-column:1/-1;text-align:center;color:#777;font-size:1.1em;">
                ⭐ You have no favorite recipes yet.
            </p>`;
        return;
    }

    const favoriteRecipes = recipes.filter(r => favIds.includes(r.id));

    grid.innerHTML = favoriteRecipes.map(r => {
        const isLiked = r.likes > 0;
        const isSaved = currentUser?.favorites?.includes(r.id);

        return `
        <div class="recipe-card" style="position:relative;">
            <button class="fav-btn"
                onclick="event.stopPropagation(); toggleFavorite(${r.id}); showFavorites();"
                style="
                    position:absolute;top:10px;right:10px;
                    background:white;border:none;border-radius:50%;
                    width:40px;height:40px;display:flex;align-items:center;
                    justify-content:center;font-size:20px;cursor:pointer;
                    box-shadow:0 2px 6px rgba(0,0,0,0.2);
                ">
                ${isSaved ? "❤️" : "🤍"}
            </button>

            <img class="recipe-image" src="${r.image}" onclick="showRecipeDetail(${r.id})">

            <div class="recipe-content">
                <h3 class="recipe-title" onclick="showRecipeDetail(${r.id})">${r.title}</h3>
                <span class="recipe-category">${r.category}</span>

                <p style="color:#666;margin:10px 0">⏱️ ${r.prepTime} min • ❤️ ${r.likes} likes</p>

                <div class="recipe-rating" style="margin:6px 0;">
                    ${renderStars(r.rating)}
                </div>

                <div class="recipe-actions">
                    <button class="action-btn like-btn ${isLiked ? "liked" : ""}"
                        onclick="event.stopPropagation(); toggleLike(${r.id})">
                        ${isLiked ? "❤️" : "🤍"} ${r.likes}
                    </button>

                    <button class="action-btn" onclick="event.stopPropagation(); shareRecipe(${r.id})">
                        Share
                    </button>
                </div>
            </div>

        </div>`;
    }).join("");
}

function toggleFavorite(id) {
    if (!currentUser) return openLoginModal();

    currentUser.favorites = currentUser.favorites || [];

    if (currentUser.favorites.includes(id)) {
        currentUser.favorites = currentUser.favorites.filter(f => f !== id);
    } else {
        currentUser.favorites.push(id);
    }

    localStorage.setItem("currentUser", JSON.stringify(currentUser));

    renderRecipes();
    renderHero();
}

/*****************
 * LIKE SYSTEM
 *****************/
async function toggleLike(id) {
    if (!currentUser) return openLoginModal();

    const recipe = recipes.find(r => r.id === id);
    recipe.likes += 1;

    renderRecipes();
    renderHero();

    try {
        await fetch(`${API}/recipes/${id}/like`, { method: "POST" });
    } catch (error) {
        console.error("Error updating like:", error);
    }
}

/*****************
 * SHARE LINK
 *****************/
function shareRecipe(id) {
    const link = `${location.href.split('#')[0]}#recipe-${id}`;
    navigator.clipboard.writeText(link);
    alert("Recipe link copied to clipboard!");
}

/*****************
 * RECIPE DETAIL
 *****************/
function showRecipeDetail(id) {
    const r = recipes.find(x => x.id === id);
    if (!r) return;

    const modal = document.getElementById("detailModal");
    const box = document.getElementById("detailContent");

    box.innerHTML = `
        <div style="position:relative; max-height:80vh; overflow-y:auto;">
            <div onclick="closeModal('detailModal')" 
                style="position:sticky;top:0;text-align:right;font-size:32px;color:#555;cursor:pointer;background:white;padding:5px 10px;z-index:1000;">
                &times;
            </div>

            <h2 data-id="${r.id}" style="font-family:Georgia;margin-bottom:10px">${r.title}</h2>

            <p style="color:#666;margin-bottom:20px">📁 ${r.category} • ⏱️ ${r.prepTime} min • 👤 ${r.author}</p>

            <img src="${r.image}" style="width:100%;border-radius:10px;margin-bottom:20px;position:relative;">
            <button
                onclick="toggleFavorite(${r.id}); event.stopPropagation();" 
                class="fav-btn-modal"
                style="
                    position:absolute;
                    top:20px;
                    right:20px;
                    background:white;
                    border:none;
                    border-radius:50%;
                    width:45px;
                    height:45px;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:22px;
                    cursor:pointer;
                    box-shadow:0 2px 6px rgba(0,0,0,0.2);
                ">
                ${currentUser?.favorites?.includes(r.id) ? "❤️" : "🤍"}
            </button>

            <div class="rating-box" style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
                <div class="rating-stars" style="display:flex;gap:4px;">
                    <i class="star fa-solid fa-star" data-value="1" style="cursor:pointer;font-size:22px;"></i>
                    <i class="star fa-solid fa-star" data-value="2" style="cursor:pointer;font-size:22px;"></i>
                    <i class="star fa-solid fa-star" data-value="3" style="cursor:pointer;font-size:22px;"></i>
                    <i class="star fa-solid fa-star" data-value="4" style="cursor:pointer;font-size:22px;"></i>
                    <i class="star fa-solid fa-star" data-value="5" style="cursor:pointer;font-size:22px;"></i>
                </div>
                <span class="rating-label" style="color:#777;">Rating</span>
            </div>

            <h3 style="margin-top:20px">Ingredients</h3>
            <ul style="margin:10px 0 20px 20px;">
                ${r.ingredients.map(i => `<li style="margin:5px 0">${i}</li>`).join("")}
            </ul>

            <h3 style="margin-top:20px">Instructions</h3>
            <ol style="margin:10px 0 20px 20px;">
                ${r.steps.map(s => `<li style="margin:8px 0;line-height:1.6">${s}</li>`).join("")}
            </ol>
            <h3 style="margin-top:20px;">Comments</h3>
<div id="commentList" style="margin-bottom:20px; padding-left:20px; color:#444;">
    Loading comments...
</div>


${currentUser ? `
<div style="margin-top:10px;">
    <textarea id="commentInput" placeholder="Write a comment..." 
        style="width:100%;padding:10px;height:80px;margin-bottom:10px;"></textarea>
    <button onclick="submitComment(${r.id})" 
        style="padding:10px 20px;cursor:pointer;">Add Comment</button>
</div>
` : `<p style="color:#777;">Login to add comments</p>`}

        </div>
        
    `;

    modal.classList.add("active");
    document.body.style.overflow = "hidden";

    loadComments(id);  // ✅ Call the function AFTER box.innerHTML is set
}
async function loadComments(recipeId) {
    try {
        const res = await fetch(`${API}/comments/${recipeId}`);
        const comments = await res.json();

        const box = document.getElementById("commentList");

        if (comments.length === 0) {
            box.innerHTML = `<p style="color:#777;">No comments yet.</p>`;
            return;
        }

        box.innerHTML = comments
            .map(c => `<p><strong>${c.user}:</strong> ${c.content}</p>`)
            .join("");
    } catch (error) {
        console.error("Failed to load comments", error);
    }
}
async function submitComment(recipeId) {
    if (!currentUser) return openLoginModal();

    const content = document.getElementById("commentInput").value.trim();
    if (!content) return alert("Write something!");

    await fetch(`${API}/comments/${recipeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: currentUser.id,
            content
        })
    });

    document.getElementById("commentInput").value = "";
    loadComments(recipeId);
}

/*****************
 * SUBMIT NEW RECIPE
 *****************/

async function submitNewRecipe() {
    const title = document.getElementById("upTitle").value.trim();
    const category = document.getElementById("upCategory").value;
    const prepTime = Number(document.getElementById("upTime").value);
    const image = document.getElementById("upImage").value.trim() || "https://images.unsplash.com/photo-1504674900247-0877df9cc836";
    const ingredients = document.getElementById("upIngredients").value.split("\n").filter(x => x.trim());
    const steps = document.getElementById("upSteps").value.split("\n").filter(x => x.trim());

    if (!title || !category || !prepTime || !ingredients.length || !steps.length) {
        return alert("Please fill all fields");
    }

    try {
        await fetch(`${API}/recipes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title,
                category,
                prepTime,
                image,
                ingredients,
                steps,
                likes: 0,
                author: currentUser.username,
                rating: 0
            })
        });

        closeModal("uploadModal");
        await loadRecipes();
        alert("Recipe added successfully!");
    } catch (error) {
        alert("Error adding recipe");
        console.error(error);
    }
}

/*****************
 * EDIT RECIPE
 *****************/
function editRecipe(id) {
    const r = recipes.find(x => x.id === id);
    if (!r) return;

    const modal = document.getElementById("uploadModal");
    const box = document.getElementById("uploadContent");

    box.innerHTML = `
        <div style="position:relative; max-height:80vh; overflow-y:auto;">
            <div onclick="closeModal('uploadModal')"
                style="position:sticky;top:0;text-align:right;font-size:32px;color:#555;cursor:pointer;background:white;padding:5px 10px;">
                &times;
            </div>

            <h2 style="font-family:Georgia;margin-bottom:15px">Edit Recipe</h2>

            <input id="upTitle" value="${r.title}" style="width:100%;padding:12px;margin-bottom:15px">

            <select id="upCategory" style="width:100%;padding:12px;margin-bottom:15px">
                <option ${r.category === "Vegetarian" ? "selected" : ""}>Vegetarian</option>
                <option ${r.category === "Dessert" ? "selected" : ""}>Dessert</option>
                <option ${r.category === "Quick" ? "selected" : ""}>Quick</option>
                <option ${r.category === "Main Course" ? "selected" : ""}>Main Course</option>
                <option ${r.category === "Breakfast" ? "selected" : ""}>Breakfast</option>
            </select>

            <input id="upTime" type="number" value="${r.prepTime}" style="width:100%;padding:12px;margin-bottom:15px">

            <input id="upImage" value="${r.image}" style="width:100%;padding:12px;margin-bottom:15px">

            <textarea id="upIngredients" style="width:100%;height:120px;padding:12px;margin-bottom:15px">${r.ingredients.join("\n")}</textarea>

            <textarea id="upSteps" style="width:100%;height:120px;padding:12px;margin-bottom:15px">${r.steps.join("\n")}</textarea>

            <button onclick="saveEditedRecipe(${r.id})" style="padding:12px 24px;cursor:pointer">Save Changes</button>
            <button onclick="closeModal('uploadModal')" style="padding:12px 24px;margin-left:10px;cursor:pointer;background:#e9ecef;color:#333">Cancel</button>
        </div>
    `;

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
}

async function saveEditedRecipe(id) {
    const title = document.getElementById("upTitle").value.trim();
    const category = document.getElementById("upCategory").value;
    const prepTime = Number(document.getElementById("upTime").value);
    const image = document.getElementById("upImage").value.trim();
    const ingredients = document.getElementById("upIngredients").value.split("\n").filter(x => x.trim());
    const steps = document.getElementById("upSteps").value.split("\n").filter(x => x.trim());

    if (!title || !category || !prepTime || !ingredients.length || !steps.length) {
        return alert("Please fill all fields");
    }

    try {
        await fetch(`${API}/recipes/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title,
                category,
                prepTime,
                image,
                ingredients,
                steps
            })
        });

        closeModal("uploadModal");
        await loadRecipes();
        alert("Recipe updated successfully!");
    } catch (error) {
        alert("Error updating recipe");
        console.error(error);
    }
}

/*****************
 * STAR RATING SYSTEM
 *****************/
function activateStarRating() {
    const stars = document.querySelectorAll(".rating-stars .star");
    if (!stars.length) return;

    stars.forEach(star => {
        star.addEventListener("click", () => {
            const value = parseInt(star.getAttribute("data-value"));

            stars.forEach(s => s.classList.remove("active"));

            stars.forEach(s => {
                if (parseInt(s.getAttribute("data-value")) <= value) {
                    s.classList.add("active");
                }
            });

            const recipeId = document.querySelector("#detailContent h2").getAttribute("data-id");

            fetch(`${API}/recipes/${recipeId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rating: value })
            });
        });
    });
}

/*****************
 * INITIALIZATION
 *****************/
updateAuthArea();
loadRecipes();

document.getElementById("searchInput").addEventListener("input", renderRecipes);
document.getElementById("categoryFilter").addEventListener("change", renderRecipes);
document.getElementById("timeFilter").addEventListener("change", renderRecipes);
