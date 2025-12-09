/*****************
 * CONFIGURATION
 *****************/
const API_URL = 'http://localhost:5000';
let currentUser = JSON.parse(localStorage.getItem("currentUser")) || null;
let recipes = [];
let likedRecipes = new Set();
let activeFilters = new Set(['all']);
let currentRecipeId = null;
let currentView = 'home';

/*****************
 * API FUNCTIONS
 *****************/
async function fetchRecipes() {
    try {
        const response = await fetch(`${API_URL}/recipes`);
        if (!response.ok) throw new Error('Failed to fetch recipes');
        recipes = await response.json();
        return recipes;
    } catch (error) {
        console.error('Error fetching recipes:', error);
        showToast("Error loading recipes. Using sample data.", "error");
        return [];
    }
}

async function addRecipeAPI(recipeData) {
    try {
        const response = await fetch(`${API_URL}/recipes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(recipeData)
        });
        
        if (!response.ok) throw new Error('Failed to add recipe');
        return await response.json();
    } catch (error) {
        console.error('Error adding recipe:', error);
        throw error;
    }
}

async function updateRecipeAPI(recipeId, recipeData) {
    try {
        const response = await fetch(`${API_URL}/recipes/${recipeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(recipeData)
        });
        
        if (!response.ok) throw new Error('Failed to update recipe');
        return await response.json();
    } catch (error) {
        console.error('Error updating recipe:', error);
        throw error;
    }
}

async function deleteRecipeAPI(recipeId) {
    try {
        const response = await fetch(`${API_URL}/recipes/${recipeId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to delete recipe');
        return await response.json();
    } catch (error) {
        console.error('Error deleting recipe:', error);
        throw error;
    }
}

async function likeRecipeAPI(recipeId) {
    try {
        const response = await fetch(`${API_URL}/recipes/${recipeId}/like`, {
            method: 'POST'
        });
        
        if (!response.ok) throw new Error('Failed to like recipe');
        return await response.json();
    } catch (error) {
        console.error('Error liking recipe:', error);
        throw error;
    }
}

async function registerAPI(userData) {
    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Registration failed');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error registering:', error);
        throw error;
    }
}

async function loginAPI(credentials) {
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Login failed');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error logging in:', error);
        throw error;
    }
}

async function fetchComments(recipeId) {
    try {
        const response = await fetch(`${API_URL}/comments/${recipeId}`);
        if (!response.ok) throw new Error('Failed to fetch comments');
        return await response.json();
    } catch (error) {
        console.error('Error fetching comments:', error);
        return [];
    }
}

async function addCommentAPI(recipeId, commentData) {
    try {
        const response = await fetch(`${API_URL}/comments/${recipeId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(commentData)
        });
        
        if (!response.ok) throw new Error('Failed to add comment');
        return await response.json();
    } catch (error) {
        console.error('Error adding comment:', error);
        throw error;
    }
}

/*****************
 * INITIALIZATION
 *****************/
document.addEventListener('DOMContentLoaded', () => {
    // Setup event listeners
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (currentView === 'home') {
                renderRecipes();
            }
        });
    }
    
    document.getElementById('recipeForm')?.addEventListener('submit', submitRecipe);
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    document.getElementById('signupForm')?.addEventListener('submit', handleSignup);
    
    // Modal close on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
                document.body.style.overflow = 'auto';
            }
        });
    });
    
    // Initialize
    updateAuthArea();
    updateActiveFilterTags();
    loadRecipes();
    showHome();
});

/*****************
 * USER SYSTEM
 *****************/
