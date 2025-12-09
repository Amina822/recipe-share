import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import time

# ---------------- App Setup ----------------------
app = Flask(__name__)

CORS(app)

DATABASE_URL = "postgresql://postgres:2006@127.0.0.1:5432/web_back"
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ECHO'] = True

db = SQLAlchemy(app)

@app.route("/")
def home():
    return "Pocket Chef API is running!"

# ---------------- Models ------------------------
class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), default="user")

class Recipe(db.Model):
    __tablename__ = "recipes"
    id = db.Column(db.Integer, primary_key=True)  # auto-increment
    title = db.Column(db.String(120), nullable=False)
    category = db.Column(db.String(80))
    prepTime = db.Column(db.Integer)
    image = db.Column(db.Text)
    ingredients = db.Column(db.JSON)
    steps = db.Column(db.JSON)
    likes = db.Column(db.Integer, default=0)
    author = db.Column(db.String(80))
    rating = db.Column(db.Integer, default=0)

class Favorite(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipes.id'))

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipes.id'))
    content = db.Column(db.Text)

# ---------------- Helper Functions ----------------
def check_admin(username):
    u = User.query.filter_by(username=username).first()
    return u and u.role == 'admin'

# ---------------- Routes ------------------------

# Get all recipes
@app.route("/recipes", methods=["GET"])
def get_recipes():
    recipes = Recipe.query.all()
    result = []
    for r in recipes:
        result.append({
            "id": r.id,
            "title": r.title,
            "category": r.category,
            "prepTime": r.prepTime,
            "image": r.image,
            "ingredients": r.ingredients,
            "steps": r.steps,
            "likes": r.likes,
            "author": r.author,
            "rating": r.rating
        })
    return jsonify(result)

# Add new recipe (ID auto-generated)
@app.route("/recipes", methods=["POST"])
def add_recipe():
    data = request.json
    r = Recipe(
        title=data.get("title"),
        category=data.get("category"),
        prepTime=data.get("prepTime"),
        image=data.get("image"),
        ingredients=data.get("ingredients"),
        steps=data.get("steps"),
        likes=data.get("likes", 0),
        author=data.get("author"),
        rating=data.get("rating", 0)
    )
    db.session.add(r)
    db.session.commit()
    
    return jsonify({
        "status": "ok",
        "recipe": {"id": r.id, "title": r.title, "category": r.category}
    }), 201

# Update recipe
@app.route("/recipes/<int:rid>", methods=["PUT"])
def edit_recipe(rid):
    r = Recipe.query.get(rid)
    if not r:
        return jsonify({"error": "Recipe not found"}), 404
    
    data = request.json
    r.title = data.get("title", r.title)
    r.category = data.get("category", r.category)
    r.prepTime = data.get("prepTime", r.prepTime)
    r.image = data.get("image", r.image)
    r.ingredients = data.get("ingredients", r.ingredients)
    r.steps = data.get("steps", r.steps)
    r.rating = data.get("rating", r.rating)

    db.session.commit()
    return jsonify({"status": "updated"})

# Delete recipe
@app.route("/recipes/<int:rid>", methods=["DELETE"])
def delete_recipe(rid):
    r = Recipe.query.get(rid)
    if not r:
        return jsonify({"error": "Recipe not found"}), 404
    
    db.session.delete(r)
    db.session.commit()
    return jsonify({"status": "deleted"})

# Like recipe
@app.route("/recipes/<int:rid>/like", methods=["POST"])
def like_recipe(rid):
    r = Recipe.query.get(rid)
    if not r:
        return jsonify({"error": "Recipe not found"}), 404

    r.likes += 1
    db.session.commit()
    return jsonify({"status": "liked", "likes": r.likes})

# Register user
@app.route("/register", methods=["POST"])
def register():
    data = request.json
    if User.query.filter_by(username=data["username"]).first():
        return jsonify({"error": "User exists"}), 400
    
    u = User(
        username=data["username"],
        password=data["password"],
        role=data.get("role", "user")
    )
    db.session.add(u)
    db.session.commit()
    
    return jsonify({
        "status": "registered",
        "user": {"id": u.id, "username": u.username, "role": u.role}
    })

# Login
@app.route("/login", methods=["POST"])
def login():
    data = request.json
    u = User.query.filter_by(username=data["username"], password=data["password"]).first()
    
    if not u:
        return jsonify({"error": "Invalid credentials"}), 401
    
    return jsonify({
        "status": "ok",
        "user": {"id": u.id, "username": u.username, "role": u.role}
    })

# Test DB
@app.route("/test-db")
def test_db():
    try:
        result = db.session.execute(db.text("SELECT 1")).scalar()
        return f"Database connected! Test query result: {result}"
    except Exception as e:
        return f"Database connection failed: {e}"

# ---------------- Initialize Tables ----------------
# ---------------- COMMENTS ------------------------

@app.route("/comments/<int:recipe_id>", methods=["GET"])
def get_comments(recipe_id):
    comments = Comment.query.filter_by(recipe_id=recipe_id).all()
    result = []
    for c in comments:
        result.append({
            "id": c.id,
            "user": User.query.get(c.user_id).username,
            "content": c.content
        })
    return jsonify(result)

@app.route("/comments/<int:recipe_id>", methods=["POST"])
def add_comment(recipe_id):
    data = request.json

    if not data.get("user_id") or not data.get("content"):
        return jsonify({"error": "Missing fields"}), 400

    c = Comment(
        user_id=data["user_id"],
        recipe_id=recipe_id,
        content=data["content"]
    )
    db.session.add(c)
    db.session.commit()

    return jsonify({"status": "ok"})

def init_db():
    with app.app_context():
        print("Creating tables if they don't exist...")
        db.create_all()

        if Recipe.query.count() == 0:
            print("Adding sample recipes...")

            samples = [
                Recipe(
                    title="Avocado Toast Supreme",
                    category="Breakfast",
                    prepTime=10,
                    image="https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=500",
                    ingredients=["2 slices bread", "1 avocado", "Salt", "Pepper", "Lemon juice"],
                    steps=["Toast bread", "Mash avocado", "Spread on toast"],
                    likes=42,
                    author="Chef Maria",
                    rating=4
                ),
                Recipe(
                    title="Quick Pasta Carbonara",
                    category="Main Course",
                    prepTime=20,
                    image="https://images.unsplash.com/photo-1612874742237-6526221588e3?w=500",
                    ingredients=["400g pasta", "200g bacon", "3 eggs", "Parmesan cheese", "Black pepper"],
                    steps=["Cook pasta", "Fry bacon", "Mix eggs", "Combine all"],
                    likes=89,
                    author="Chef Giovanni",
                    rating=5
                ),
                Recipe(
                    title="Berry Smoothie Bowl",
                    category="Breakfast",
                    prepTime=5,
                    image="https://images.unsplash.com/photo-1590301157890-4810ed352733?w=500",
                    ingredients=["1 cup frozen berries", "1 banana", "1/2 cup yogurt", "Granola", "Honey"],
                    steps=["Blend ingredients", "Add toppings"],
                    likes=67,
                    author="Chef Sarah",
                    rating=4
                )
            ]

            for recipe in samples:
                db.session.add(recipe)
            db.session.commit()
            print("Sample recipes added!")

# ---------------- Run Server -----------------------
if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
