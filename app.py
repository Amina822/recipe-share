import os
import uuid
import json

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

DATABASE_URL = "postgresql://postgres:2006@127.0.0.1:5432/web_back"
app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ECHO"] = True

db = SQLAlchemy(app)

UPLOAD_FOLDER = os.path.join(app.root_path, "uploads")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp", "avif"}

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024


def ensure_upload_folder():
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def parse_list_field(value):
    if not value:
        return []
    if isinstance(value, list):
        return value
    try:
        return json.loads(value)
    except:
        return [x.strip() for x in value.replace(",", "\n").split("\n") if x.strip()]


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), default="user")


class Recipe(db.Model):
    __tablename__ = "recipes"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(120), nullable=False)
    category = db.Column(db.String(80))
    prepTime = db.Column(db.Integer)
    image = db.Column(db.Text)
    ingredients = db.Column(db.JSON)
    steps = db.Column(db.JSON)
    author = db.Column(db.String(80))


class Like(db.Model):
    __tablename__ = "likes"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    recipe_id = db.Column(db.Integer, db.ForeignKey("recipes.id"))

    __table_args__ = (
        db.UniqueConstraint("user_id", "recipe_id"),
    )


class Favorite(db.Model):
    __tablename__ = "favorites"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    recipe_id = db.Column(db.Integer, db.ForeignKey("recipes.id"))

    __table_args__ = (
        db.UniqueConstraint("user_id", "recipe_id"),
    )


class Rating(db.Model):
    __tablename__ = "ratings"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    recipe_id = db.Column(db.Integer, db.ForeignKey("recipes.id"))
    stars = db.Column(db.Integer, nullable=False)

    __table_args__ = (
        db.UniqueConstraint("user_id", "recipe_id"),
    )


class Comment(db.Model):
    __tablename__ = "comments"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    recipe_id = db.Column(db.Integer, db.ForeignKey("recipes.id"))
    content = db.Column(db.Text)

def avg_rating(recipe_id):
    rows = Rating.query.filter_by(recipe_id=recipe_id).all()
    if not rows:
        return 0
    return round(sum(r.stars for r in rows) / len(rows), 1)

@app.route("/")
def home():
    return "Pocket Chef API running"


