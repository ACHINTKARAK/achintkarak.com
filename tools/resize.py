from pathlib import Path
from PIL import Image

MAX_SIZE = 2048
QUALITY = 85

def resize_folder(folder):
    folder = Path(folder)
    for img_path in folder.glob("*"):
        if img_path.suffix.lower() not in [".jpg", ".jpeg", ".png"]:
            continue

        with Image.open(img_path) as img:
            img = img.convert("RGB")
            img.thumbnail((MAX_SIZE, MAX_SIZE), Image.LANCZOS)
            img.save(img_path.with_suffix(".jpg"), "JPEG", quality=QUALITY, optimize=True)

        print(f"Resized: {img_path.name}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python resize.py <folder>")
    else:
        resize_folder(sys.argv[1])