from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

OUT = "output/pdf/game-achievements.pdf"
W, H = A4

BG = HexColor("#10131B")
PANEL = HexColor("#1A2030")
PANEL2 = HexColor("#202A3D")
INK = HexColor("#EAF0FC")
MUTED = HexColor("#A4B0C7")
BLUE = HexColor("#61A7FF")
GOLD = HexColor("#F8C75D")
GREEN = HexColor("#65D6A6")
PURPLE = HexColor("#B69BFF")
LINE = HexColor("#344159")

c = canvas.Canvas(OUT, pagesize=A4)
c.setTitle("Game Achievements")

def rect(x, y, w, h, color, radius=0):
    c.setFillColor(color)
    c.setStrokeColor(color)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=0)

def text(x, y, s, size=10, color=INK, font="Helvetica"):
    c.setFont(font, size); c.setFillColor(color); c.drawString(x, y, s)

def right(x, y, s, size=10, color=INK, font="Helvetica"):
    c.setFont(font, size); c.setFillColor(color); c.drawRightString(x, y, s)

def pill(x, y, label, color):
    c.setFont("Helvetica-Bold", 7)
    w = stringWidth(label, "Helvetica-Bold", 7) + 14
    rect(x, y, w, 16, color, 8)
    text(x + 7, y + 5, label, 7, BG, "Helvetica-Bold")
    return w

def star(cx, cy, color):
    c.setFillColor(color)
    c.circle(cx, cy, 16, fill=1, stroke=0)
    c.setFillColor(BG)
    c.setFont("Helvetica-Bold", 17)
    c.drawCentredString(cx, cy - 6, "*")

def progress(x, y, w, pct, color):
    rect(x, y, w, 7, PANEL2, 3.5)
    rect(x, y, w * pct, 7, color, 3.5)

# Page 1
rect(0, 0, W, H, BG)
rect(0, H-10, W, 10, BLUE)
text(46, H-65, "PLAYER PROFILE", 9, BLUE, "Helvetica-Bold")
text(46, H-101, "Achievement Vault", 27, INK, "Helvetica-Bold")
text(46, H-122, "A snapshot of completed quests, trophies, and legendary moments.", 10, MUTED)

rect(46, H-208, W-92, 62, PANEL, 12)
text(64, H-170, "TOTAL ACHIEVEMENTS", 8, MUTED, "Helvetica-Bold")
text(64, H-194, "47", 24, INK, "Helvetica-Bold")
text(180, H-170, "COMPLETION RATE", 8, MUTED, "Helvetica-Bold")
text(180, H-194, "68%", 24, INK, "Helvetica-Bold")
progress(180, H-202, 120, .68, BLUE)
text(334, H-170, "GAMES TRACKED", 8, MUTED, "Helvetica-Bold")
text(334, H-194, "06", 24, INK, "Helvetica-Bold")
text(439, H-170, "RAREST UNLOCK", 8, MUTED, "Helvetica-Bold")
text(439, H-194, "2.4%", 24, GOLD, "Helvetica-Bold")

text(46, H-247, "RECENTLY UNLOCKED", 11, INK, "Helvetica-Bold")
recent = [
    ("THE LAST OF US PART II", "Survival Expert", "Upgrade all player skills", "RARE", GOLD, "08 AUG 2026"),
    ("ELDEN RING", "Shardbearer", "Defeat a demigod in battle", "EPIC", PURPLE, "02 AUG 2026"),
    ("HADES", "God of Blood", "Fulfil the prophecy", "LEGENDARY", GOLD, "29 JUL 2026"),
]
yy = H-323
for game, title, desc, rarity, color, date in recent:
    rect(46, yy, W-92, 62, PANEL, 10)
    star(75, yy+31, color)
    text(104, yy+42, game, 7, MUTED, "Helvetica-Bold")
    text(104, yy+25, title, 13, INK, "Helvetica-Bold")
    text(104, yy+11, desc, 8, MUTED)
    pw = pill(415, yy+33, rarity, color)
    right(W-46, yy+14, date, 7, MUTED, "Helvetica-Bold")
    yy -= 76

text(46, 260, "BY GAME", 11, INK, "Helvetica-Bold")
games = [("Elden Ring", "34 / 42", .81, PURPLE), ("Hades", "43 / 49", .88, GOLD), ("The Last of Us Part II", "28 / 38", .74, GREEN)]
xx = 46
for name, count, pct, col in games:
    rect(xx, 150, 156, 88, PANEL, 10)
    text(xx+14, 210, name, 10, INK, "Helvetica-Bold")
    text(xx+14, 188, count + " unlocked", 8, MUTED)
    progress(xx+14, 169, 128, pct, col)
    text(xx+14, 156, f"{int(pct*100)}% complete", 8, col, "Helvetica-Bold")
    xx += 170
text(46, 54, "GAME ACHIEVEMENTS  /  PERSONAL RECORD", 7, MUTED, "Helvetica-Bold")
right(W-46, 54, "PAGE 1", 7, MUTED, "Helvetica-Bold")
c.showPage()

# Page 2
rect(0, 0, W, H, BG)
rect(0, H-10, W, 10, GOLD)
text(46, H-65, "SHOWCASE", 9, GOLD, "Helvetica-Bold")
text(46, H-101, "Legendary achievements", 27, INK, "Helvetica-Bold")
text(46, H-122, "The milestones worth remembering.", 10, MUTED)

showcase = [
    ("GOD OF WAR RAGNAROK", "Grave Mistake", "Defeat King Hrolf Kraki", "A punishing final duel completed without lowering the difficulty.", "4.7% of players", GOLD),
    ("HOLLOW KNIGHT", "Pure Completion", "Reach 112% completion", "Every charm, boss, trial, and hidden corner accounted for.", "3.1% of players", PURPLE),
    ("CELESTE", "Farewell", "Complete Chapter 9", "A patient climb through the game's most demanding platforming gauntlet.", "6.9% of players", BLUE),
]
yy = H-270
for game, title, sub, desc, rarity, color in showcase:
    rect(46, yy, W-92, 138, PANEL, 13)
    rect(46, yy+108, W-92, 30, PANEL2, 13)
    text(64, yy+119, game, 8, color, "Helvetica-Bold")
    star(82, yy+71, color)
    text(116, yy+82, title, 17, INK, "Helvetica-Bold")
    text(116, yy+63, sub, 10, MUTED)
    text(116, yy+39, desc, 9, INK)
    pill(64, yy+13, "LEGENDARY", color)
    right(W-64, yy+18, rarity, 8, color, "Helvetica-Bold")
    yy -= 158

rect(46, 80, W-92, 76, PANEL, 12)
text(64, 130, "NEXT TARGET", 8, MUTED, "Helvetica-Bold")
text(64, 105, "The Lands Between", 16, INK, "Helvetica-Bold")
text(64, 89, "Discover every location in Elden Ring", 9, MUTED)
progress(346, 110, 170, .72, GREEN)
right(516, 92, "72% explored", 8, GREEN, "Helvetica-Bold")
text(46, 54, "GAME ACHIEVEMENTS  /  PERSONAL RECORD", 7, MUTED, "Helvetica-Bold")
right(W-46, 54, "PAGE 2", 7, MUTED, "Helvetica-Bold")
c.save()
