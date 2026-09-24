from PIL import Image, ImageDraw, ImageFont
import os

w, h = 1200, 630
img = Image.new('RGB', (w, h), '#0f172a')
draw = ImageDraw.Draw(img)

for y in range(h):
    r = int(15 + (52 - 15) * (y / h))
    g = int(23 + (108 - 23) * (y / h))
    b = int(42 + (140 - 42) * (y / h))
    draw.line([(0, y), (w, y)], fill=(r, g, b))

board_size = 280
cell = board_size // 8
base_x, base_y = 60, 100
for row in range(8):
    for col in range(8):
        if (row + col) % 2 == 0:
            color = (255, 255, 255, 30)
        else:
            color = (255, 255, 255, 10)
        draw.rectangle([base_x + col * cell, base_y + row * cell, base_x + (col + 1) * cell, base_y + (row + 1) * cell], fill=color)

overlay = Image.new('RGBA', img.size, (255,255,255,0))
overlay_draw = ImageDraw.Draw(overlay)
overlay_draw.rounded_rectangle((40, 80, 340, 520), radius=30, fill=(255,255,255,20))
img = Image.alpha_composite(img.convert('RGBA'), overlay)
img = img.convert('RGB')
draw = ImageDraw.Draw(img)

try:
    font_bold = ImageFont.truetype('arialbd.ttf', 64)
    font_semibold = ImageFont.truetype('arial.ttf', 34)
    font_caption = ImageFont.truetype('arial.ttf', 26)
except Exception:
    font_bold = ImageFont.load_default()
    font_semibold = ImageFont.load_default()
    font_caption = ImageFont.load_default()

text = 'Comparativa PRO para árbitros'
text2 = 'Chess Organizers Pro'
text3 = 'Escanea partidas, gestiona torneos y ahorra tiempo'

x = 420
draw.text((x, 140), text, font=font_bold, fill='#F8FAFC')
draw.text((x, 230), text2, font=font_semibold, fill='#FCD34D')
draw.text((x, 286), text3, font=font_caption, fill='#E2E8F0')

cta_text = 'Comparativa + Scanner PRO'
cta_bounds = draw.textbbox((0, 0), cta_text, font=font_semibold)
cta_w = cta_bounds[2] - cta_bounds[0]
cta_h = cta_bounds[3] - cta_bounds[1]
cta_x = x
cta_y = 360
padding = 18
draw.rounded_rectangle((cta_x - padding, cta_y - padding, cta_x + cta_w + padding, cta_y + cta_h + padding), radius=20, fill='#F59E0B')
draw.text((cta_x, cta_y), cta_text, font=font_semibold, fill='#0F172A')

draw.text((x, 460), 'Ideal para organizar torneos presenciales y online', font=font_caption, fill='#CBD5E1')
draw.text((x, 520), 'Visita: chess-organizers-pro.vercel.app', font=font_caption, fill='#94A3B8')

for i, label in enumerate(['10 torneos activos', '10 torneos pasados', 'Importa PGN/CBV/planillas']):
    dot_y = 350 + i * 50
    draw.ellipse((x - 30, dot_y, x - 10, dot_y + 20), fill='#F59E0B')
    draw.text((x - 10, dot_y), label, font=font_caption, fill='#E2E8F0')

os.makedirs('assets', exist_ok=True)
path = os.path.join('assets', 'promo-comparativa-chess-organizers-pro.png')
img.save(path, format='PNG')
print(path)