function updateAuthArea() {
    const area = document.getElementById("authArea");
    
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
                <div class="user-avatar">${currentUser.username.charAt(0).toUpperCase()}</div>
                <div class="user-details">
                    <span class="username">${currentUser.username}</span>
                    <span class="user-role">${currentUser.role}</span>
                </div>
                <button class="logout-btn" onclick="logout()">
                    <i class="fas fa-sign-out-alt"></i>
                    Logout
                </button>
            </div>
        `;
    }
    
    // Update add recipe button
    const addBtn = document.getElementById("addRecipeBtn");
    if (addBtn) {
        addBtn.style.display = currentUser ? "inline-flex" : "none";
    }
}

/*****************
 * LOGIN/SIGNUP MODALS
 *****************/
function openLoginModal() {
    const modal = document.getElementById("loginModal");
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
    switchAuthTab('login');
}

function openSignupModal() {
    const modal = document.getElementById("loginModal");
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
    switchAuthTab('signup');
}

function closeLoginModal() {
    const modal = document.getElementById("loginModal");
    modal.classList.remove("active");
    document.body.style.overflow = "auto";
}

function switchAuthTab(tab) {
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");
    const tabs = document.querySelectorAll(".auth-tab");
    const modalTitle = document.getElementById("loginModalTitle");
    
    tabs.forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".auth-tab").forEach(btn => {
        if (btn.textContent.includes(tab === 'login' ? 'Login' : 'Sign Up')) {
            btn.classList.add("active");
        }
    });
    
    if (tab === 'login') {
        loginForm.style.display = "block";
        signupForm.style.display = "none";
        modalTitle.textContent = "Login";
    } else {
        loginForm.style.display = "none";
        signupForm.style.display = "block";
        modalTitle.textContent = "Sign Up";
    }
}

async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value.trim();
    
    if (!username || !password) {
        showToast("Please fill in all fields", "error");
        return;
    }
    
    try {
        const result = await loginAPI({ username, password });
        
        currentUser = {
            id: result.user.id,
            username: result.user.username,
            role: result.user.role,
            favorites: []
        };
        
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        
        closeLoginModal();
        updateAuthArea();
        loadRecipes();
        showToast(`Welcome back, ${username}!`);
        
        // Clear form
        document.getElementById("loginUsername").value = "";
        document.getElementById("loginPassword").value = "";
    } catch (error) {
        showToast(error.message || "Login failed. Please try again.", "error");
        console.error(error);
    }
}

async function handleSignup(event) {
    event.preventDefault();
    
    const username = document.getElementById("signupUsername").value.trim();
    const password = document.getElementById("signupPassword").value.trim();
    const confirmPassword = document.getElementById("signupConfirmPassword").value.trim();
    
    if (username.length < 3) {
        showToast("Username must be at least 3 characters", "error");
        return;
    }
    
    if (password.length < 6) {
        showToast("Password must be at least 6 characters", "error");
        return;
    }
    
    if (password !== confirmPassword) {
        showToast("Passwords do not match", "error");
        return;
    }
    
    try {
        const result = await registerAPI({ 
            username, 
            password,
            role: "user" 
        });
        
        currentUser = {
            id: result.user.id,
            username: result.user.username,
            role: result.user.role,
            favorites: []
        };
        
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        
        closeLoginModal();
        updateAuthArea();
        loadRecipes();
        showToast(`Account created! Welcome, ${username}!`);
        
        // Clear form
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
    updateAuthArea();
    loadRecipes();
    showToast("Logged out successfully");
}

/*****************
 * VIEW MANAGEMENT
 *****************/
function showHome() {
    currentView = 'home';
    updateNavigation('Home');
    showView('homeView');
    loadRecipes();
}

function showCategories() {
    currentView = 'categories';
    updateNavigation('Categories');
    showView('categoriesView');
    renderCategories();
}

function showFavorites() {
    if (!currentUser) {
        showToast("Please login to view favorites", "error");
        openLoginModal();
        return;
    }
    
    currentView = 'favorites';
    updateNavigation('Favorites');
    showView('favoritesView');
    renderFavorites();
}

function showMyRecipes() {
    if (!currentUser) {
        showToast("Please login to view your recipes", "error");
        openLoginModal();
        return;
    }
    
    currentView = 'myRecipes';
    updateNavigation('My Recipes');
    showView('myRecipesView');
    renderMyRecipes();
}

function showAbout() {
    currentView = 'about';
    updateNavigation('About');
    showView('aboutView');
}

function updateNavigation(activeLink) {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.querySelector('.nav-text')?.textContent === activeLink) {
            link.classList.add('active');
        }
    });
}

function showView(viewId) {
    const views = ['homeView', 'categoriesView', 'favoritesView', 'myRecipesView', 'aboutView'];
    views.forEach(view => {
        const element = document.getElementById(view);
        if (element) {
            element.classList.remove('active');
        }
    });
    
    const activeView = document.getElementById(viewId);
    if (activeView) {
        activeView.classList.add('active');
    }
}

/*****************
 * QUICK FILTERS
 *****************/
function toggleQuickFilter(filterType) {
    const quickFilters = document.querySelectorAll('.quick-filter');
    quickFilters.forEach(filter => filter.classList.remove('active'));
    
    const filterNames = {
        'all': 'All',
        'vegetarian': 'Vegetarian',
        'dessert': 'Dessert',
        'quick': 'Quick',
        'breakfast': 'Breakfast'
    };
    
    // Find and activate the clicked filter
    quickFilters.forEach(filter => {
        if (filter.textContent.includes(filterNames[filterType])) {
            filter.classList.add('active');
        }
    });
    
    // Update active filters
    activeFilters.clear();
    if (filterType === 'all') {
        activeFilters.add('all');
    } else {
        activeFilters.add(filterType);
    }
    
    // Update search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    
    updateActiveFilterTags();
    renderRecipes();
}

/*****************
 * STAR RATING SYSTEM
 *****************/
function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let stars = '';
    
    for (let i = 0; i < 5; i++) {
        if (i < fullStars) {
            stars += '<i class="fas fa-star star"></i>';
        } else if (i === fullStars && hasHalfStar) {
            stars += '<i class="fas fa-star-half-alt star"></i>';
        } else {
            stars += '<i class="far fa-star star empty"></i>';
        }
    }
    
    return stars;
}

/*****************
 * CATEGORIES VIEW
 *****************/
function renderCategories() {
    const categoriesGrid = document.getElementById('categoriesGrid');
    if (!categoriesGrid) return;
    
    const categories = [
        { 
            id: 'vegetarian',
            name: 'Vegetarian',
            icon: 'fas fa-leaf',
            description: 'Plant-based deliciousness',
            count: getCategoryCount('Vegetarian')
        },
        { 
            id: 'dessert',
            name: 'Dessert',
            icon: 'fas fa-ice-cream',
            description: 'Sweet treats and delights',
            count: getCategoryCount('Dessert')
        },
        { 
            id: 'quick',
            name: 'Quick Meals',
            icon: 'fas fa-bolt',
            description: 'Ready in 30 minutes or less',
            count: getCategoryCount('Quick')
        },
        { 
            id: 'main',
            name: 'Main Course',
            icon: 'fas fa-drumstick-bite',
            description: 'Hearty and satisfying meals',
            count: getCategoryCount('Main Course')
        },
        { 
            id: 'breakfast',
            name: 'Breakfast',
            icon: 'fas fa-egg',
            description: 'Start your day right',
            count: getCategoryCount('Breakfast')
        },
        { 
            id: 'easy',
            name: 'Easy Recipes',
            icon: 'fas fa-signal',
            description: 'Simple and foolproof',
            count: recipes.filter(r => r.difficulty === 'Easy').length
        }
    ];
    
    categoriesGrid.innerHTML = categories.map(category => `
        <div class="category-card" onclick="filterByCategory('${category.id}')">
            <i class="${category.icon}"></i>
            <h3>${category.name}</h3>
            <p>${category.description}</p>
            <span class="category-count">${category.count} recipes</span>
        </div>
    `).join('');
}

function getCategoryCount(categoryName) {
    return recipes.filter(recipe => recipe.category === categoryName).length;
}

function filterByCategory(categoryId) {
    const categoryMap = {
        'vegetarian': 'Vegetarian',
        'dessert': 'Dessert',
        'quick': 'Quick',
        'main': 'Main Course',
        'breakfast': 'Breakfast',
        'easy': 'Easy'
    };
    
    if (categoryMap[categoryId]) {
        showHome();
        setTimeout(() => {
            toggleQuickFilter(categoryId === 'easy' ? 'all' : categoryId);
            updateActiveFilterTags();
            renderRecipes();
        }, 100);
    }
}

/*****************
 * FAVORITES VIEW
 *****************/
function renderFavorites() {
    const favoritesGrid = document.getElementById('favoritesGrid');
    if (!favoritesGrid) return;
    
    // Note: You'll need to implement favorites API endpoint in backend
    const favoriteRecipes = recipes.filter(recipe => {
        // For now, using local storage favorites
        const favorites = JSON.parse(localStorage.getItem('userFavorites') || '[]');
        return favorites.includes(recipe.id);
    });
    
    if (favoriteRecipes.length === 0) {
        favoritesGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-heart"></i>
                <h3>No favorites yet</h3>
                <p>Start exploring recipes and save your favorites!</p>
                <button class="btn-primary" onclick="showHome()">
                    <i class="fas fa-compass"></i>
                    Explore Recipes
                </button>
            </div>
        `;
        return;
    }
    
    favoritesGrid.innerHTML = favoriteRecipes.map(recipe => createRecipeCard(recipe, true)).join('');
}