@app.route("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


@app.route("/recipes", methods=["GET"])
def get_recipes():
    username = request.args.get("username")
    user = User.query.filter_by(username=username).first() if username else None

    recipes = Recipe.query.all()
    result = []

    for r in recipes:
        likes = Like.query.filter_by(recipe_id=r.id).count()
        fav = False
        liked = False
        user_rating = 0

        if user:
            liked = Like.query.filter_by(user_id=user.id, recipe_id=r.id).first() is not None
            fav = Favorite.query.filter_by(user_id=user.id, recipe_id=r.id).first() is not None
            rate = Rating.query.filter_by(user_id=user.id, recipe_id=r.id).first()
            user_rating = rate.stars if rate else 0

        result.append({
            "id": r.id,
            "title": r.title,
            "category": r.category,
            "prepTime": r.prepTime,
            "image": r.image or "",
            "ingredients": r.ingredients or [],
            "steps": r.steps or [],
            "author": r.author or "",
            "likes": likes,
            "rating": avg_rating(r.id),
            "userLiked": liked,
            "userFavorited": fav,
            "userRating": user_rating
        })

    return jsonify(result)


@app.route("/recipes", methods=["POST"])
def add_recipe():
    ensure_upload_folder()
    data = request.form.to_dict()

    file = request.files.get("image")
    image_url = data.get("image", "")

    if file and file.filename:
        if not allowed_file(file.filename):
            return jsonify({"error": "Invalid file type"}), 400
        name = f"{uuid.uuid4().hex}_{secure_filename(file.filename)}"
        file.save(os.path.join(app.config["UPLOAD_FOLDER"], name))
        image_url = f"/uploads/{name}"

    recipe = Recipe(
        title=data["title"],
        category=data.get("category"),
        prepTime=int(data.get("prepTime", 0)),
        image=image_url,
        ingredients=parse_list_field(data.get("ingredients")),
        steps=parse_list_field(data.get("steps")),
        author=data.get("author")
    )

    db.session.add(recipe)
    db.session.commit()
    return jsonify({"status": "ok"}), 201
@app.route("/recipes/<int:rid>", methods=["PUT", "DELETE"])
def update_or_delete_recipe(rid):
    recipe = Recipe.query.get(rid)
    if not recipe:
        return jsonify({"error": "Recipe not found"}), 404

    username = request.args.get("username") 
    if not username:
        return jsonify({"error": "username is required"}), 400

    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    if recipe.author != username and user.role != "admin":
        return jsonify({"error": "Not allowed"}), 403

    if request.method == "PUT":
        data = request.get_json(silent=True) or {}

        recipe.title = data.get("title", recipe.title)
        recipe.category = data.get("category", recipe.category)
        recipe.prepTime = int(data.get("prepTime", recipe.prepTime or 0))
        recipe.image = data.get("image", recipe.image)
        recipe.ingredients = data.get("ingredients", recipe.ingredients or [])
        recipe.steps = data.get("steps", recipe.steps or [])

        db.session.commit()
        return jsonify({"status": "updated"})

    Like.query.filter_by(recipe_id=rid).delete(synchronize_session=False)
    Favorite.query.filter_by(recipe_id=rid).delete(synchronize_session=False)
    Rating.query.filter_by(recipe_id=rid).delete(synchronize_session=False)
    Comment.query.filter_by(recipe_id=rid).delete(synchronize_session=False)

    db.session.flush() 
    if recipe.image and recipe.image.startswith("/uploads/"):
        try:
            filename = recipe.image.replace("/uploads/", "")
            path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            if os.path.exists(path):
                os.remove(path)
        except Exception as e:
            print("Image delete warning:", e)

    db.session.delete(recipe)
    db.session.commit()

    return jsonify({"status": "deleted"})

@app.route("/recipes/<int:rid>/like", methods=["POST"])
def toggle_like(rid):
    username = request.json.get("username")
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    existing = Like.query.filter_by(user_id=user.id, recipe_id=rid).first()
    if existing:
        db.session.delete(existing)
        action = "unliked"
    else:
        db.session.add(Like(user_id=user.id, recipe_id=rid))
        action = "liked"

    db.session.commit()
    return jsonify({"status": action, "likes": Like.query.filter_by(recipe_id=rid).count()})


@app.route("/recipes/<int:rid>/favorite", methods=["POST"])
def toggle_favorite(rid):
    username = request.json.get("username")
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    existing = Favorite.query.filter_by(user_id=user.id, recipe_id=rid).first()
    if existing:
        db.session.delete(existing)
        action = "removed"
    else:
        db.session.add(Favorite(user_id=user.id, recipe_id=rid))
        action = "added"

    db.session.commit()
    return jsonify({"status": action})


@app.route("/recipes/<int:rid>/rate", methods=["POST"])
def rate_recipe(rid):
    data = request.json
    stars = int(data.get("stars", 0))
    username = data.get("username")

    if stars < 1 or stars > 5:
        return jsonify({"error": "Rating must be 1–5"}), 400

    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    row = Rating.query.filter_by(user_id=user.id, recipe_id=rid).first()
    if row:
        row.stars = stars
    else:
        db.session.add(Rating(user_id=user.id, recipe_id=rid, stars=stars))

    db.session.commit()
    return jsonify({"avgRating": avg_rating(rid), "userRating": stars})


@app.route("/register", methods=["POST"])
def register():
    data = request.json
    if User.query.filter_by(username=data["username"]).first():
        return jsonify({"error": "User exists"}), 400

    user = User(username=data["username"], password=data["password"])
    db.session.add(user)
    db.session.commit()
    return jsonify({"user": {"id": user.id, "username": user.username}})


@app.route("/login", methods=["POST"])
def login():
    data = request.json
    user = User.query.filter_by(username=data["username"], password=data["password"]).first()
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401
    return jsonify({"user": {"id": user.id, "username": user.username}})


def init_db():
    with app.app_context():
        ensure_upload_folder()
        db.create_all()


if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