/*****************
 * MY RECIPES VIEW
 *****************/
function renderMyRecipes() {
    const myRecipesGrid = document.getElementById('myRecipesGrid');
    if (!myRecipesGrid) return;
    
    const myRecipes = recipes.filter(recipe => recipe.author === currentUser.username);
    
    if (myRecipes.length === 0) {
        myRecipesGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-utensils"></i>
                <h3>No recipes yet</h3>
                <p>Share your first recipe with the community!</p>
                <button class="btn-primary" onclick="showAddRecipeModal()">
                    <i class="fas fa-plus"></i>
                    Create Recipe
                </button>
            </div>
        `;
        return;
    }
    
    myRecipesGrid.innerHTML = myRecipes.map(recipe => createRecipeCard(recipe, true)).join('');
}

/*****************
 * RECIPE MANAGEMENT
 *****************/
async function loadRecipes() {
    try {
        recipes = await fetchRecipes();
        renderRecipes();
    } catch (error) {
        console.error("Error loading recipes:", error);
        showToast("Error loading recipes", "error");
    }
}

function createRecipeCard(recipe, isInView = false) {
    const isLiked = likedRecipes.has(recipe.id);
    const isMyRecipe = currentUser && recipe.author === currentUser.username;
    
    return `
        <div class="recipe-card">
            <div class="recipe-image-container">
                <img src="${recipe.image}" alt="${recipe.title}" class="recipe-image" onclick="showRecipeDetail(${recipe.id})">
                <div class="recipe-actions">
                    <button class="action-btn ${isLiked ? 'liked' : ''}" 
                            onclick="event.stopPropagation(); toggleLike(${recipe.id}, this)">
                        <i class="fas fa-heart"></i>
                    </button>
                    <button class="action-btn" 
                            onclick="event.stopPropagation(); toggleFavorite(${recipe.id}, this)">
                        <i class="fas fa-bookmark"></i>
                    </button>
                </div>
                <div class="recipe-category">${recipe.category}</div>
                ${isMyRecipe ? '<div class="recipe-category" style="right: 10px; left: auto; background: var(--success); color: white;">My Recipe</div>' : ''}
            </div>
            <div class="recipe-info">
                <h3 class="recipe-title" onclick="showRecipeDetail(${recipe.id})">${recipe.title}</h3>
                <p class="recipe-author">
                    <i class="fas fa-user"></i>
                    by ${recipe.author}
                </p>
                <div class="recipe-meta">
                    <div class="recipe-stats">
                        <div class="stat-item">
                            <i class="fas fa-clock"></i>
                            ${recipe.prepTime} min
                        </div>
                        <div class="stat-item">
                            <i class="fas fa-heart"></i>
                            ${recipe.likes} likes
                        </div>
                    </div>
                    <div class="recipe-rating">
                        <div class="star-rating">
                            ${renderStars(recipe.rating)}
                        </div>
                        <span class="rating-value">${recipe.rating}</span>
                    </div>
                </div>
                <div class="recipe-actions-bottom">
                    <button class="btn-small ${isLiked ? 'liked' : ''}" 
                            onclick="event.stopPropagation(); toggleLike(${recipe.id}, this)">
                        <i class="fas fa-heart"></i>
                        <span class="like-count">${recipe.likes}</span>
                    </button>
                    <button class="btn-small" onclick="event.stopPropagation(); shareRecipe(${recipe.id})">
                        <i class="fas fa-share"></i>
                        Share
                    </button>
                    ${isInView && currentUser && recipe.author === currentUser.username ? `
                        <button class="btn-small" onclick="event.stopPropagation(); editRecipe(${recipe.id})">
                            <i class="fas fa-edit"></i>
                            Edit
                        </button>
                        <button class="btn-small" onclick="event.stopPropagation(); deleteRecipe(${recipe.id})">
                            <i class="fas fa-trash"></i>
                            Delete
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

function renderRecipes() {
    const grid = document.getElementById("recipeGrid");
    if (!grid) return;
    
    const recipeList = getFilteredRecipes();
    
    if (recipeList.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>No recipes found</h3>
                <p>Try adjusting your search or filters to find what you're looking for.</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = recipeList.map(recipe => createRecipeCard(recipe)).join('');
}

function getFilteredRecipes() {
    let filtered = [...recipes];
    const searchInput = document.getElementById("searchInput");
    const searchQuery = searchInput ? searchInput.value.toLowerCase() : '';
    
    if (searchQuery) {
        filtered = filtered.filter(recipe => 
            recipe.title.toLowerCase().includes(searchQuery) ||
            recipe.author.toLowerCase().includes(searchQuery) ||
            recipe.category.toLowerCase().includes(searchQuery) ||
            (recipe.ingredients && recipe.ingredients.some(ing => ing.toLowerCase().includes(searchQuery)))
        );
    }
    
    if (!activeFilters.has('all') && activeFilters.size > 0) {
        filtered = filtered.filter(recipe => {
            return Array.from(activeFilters).some(filter => {
                if (filter === 'vegetarian') return recipe.category === 'Vegetarian';
                if (filter === 'dessert') return recipe.category === 'Dessert';
                if (filter === 'quick') return recipe.prepTime <= 30;
                if (filter === 'main') return recipe.category === 'Main Course';
                if (filter === 'breakfast') return recipe.category === 'Breakfast';
                if (filter === 'easy') return recipe.difficulty === 'Easy';
                if (filter === 'under-30') return recipe.prepTime <= 30;
                return false;
            });
        });
    }
    
    return filtered;
}

/*****************
 * FILTER SYSTEM
 *****************/
function updateActiveFilterTags() {
    const container = document.getElementById("activeFilters");
    const bar = document.getElementById("activeFiltersBar");
    
    if (!container) return;
    
    container.innerHTML = '';
    
    if (activeFilters.has('all') || activeFilters.size === 0) {
        bar.style.display = 'none';
        return;
    }
    
    bar.style.display = 'block';
    
    Array.from(activeFilters).forEach(filter => {
        const filterNames = {
            'vegetarian': 'Vegetarian',
            'dessert': 'Dessert',
            'quick': 'Quick',
            'main': 'Main Course',
            'breakfast': 'Breakfast',
            'easy': 'Easy',
            'under-30': 'Under 30 min'
        };
        
        if (filterNames[filter]) {
            const tag = document.createElement('div');
            tag.className = 'active-filter-tag';
            tag.innerHTML = `
                ${filterNames[filter]}
                <button class="remove-filter" onclick="removeFilter('${filter}')">
                    <i class="fas fa-times"></i>
                </button>
            `;
            container.appendChild(tag);
        }
    });
}

function removeFilter(filterType) {
    activeFilters.delete(filterType);
    
    if (activeFilters.size === 0) {
        activeFilters.add('all');
        document.querySelectorAll('.quick-filter').forEach(filter => {
            filter.classList.remove('active');
            if (filter.textContent.includes('All')) {
                filter.classList.add('active');
            }
        });
    }
    
    updateActiveFilterTags();
    renderRecipes();
}

function clearAllFilters() {
    activeFilters.clear();
    activeFilters.add('all');
    
    document.querySelectorAll('.quick-filter').forEach(filter => {
        filter.classList.remove('active');
        if (filter.textContent.includes('All')) {
            filter.classList.add('active');
        }
    });
    
    const searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.value = '';
    
    updateActiveFilterTags();
    renderRecipes();
    showToast('All filters cleared');
}

/*****************
 * LIKE SYSTEM
 *****************/
async function toggleLike(recipeId, button = null) {
    if (!currentUser) {
        showToast("Please login to like recipes", "error");
        openLoginModal();
        return;
    }
    
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;
    
    try {
        if (likedRecipes.has(recipeId)) {
            // Unlike - you'll need to implement unlike API endpoint
            likedRecipes.delete(recipeId);
            recipe.likes = Math.max(0, recipe.likes - 1);
            showToast("Recipe unliked");
            
            if (button) {
                button.classList.remove('liked');
                const btnSmall = document.querySelector(`.btn-small[onclick*="toggleLike(${recipeId}"]`);
                if (btnSmall) btnSmall.classList.remove('liked');
            }
        } else {
            // Like with API call
            const result = await likeRecipeAPI(recipeId);
            likedRecipes.add(recipeId);
            recipe.likes = result.likes;
            
            // Heart animation
            if (button) {
                const icon = button.querySelector('i');
                icon.classList.add('heart-animation');
                
                setTimeout(() => {
                    icon.classList.remove('heart-animation');
                }, 600);
                
                button.classList.add('liked');
                
                const btnSmall = document.querySelector(`.btn-small[onclick*="toggleLike(${recipeId}"]`);
                if (btnSmall) btnSmall.classList.add('liked');
            }
            
            showToast("Recipe liked!");
        }
        
        // Update UI
        if (currentView === 'home') {
            renderRecipes();
        } else if (currentView === 'favorites') {
            renderFavorites();
        } else if (currentView === 'myRecipes') {
            renderMyRecipes();
        }
    } catch (error) {
        showToast("Error updating like", "error");
        console.error(error);
    }
}

/*****************
 * FAVORITES SYSTEM
 *****************/
function toggleFavorite(recipeId, button = null) {
    if (!currentUser) {
        showToast("Please login to save recipes", "error");
        openLoginModal();
        return;
    }
    
    let favorites = JSON.parse(localStorage.getItem('userFavorites') || '[]');
    
    if (favorites.includes(recipeId)) {
        // Remove from favorites
        favorites = favorites.filter(id => id !== recipeId);
        if (button) button.classList.remove('saved');
        showToast("Recipe removed from favorites");
    } else {
        // Add to favorites
        favorites.push(recipeId);
        
        // Button animation
        if (button) {
            button.classList.add('saved');
            const icon = button.querySelector('i');
            icon.style.transform = 'scale(1.2)';
            setTimeout(() => {
                icon.style.transform = 'scale(1)';
            }, 300);
        }
        
        showToast("Recipe added to favorites!");
    }
    
    // Update localStorage
    localStorage.setItem("userFavorites", JSON.stringify(favorites));
}

/*****************
 * RECIPE DETAIL MODAL
 *****************/
async function showRecipeDetail(id) {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) {
        showToast("Recipe not found", "error");
        return;
    }
    
    currentRecipeId = id;
    
    // Update modal content
    document.getElementById('modalImage').src = recipe.image;
    document.getElementById('modalTitle').textContent = recipe.title;
    document.getElementById('modalAuthor').textContent = 'by ' + recipe.author;
    document.getElementById('modalTime').textContent = recipe.prepTime + ' min';
    document.getElementById('modalCategory').textContent = recipe.category;
    document.getElementById('modalLikes').textContent = recipe.likes;
    document.getElementById('modalRating').textContent = recipe.rating;
    document.getElementById('modalDifficulty').textContent = recipe.difficulty || 'Medium';
    
    // Populate ingredients
    const ingredientsList = document.getElementById('modalIngredients');
    ingredientsList.innerHTML = Array.isArray(recipe.ingredients) ? 
        recipe.ingredients.map(ing => `<li>${ing}</li>`).join('') : '';
    
    // Populate instructions
    const stepsList = document.getElementById('modalSteps');
    stepsList.innerHTML = Array.isArray(recipe.steps) ? 
        recipe.steps.map((step, index) => `<li>${step}</li>`).join('') : '';
    
    // Setup star rating
    const modalRatingStars = document.getElementById('modalRatingStars');
    modalRatingStars.innerHTML = renderStars(recipe.rating);
    
    // Setup comment form
    const commentFormContainer = document.getElementById('commentFormContainer');
    if (currentUser) {
        commentFormContainer.innerHTML = `
            <div class="comment-form">
                <textarea id="commentInput" placeholder="Add your comment..."></textarea>
                <button onclick="addComment()">
                    <i class="fas fa-paper-plane"></i>
                    Post Comment
                </button>
            </div>
        `;
    } else {
        commentFormContainer.innerHTML = `
            <div class="comment-form">
                <p style="text-align: center; color: var(--gray); padding: 20px;">
                    <i class="fas fa-lock"></i> Please <a href="#" onclick="openLoginModal()" style="color: var(--primary);">login</a> to add comments
                </p>
            </div>
        `;
    }
    
    // Load comments
    await loadComments(id);
    
    // Show modal
    document.getElementById('recipeModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

async function loadComments(recipeId) {
    const container = document.getElementById('commentsContainer');
    container.innerHTML = '<p style="color: var(--gray-light); text-align: center; padding: 20px;">Loading comments...</p>';
    
    try {
        const comments = await fetchComments(recipeId);
        
        if (!comments || comments.length === 0) {
            container.innerHTML = '<p style="color: var(--gray-light); text-align: center; padding: 20px;">No comments yet. Be the first to comment!</p>';
            return;
        }
        
        container.innerHTML = comments.map(comment => `
            <div class="comment">
                <div class="avatar">${comment.user.charAt(0).toUpperCase()}</div>
                <div class="comment-content">
                    <div class="comment-header">
                        <div class="comment-author">${comment.user}</div>
                    </div>
                    <div class="comment-text">${comment.content}</div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<p style="color: var(--gray-light); text-align: center; padding: 20px;">Error loading comments</p>';
    }
}

async function addComment() {
    if (!currentUser) {
        showToast("Please login to comment", "error");
        openLoginModal();
        return;
    }
    
    const commentInput = document.getElementById('commentInput');
    const commentText = commentInput.value.trim();
    
    if (!commentText) {
        showToast('Please enter a comment', 'error');
        return;
    }
    
    if (!currentRecipeId) return;
    
    try {
        await addCommentAPI(currentRecipeId, {
            user_id: currentUser.id,
            content: commentText
        });
        
        commentInput.value = '';
        await loadComments(currentRecipeId);
        showToast('Comment added successfully');
    } catch (error) {
        showToast('Error adding comment', 'error');
    }
}

function closeModal() {
    document.getElementById('recipeModal').classList.remove('active');
    document.body.style.overflow = 'auto';
    currentRecipeId = null;
}

/*****************
 * SHARE FUNCTION
 *****************/
function shareRecipe(id) {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;
    
    const shareText = `Check out this recipe: ${recipe.title} on Pocket Chef`;
    const shareUrl = window.location.href.split('#')[0] + `#recipe-${id}`;
    
    // Animation for share button
    const shareButtons = document.querySelectorAll(`[onclick*="shareRecipe(${id})"]`);
    shareButtons.forEach(btn => {
        btn.style.transform = 'scale(1.1)';
        setTimeout(() => {
            btn.style.transform = 'scale(1)';
        }, 300);
    });
    
    if (navigator.share) {
        navigator.share({
            title: recipe.title,
            text: shareText,
            url: shareUrl
        });
    } else {
        navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).then(() => {
            showToast("Link copied to clipboard!");
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = `${shareText}\n${shareUrl}`;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
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
    
    document.getElementById('addRecipeModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeAddRecipeModal() {
    document.getElementById('addRecipeModal').classList.remove('active');
    document.body.style.overflow = 'auto';
    document.getElementById('recipeForm').reset();
    resetFormFields();
}

function resetFormFields() {
    document.getElementById('ingredientsContainer').innerHTML = `
        <div class="ingredient-row">
            <input type="text" class="ingredient-input" placeholder="e.g., 2 cups all-purpose flour">
            <button type="button" class="remove-btn" onclick="removeIngredient(this)">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.getElementById('instructionsContainer').innerHTML = `
        <div class="instruction-row">
            <textarea class="instruction-input" placeholder="e.g., Preheat oven to 350°F" rows="2"></textarea>
            <button type="button" class="remove-btn" onclick="removeInstruction(this)">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
}

function addIngredientField() {
    const container = document.getElementById('ingredientsContainer');
    const div = document.createElement('div');
    div.className = 'ingredient-row';
    div.innerHTML = `
        <input type="text" class="ingredient-input" placeholder="e.g., 2 cups all-purpose flour">
        <button type="button" class="remove-btn" onclick="removeIngredient(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    container.appendChild(div);
}

function removeIngredient(button) {
    if (document.querySelectorAll('.ingredient-row').length > 1) {
        button.parentElement.remove();
    }
}

function addInstructionField() {
    const container = document.getElementById('instructionsContainer');
    const div = document.createElement('div');
    div.className = 'instruction-row';
    div.innerHTML = `
        <textarea class="instruction-input" placeholder="e.g., Preheat oven to 350°F" rows="2"></textarea>
        <button type="button" class="remove-btn" onclick="removeInstruction(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    container.appendChild(div);
}

function removeInstruction(button) {
    if (document.querySelectorAll('.instruction-row').length > 1) {
        button.parentElement.remove();
    }
}

async function submitRecipe(event) {
    event.preventDefault();
    
    const title = document.getElementById('recipeTitle').value.trim();
    const category = document.getElementById('recipeCategory').value;
    const prepTime = document.getElementById('recipeTime').value;
    const difficulty = document.getElementById('recipeDifficulty').value;
    const image = document.getElementById('recipeImage').value.trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80';
    
    const ingredients = Array.from(document.querySelectorAll('.ingredient-input'))
        .map(input => input.value.trim())
        .filter(value => value);
    
    const steps = Array.from(document.querySelectorAll('.instruction-input'))
        .map(input => input.value.trim())
        .filter(value => value);
    
    if (!title || !category || !prepTime || ingredients.length === 0 || steps.length === 0) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    const recipeData = {
        title,
        category,
        prepTime: parseInt(prepTime),
        image,
        ingredients,
        steps,
        likes: 0,
        author: currentUser.username,
        rating: 4
    };
    
    try {
        await addRecipeAPI(recipeData);
        closeAddRecipeModal();
        await loadRecipes();
        showToast('Recipe added successfully!');
    } catch (error) {
        showToast('Error adding recipe. Please try again.', 'error');
    }
}

/*****************
 * EDIT RECIPE
 *****************/
function editRecipe(id) {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;
    
    // Populate the add recipe modal with existing data
    document.getElementById('recipeTitle').value = recipe.title;
    document.getElementById('recipeCategory').value = recipe.category;
    document.getElementById('recipeTime').value = recipe.prepTime;
    document.getElementById('recipeDifficulty').value = recipe.difficulty || 'Medium';
    document.getElementById('recipeImage').value = recipe.image;
    
    // Clear existing fields
    const ingredientsContainer = document.getElementById('ingredientsContainer');
    const instructionsContainer = document.getElementById('instructionsContainer');
    
    ingredientsContainer.innerHTML = '';
    instructionsContainer.innerHTML = '';
    
    // Add ingredients
    if (Array.isArray(recipe.ingredients)) {
        recipe.ingredients.forEach((ingredient) => {
            const div = document.createElement('div');
            div.className = 'ingredient-row';
            div.innerHTML = `
                <input type="text" class="ingredient-input" value="${ingredient}">
                <button type="button" class="remove-btn" onclick="removeIngredient(this)">
                    <i class="fas fa-times"></i>
                </button>
            `;
            ingredientsContainer.appendChild(div);
        });
    }
    
    // Add instructions
    if (Array.isArray(recipe.steps)) {
        recipe.steps.forEach((step) => {
            const div = document.createElement('div');
            div.className = 'instruction-row';
            div.innerHTML = `
                <textarea class="instruction-input" rows="2">${step}</textarea>
                <button type="button" class="remove-btn" onclick="removeInstruction(this)">
                    <i class="fas fa-times"></i>
                </button>
            `;
            instructionsContainer.appendChild(div);
        });
    }
    
    // Store recipe ID for update
    const form = document.getElementById('recipeForm');
    form.dataset.editId = id;
    
    // Show modal with edit mode
    showAddRecipeModal();
    document.querySelector('.modal-title').textContent = 'Edit Recipe';
    
    // Update form submit handler
    form.onsubmit = function(e) {
        e.preventDefault();
        updateRecipe(id);
    };
}

async function updateRecipe(id) {
    const title = document.getElementById('recipeTitle').value.trim();
    const category = document.getElementById('recipeCategory').value;
    const prepTime = document.getElementById('recipeTime').value;
    const difficulty = document.getElementById('recipeDifficulty').value;
    const image = document.getElementById('recipeImage').value.trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80';
    
    const ingredients = Array.from(document.querySelectorAll('.ingredient-input'))
        .map(input => input.value.trim())
        .filter(value => value);
    
    const steps = Array.from(document.querySelectorAll('.instruction-input'))
        .map(input => input.value.trim())
        .filter(value => value);
    
    if (!title || !category || !prepTime || ingredients.length === 0 || steps.length === 0) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    const recipeData = {
        title,
        category,
        prepTime: parseInt(prepTime),
        image,
        ingredients,
        steps,
        rating: 4
    };
    
    try {
        await updateRecipeAPI(id, recipeData);
        closeAddRecipeModal();
        await loadRecipes();
        showToast('Recipe updated successfully!');
    } catch (error) {
        showToast('Error updating recipe. Please try again.', 'error');
    }
}

/*****************
 * DELETE RECIPE
 *****************/
async function deleteRecipe(id) {
    if (!confirm('Are you sure you want to delete this recipe?')) {
        return;
    }
    
    try {
        await deleteRecipeAPI(id);
        await loadRecipes();
        showToast('Recipe deleted successfully!');
    } catch (error) {
        showToast('Error deleting recipe. Please try again.', 'error');
    }
}

/*****************
 * TOAST NOTIFICATION
 *****************/
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    
    const icon = toast.querySelector('i');
    if (type === 'error') {
        icon.className = 'fas fa-exclamation-circle';
        icon.style.color = 'var(--error)';
    } else {
        icon.className = 'fas fa-check-circle';
        icon.style.color = 'var(--success)';
    }
    
    toast.classList.add('show');
    
    setTimeout(() => {
        hideToast();
    }, 4000);
}

function hideToast() {
    const toast = document.getElementById('toast');
    toast.classList.remove('show');
}