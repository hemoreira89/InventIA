#!/usr/bin/env python3
"""Gera os posts do Instagram do Cauril como PNG (1080x1350) usando Pillow.
Vantagens vs HTML: zero dependência de viewer/JS, mesmo resultado em qualquer
plataforma, pronto pra postar direto sem screenshot."""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import pathlib, math, os

ROOT = pathlib.Path(__file__).parent
F = ROOT / "fonts"
OUT = ROOT
LOGO = ROOT.parent / "public/icons/icon-512.png"

# Tamanho do post
W, H = 1080, 1350

# Paleta
BG_BASE     = (10, 10, 18)
BG_MID      = (12, 12, 22)
BG_DEEP     = (8, 8, 16)
TEXT        = (244, 238, 222)
TEXT_MUTE   = (154, 145, 128)
TEXT_FAINT  = (91, 87, 74)
GOLD        = (201, 168, 76)
GOLD_SOFT   = (217, 187, 106)
UP          = (74, 222, 128)
DOWN        = (248, 113, 113)
WHITE       = (255, 255, 255)
CARD        = (21, 21, 31)
CARD_DEEP   = (14, 14, 23)

ACCENT = {
    "red":   dict(border=(248,113,113,90), bg=(248,113,113,15), text=(252,165,165), dot=(248,113,113)),
    "gold":  dict(border=(201,168,76,100), bg=(201,168,76,18),  text=(217,187,106), dot=(201,168,76)),
    "green": dict(border=(74,222,128,90),  bg=(74,222,128,15),  text=(134,239,172), dot=(74,222,128)),
    "blue":  dict(border=(96,165,250,90),  bg=(96,165,250,15),  text=(147,197,253), dot=(96,165,250)),
}

# Fontes (FreeSerif = stand-in pra Cormorant Garamond)
def font(name, size):
    paths = {
        "serif":         "FreeSerif.ttf",
        "serif-italic":  "FreeSerifItalic.ttf",
        "serif-bold":    "FreeSerifBold.ttf",
        "sans":          "Inter[opsz,wght].ttf",
        "mono":          "JetBrainsMono-Regular.ttf",
        "mono-bold":     "JetBrainsMono-Bold.ttf",
    }
    return ImageFont.truetype(str(F / paths[name]), size)

def measure(d, text, fnt):
    bbox = d.textbbox((0, 0), text, font=fnt)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]

def rounded_rect(d, xy, radius, fill=None, outline=None, width=1):
    """Retângulo arredondado."""
    d.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)

def draw_pill(img, d, xy, text, color, font_size=18):
    """Pílula com dot pulsante (estático aqui)."""
    x, y = xy
    fnt = font("mono-bold", font_size)
    pad_x, pad_y = 22, 14
    tw, th = measure(d, text, fnt)
    dot_size = 10
    gap = 14
    width = pad_x*2 + dot_size + gap + tw
    height = th + pad_y*2

    # bg + border (precisa de alpha → composite layer)
    overlay = Image.new("RGBA", (width+20, height+20), (0,0,0,0))
    od = ImageDraw.Draw(overlay)
    rounded_rect(od, (10, 10, 10+width, 10+height), radius=height//2,
                 fill=color["bg"], outline=color["border"], width=1)
    img.paste(overlay, (x-10, y-10), overlay)

    # dot
    d.ellipse((x+pad_x, y+pad_y+th//2-dot_size//2, x+pad_x+dot_size, y+pad_y+th//2+dot_size//2),
              fill=color["dot"])
    # glow halo do dot
    halo = Image.new("RGBA", (60, 60), (0,0,0,0))
    hd = ImageDraw.Draw(halo)
    hd.ellipse((10, 10, 50, 50), fill=color["dot"]+(70,))
    halo = halo.filter(ImageFilter.GaussianBlur(8))
    img.paste(halo, (x+pad_x+dot_size//2-30, y+pad_y+th//2-30), halo)

    # text
    d.text((x+pad_x+dot_size+gap, y+pad_y), text, font=fnt, fill=color["text"])
    return width, height

def text_block(d, xy, text, fnt, fill, max_width=None, line_spacing=1.0):
    """Bloco de texto que quebra automaticamente. Retorna altura usada."""
    x, y = xy
    if max_width is None:
        d.text(xy, text, font=fnt, fill=fill)
        _, h = measure(d, text, fnt)
        return h
    # quebra em palavras
    words = text.split()
    lines = []
    cur = []
    for w in words:
        test = " ".join(cur + [w])
        tw, _ = measure(d, test, fnt)
        if tw <= max_width or not cur:
            cur.append(w)
        else:
            lines.append(" ".join(cur))
            cur = [w]
    if cur: lines.append(" ".join(cur))

    # altura de uma linha
    _, lh = measure(d, "Ag", fnt)
    lh = int(lh * line_spacing)
    for i, line in enumerate(lines):
        d.text((x, y + i*lh), line, font=fnt, fill=fill)
    return lh * len(lines)

def draw_background(img):
    """Background com gradient sutil + dot grid + corner ornaments."""
    d = ImageDraw.Draw(img)
    # Gradient vertical sutil
    for y in range(H):
        t = y / H
        if t < 0.55:
            r,g,b = BG_BASE
        elif t < 1:
            r,g,b = BG_MID
        else:
            r,g,b = BG_DEEP
        d.line([(0, y), (W, y)], fill=(r, g, b))

    # Glow dourado superior direito
    glow = Image.new("RGBA", (W, H), (0,0,0,0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((W*0.4, -200, W*1.1, 500), fill=(201, 168, 76, 30))
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    img.paste(glow, (0,0), glow)

    # Glow inferior esquerdo
    glow2 = Image.new("RGBA", (W, H), (0,0,0,0))
    gd2 = ImageDraw.Draw(glow2)
    gd2.ellipse((-200, H-300, 600, H+300), fill=(201, 168, 76, 18))
    glow2 = glow2.filter(ImageFilter.GaussianBlur(120))
    img.paste(glow2, (0,0), glow2)

    # Dot grid (só nos top 70%)
    dots = Image.new("RGBA", (W, int(H*0.75)), (0,0,0,0))
    dd = ImageDraw.Draw(dots)
    for gy in range(0, int(H*0.75), 32):
        for gx in range(0, W, 32):
            dd.ellipse((gx-1, gy-1, gx+1, gy+1), fill=(255,255,255,12))
    img.paste(dots, (0,0), dots)

    # Corner ornaments (gold L-shapes)
    d = ImageDraw.Draw(img, "RGBA")
    corner_color = (201, 168, 76, 90)
    cs = 34  # corner size
    for cx, cy, rev in [(18,18,False), (W-18-cs,18,False), (18,H-18-cs,True), (W-18-cs,H-18-cs,True)]:
        # top-left style L by default; rotate for others
        pass
    # TL
    d.line([(18,18+cs),(18,18),(18+cs,18)], fill=corner_color, width=1)
    # TR
    d.line([(W-18-cs,18),(W-18,18),(W-18,18+cs)], fill=corner_color, width=1)
    # BL
    d.line([(18,H-18-cs),(18,H-18),(18+cs,H-18)], fill=corner_color, width=1)
    # BR
    d.line([(W-18-cs,H-18),(W-18,H-18),(W-18,H-18-cs)], fill=corner_color, width=1)

def draw_logo(img, x, y, size=70):
    """Cola o logo do Cauril (icon-512) escalado pra `size`x`size`."""
    logo = Image.open(LOGO).convert("RGBA")
    logo = logo.resize((size, size), Image.LANCZOS)
    # Adiciona um leve glow dourado
    glow = Image.new("RGBA", (size+40, size+40), (0,0,0,0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((10, 10, size+30, size+30), fill=(201,168,76,40))
    glow = glow.filter(ImageFilter.GaussianBlur(15))
    img.paste(glow, (x-20, y-20), glow)
    img.paste(logo, (x, y), logo)

def draw_brand(img, d, x, y):
    """Logo + nome 'Cauril' (com 'ril' dourado) + tag."""
    draw_logo(img, x, y, size=84)
    name_x = x + 84 + 20
    name_fnt = font("serif", 54)
    # 'Cau' branco
    d.text((name_x, y+6), "Cau", font=name_fnt, fill=TEXT)
    cau_w, _ = measure(d, "Cau", name_fnt)
    # 'ril' dourado
    d.text((name_x + cau_w, y+6), "ril", font=name_fnt, fill=GOLD_SOFT)
    # tag
    tag_fnt = font("mono", 13)
    d.text((name_x, y+68), "ANÁLISE EDUCACIONAL · B3", font=tag_fnt, fill=TEXT_FAINT, spacing=4)

def draw_dashed_line(d, x0, y, x1, color, dash=4, gap=4, width=1):
    x = x0
    while x < x1:
        d.line([(x, y), (min(x+dash, x1), y)], fill=color, width=width)
        x += dash + gap

def draw_chart(d, x, y, w, h):
    """Mini linha ascendente verde."""
    # baseline grid
    draw_dashed_line(d, x, y+int(h*0.3), x+w, (255,255,255,10), 2, 4)
    draw_dashed_line(d, x, y+int(h*0.6), x+w, (255,255,255,10), 2, 4)
    # pontos da linha
    pts_y_pct = [0.85, 0.80, 0.74, 0.70, 0.58, 0.62, 0.50, 0.45, 0.38, 0.30, 0.25, 0.17, 0.11]
    pts = [(x + i*(w/(len(pts_y_pct)-1)), y + h*py) for i, py in enumerate(pts_y_pct)]
    # área (fill) - simplificado: triângulos
    fill_pts = pts + [(x+w, y+h), (x, y+h)]
    overlay = Image.new("RGBA", (w+10, h+10), (0,0,0,0))
    od = ImageDraw.Draw(overlay)
    od.polygon([(p[0]-x, p[1]-y) for p in fill_pts], fill=(74,222,128,40))
    return overlay, pts

def draw_mock(img, d, x, y, w, insight_color_key=None, insight_tag=None, insight_html=None):
    """Dashboard mockup completo. Retorna altura usada."""
    h_bar = 50
    h_body = 340
    h_total = h_bar + h_body

    # Card background (rounded)
    overlay = Image.new("RGBA", (w, h_total), (0,0,0,0))
    od = ImageDraw.Draw(overlay)
    rounded_rect(od, (0, 0, w, h_total), radius=16, fill=(21, 21, 31, 255))
    # border
    rounded_rect(od, (0, 0, w-1, h_total-1), radius=16, outline=(255,255,255,15), width=1)

    # Title bar
    rounded_rect(od, (0, 0, w, h_bar), radius=16, fill=(0,0,0,60))
    # straight bottom of title bar
    od.rectangle((0, h_bar-16, w, h_bar), fill=(0,0,0,60))
    od.line((0, h_bar, w, h_bar), fill=(255,255,255,10), width=1)

    # Window dots
    for i, c in enumerate([(255,95,87), (254,188,46), (40,200,64)]):
        od.ellipse((18 + i*18, h_bar//2-6, 18 + i*18 + 11, h_bar//2+5), fill=c)

    # URL
    fnt_url = font("mono", 13)
    od.text((84, h_bar//2-7), "⌘ cauril.com.br/analise/carteira", font=fnt_url, fill=(91,91,118))

    # Body — duas colunas
    col_w = (w - 1) // 2
    # divisor vertical
    od.line((col_w, h_bar+20, col_w, h_total-20), fill=(255,255,255,15), width=1)

    img.paste(overlay, (x, y), overlay)

    # LEFT COLUMN: Patrimônio + chart
    lx = x + 30
    ly = y + h_bar + 22

    # Label
    fnt_label = font("mono", 13)
    d.text((lx, ly), "PATRIMÔNIO · 12M", font=fnt_label, fill=TEXT_FAINT, spacing=4)
    # linha sutil ao lado
    d.line((lx + 200, ly+8, lx + col_w - 60, ly+8), fill=(255,255,255,15))

    # Patrimônio number
    fnt_big = font("mono-bold", 56)
    d.text((lx, ly+18), "R$ 248,3", font=fnt_big, fill=TEXT)
    pat_w, _ = measure(d, "R$ 248,3", fnt_big)
    fnt_cents = font("mono-bold", 32)
    d.text((lx + pat_w + 4, ly+38), "k", font=fnt_cents, fill=TEXT_MUTE)

    # Delta
    fnt_delta = font("mono-bold", 16)
    dx = lx
    dy = ly + 90
    delta_text = "▲ +18,4%"
    dw, dh = measure(d, delta_text, fnt_delta)
    rounded_rect(d, (dx, dy, dx + dw + 22, dy + dh + 14), radius=6,
                 fill=(74,222,128,20), outline=(74,222,128,55), width=1)
    d.text((dx+11, dy+7), delta_text, font=fnt_delta, fill=UP)
    fnt_note = font("sans", 14)
    d.text((dx + dw + 36, dy+8), "vs CDI:", font=fnt_note, fill=TEXT_FAINT)
    nw, _ = measure(d, "vs CDI: ", fnt_note)
    fnt_note_bold = font("sans", 14)
    d.text((dx + dw + 36 + nw, dy+8), "+6,2pp", font=fnt_note_bold, fill=TEXT)

    # Mini chart
    ch_x = lx
    ch_y = ly + 140
    ch_w = col_w - 60
    ch_h = 80
    overlay_chart, pts = draw_chart(d, ch_x, ch_y, ch_w, ch_h)
    img.paste(overlay_chart, (ch_x, ch_y), overlay_chart)
    # linha
    for i in range(len(pts)-1):
        d.line([pts[i], pts[i+1]], fill=UP, width=3)
    # ponto final
    px, py = pts[-1]
    halo = Image.new("RGBA", (24, 24), (0,0,0,0))
    hd = ImageDraw.Draw(halo)
    hd.ellipse((2, 2, 22, 22), fill=(74,222,128,60))
    halo = halo.filter(ImageFilter.GaussianBlur(4))
    img.paste(halo, (int(px)-12, int(py)-12), halo)
    d.ellipse((px-5, py-5, px+5, py+5), fill=UP)

    # RIGHT COLUMN: Tickers
    rx = x + col_w + 30
    ry = y + h_bar + 22
    d.text((rx, ry), "CARTEIRA · HOJE", font=fnt_label, fill=TEXT_FAINT, spacing=4)
    d.line((rx + 180, ry+8, rx + col_w - 60, ry+8), fill=(255,255,255,15))

    tickers = [
        ("PETR4", "Petrobras",    "R$ 38,42", "▲ +1,24%", UP),
        ("VALE3", "Vale",         "R$ 61,80", "▼ −0,62%", DOWN),
        ("ITUB4", "Itaú Unibanco","R$ 34,15", "▲ +0,88%", UP),
        ("MXRF11","Maxi Renda FII","R$ 10,42","▲ +0,19%", UP),
    ]
    ty = ry + 24
    fnt_sym = font("mono-bold", 18)
    fnt_name = font("sans", 13)
    fnt_price = font("mono", 16)
    fnt_var = font("mono-bold", 13)
    for sym, name, price, var, color in tickers:
        d.text((rx, ty), sym, font=fnt_sym, fill=TEXT)
        d.text((rx, ty+22), name, font=fnt_name, fill=TEXT_FAINT)
        pw, _ = measure(d, price, fnt_price)
        d.text((rx + col_w - 60 - pw, ty+2), price, font=fnt_price, fill=TEXT)
        vw, _ = measure(d, var, fnt_var)
        d.text((rx + col_w - 60 - vw, ty+26), var, font=fnt_var, fill=color)
        # dashed sep
        draw_dashed_line(d, rx, ty+50, rx + col_w - 60, (255,255,255,15), 3, 5)
        ty += 60

    # INSIGHT overlay — centralizado embaixo do mockup, sobrepondo
    if insight_color_key:
        col = ACCENT[insight_color_key]
        ins_w = w - 80
        ins_h = 92
        ins_x = x + 40
        ins_y = y + h_total - 30

        ov = Image.new("RGBA", (ins_w+30, ins_h+30), (0,0,0,0))
        od = ImageDraw.Draw(ov)
        # sombra
        rounded_rect(od, (15, 18, ins_w+15, ins_h+18), radius=12, fill=(0,0,0,160))
        ov = ov.filter(ImageFilter.GaussianBlur(8))
        img.paste(ov, (ins_x-15, ins_y-15), ov)

        ov2 = Image.new("RGBA", (ins_w, ins_h), (0,0,0,0))
        od2 = ImageDraw.Draw(ov2)
        rounded_rect(od2, (0, 0, ins_w, ins_h), radius=12, fill=(26, 20, 29, 245),
                     outline=col["border"], width=1)
        # barra colorida na esquerda
        od2.rectangle((0, 14, 4, ins_h-14), fill=col["dot"])
        img.paste(ov2, (ins_x, ins_y), ov2)

        # tag
        fnt_tag = font("mono-bold", 12)
        d.text((ins_x+20, ins_y+14), insight_tag.upper(), font=fnt_tag, fill=col["text"], spacing=4)

        # text com formatação simples (negrito apenas em <b>)
        fnt_ins = font("serif", 24)
        fnt_ins_b = font("serif-bold", 24)
        ix = ins_x + 20
        iy = ins_y + 38
        max_iw = ins_w - 40
        draw_inline_serif(d, ix, iy, insight_html, fnt_ins, fnt_ins_b, TEXT, col["text"], max_iw)

    return h_total + 50  # +50 pra dar espaço pro insight

def draw_inline_serif(d, x, y, text_html, fnt_reg, fnt_bold, color_reg, color_bold, max_w):
    """Renderiza texto com <b>...</b> em bold/cor diferente."""
    # tokeniza em fragmentos (text, bold)
    import re
    parts = []
    for m in re.finditer(r'<b>(.*?)</b>|([^<]+)', text_html):
        if m.group(1) is not None:
            parts.append((m.group(1), True))
        else:
            parts.append((m.group(2), False))

    # quebra por palavras mantendo formatação
    words = []
    for t, b in parts:
        for w in t.split(" "):
            if w == "": continue
            words.append((w, b))

    line = []
    line_w = 0
    space_w, _ = measure(d, " ", fnt_reg)
    line_h = max(measure(d, "Ag", fnt_reg)[1], measure(d, "Ag", fnt_bold)[1])
    line_h = int(line_h * 1.05)
    cy = y

    def render_line(lst, cy):
        cx = x
        for i, (w, b) in enumerate(lst):
            fnt = fnt_bold if b else fnt_reg
            col = color_bold if b else color_reg
            d.text((cx, cy), w, font=fnt, fill=col)
            ww, _ = measure(d, w, fnt)
            cx += ww + (space_w if i < len(lst)-1 else 0)

    for w, b in words:
        fnt = fnt_bold if b else fnt_reg
        ww, _ = measure(d, w, fnt)
        prospective = line_w + (space_w if line else 0) + ww
        if prospective > max_w and line:
            render_line(line, cy)
            cy += line_h
            line = [(w, b)]
            line_w = ww
        else:
            line.append((w, b))
            line_w = prospective
    if line:
        render_line(line, cy)

def draw_headline(d, x, y, text_lines, max_w):
    """Headline serif com palavras marcadas <em> em dourado itálico."""
    import re
    fnt_reg = font("serif", 84)
    fnt_em = font("serif-italic", 84)
    line_h = 86

    for line_html in text_lines:
        # parse <em>...</em> markers
        segs = []
        for m in re.finditer(r'<em>(.*?)</em>|([^<]+)', line_html):
            if m.group(1) is not None:
                segs.append((m.group(1), True))
            else:
                segs.append((m.group(2), False))
        cx = x
        for text, em in segs:
            fnt = fnt_em if em else fnt_reg
            col = GOLD if em else TEXT
            d.text((cx, y), text, font=fnt, fill=col)
            tw, _ = measure(d, text, fnt)
            if em:
                # underline glow
                d.line((cx, y + line_h + 4, cx+tw, y + line_h + 4), fill=GOLD+(120,), width=2)
            cx += tw
        y += line_h

def draw_icon(d, x, y, size, kind):
    """Desenha um ícone simples em forma vetorial."""
    cx, cy = x + size//2, y + size//2
    if kind == "shield":
        # Escudo + check
        pts = [(cx, y+2), (x+size-3, y+6), (x+size-3, y+size//2+2),
               (cx, y+size-2), (x+3, y+size//2+2), (x+3, y+6)]
        d.polygon(pts, outline=GOLD_SOFT, width=2)
        # check
        d.line([(cx-5, cy), (cx-1, cy+4), (cx+6, cy-5)], fill=GOLD_SOFT, width=2)
    elif kind == "chart":
        # Linha ascendente com seta
        d.line([(x+4, y+size-6), (x+size//3, cy+2), (cx, cy-2), (x+size-4, y+5)], fill=GOLD_SOFT, width=2)
        # seta
        d.line([(x+size-9, y+5), (x+size-4, y+5)], fill=GOLD_SOFT, width=2)
        d.line([(x+size-4, y+5), (x+size-4, y+10)], fill=GOLD_SOFT, width=2)
    elif kind == "coin":
        # Moedas empilhadas (3 elipses)
        for dy, alpha in [(7, 1.0), (3, 1.0), (-1, 1.0)]:
            d.ellipse((x+3, cy+dy-3, x+size-3, cy+dy+3), outline=GOLD_SOFT, width=2)
    elif kind == "signal":
        # Wave de sinal
        d.line([(x+3, cy), (x+6, cy), (x+9, cy-7), (x+13, cy+7), (x+17, cy-3), (x+size-3, cy)], fill=GOLD_SOFT, width=2)
    elif kind == "brain":
        # Cabeça com cérebro (estilizado)
        d.ellipse((x+4, y+4, x+size-4, y+size-4), outline=GOLD_SOFT, width=2)
        d.line([(cx, y+8), (cx, y+size-8)], fill=GOLD_SOFT, width=1)
        d.line([(cx-5, cy-4), (cx+5, cy-4)], fill=GOLD_SOFT, width=1)
        d.line([(cx-5, cy+2), (cx+5, cy+2)], fill=GOLD_SOFT, width=1)
    elif kind == "check":
        # Círculo + check
        d.ellipse((x+3, y+3, x+size-3, y+size-3), outline=GOLD_SOFT, width=2)
        d.line([(cx-6, cy), (cx-2, cy+5), (cx+7, cy-5)], fill=GOLD_SOFT, width=2)
    else:
        # Default: diamante
        d.polygon([(cx, y+4), (x+size-4, cy), (cx, y+size-4), (x+4, cy)], outline=GOLD_SOFT, width=2)

def draw_feature_card(img, d, x, y, w, h, icon_kind, title, desc):
    """Cartão de feature com ícone, título e descrição."""
    ov = Image.new("RGBA", (w, h), (0,0,0,0))
    od = ImageDraw.Draw(ov)
    rounded_rect(od, (0, 0, w-1, h-1), radius=12, fill=(255,255,255,8), outline=(255,255,255,15), width=1)
    # acento dourado top
    od.line((0, 0, 24, 0), fill=GOLD)
    img.paste(ov, (x, y), ov)

    # icon box
    ico_size = 38
    ov_ico = Image.new("RGBA", (ico_size, ico_size), (0,0,0,0))
    od_ico = ImageDraw.Draw(ov_ico)
    rounded_rect(od_ico, (0, 0, ico_size-1, ico_size-1), radius=8,
                 fill=(201,168,76,40), outline=(201,168,76,70), width=1)
    img.paste(ov_ico, (x+18, y+18), ov_ico)
    # ícone desenhado em vetor
    draw_icon(d, x+18, y+18, ico_size, icon_kind)

    # title
    fnt_t = font("sans", 18)
    d.text((x+18, y+18+ico_size+12), title, font=fnt_t, fill=TEXT)
    # desc
    fnt_d = font("sans", 13)
    text_block(d, (x+18, y+18+ico_size+38), desc, fnt_d, TEXT_MUTE, max_width=w-36, line_spacing=1.3)

def draw_cta(img, d, x, y, w, text, sub):
    """Botão dourado com gradient + seta circular."""
    h = 96
    ov = Image.new("RGBA", (w, h), (0,0,0,0))
    od = ImageDraw.Draw(ov)
    # gradient (manualmente)
    for i in range(h):
        t = i / h
        r = int(214 - (214-164)*t)
        g = int(183 - (183-135)*t)
        b = int(102 - (102-50)*t)
        od.line((0, i, w, i), fill=(r,g,b,255))
    # mask rounded
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, w, h), radius=14, fill=255)
    # apply mask
    ov.putalpha(mask)

    # sombra
    shadow = Image.new("RGBA", (w+40, h+40), (0,0,0,0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((20, 20, w+20, h+20), radius=14, fill=(201,168,76,140))
    shadow = shadow.filter(ImageFilter.GaussianBlur(20))
    img.paste(shadow, (x-20, y-15), shadow)

    img.paste(ov, (x, y), ov)

    # texto serif
    fnt_t = font("serif-bold", 34)
    d.text((x+32, y+18), text, font=fnt_t, fill=(26,20,8))
    fnt_s = font("mono-bold", 13)
    d.text((x+32, y+58), sub.upper(), font=fnt_s, fill=(26,20,8,160), spacing=4)

    # arrow
    ax = x + w - 80
    ay = y + h//2 - 27
    d.ellipse((ax, ay, ax+54, ay+54), fill=(26,20,8))
    # arrow glyph
    cx, cy = ax+27, ay+27
    d.line((cx-10, cy, cx+10, cy), fill=GOLD_SOFT, width=3)
    d.line((cx+4, cy-7, cx+10, cy), fill=GOLD_SOFT, width=3)
    d.line((cx+4, cy+7, cx+10, cy), fill=GOLD_SOFT, width=3)

# ─── Variantes ──────────────────────────────────────────────────────────────
VARIANTS = [
    dict(
        slug="v1-curiosidade",
        pill_color="red",
        pill_text="LANÇAMENTO",
        kicker="DIAGNÓSTICO DE CARTEIRA POR IA",
        headline_lines=["Sua carteira", "tem <em>3 riscos</em>", "que você não vê."],
        sub="A IA do Cauril cruza seus ativos com cotações ao vivo e fundamentos reais da B3 e te mostra onde você está exposto — em 60 segundos.",
        insight_color="red",
        insight_tag="Alerta da IA · agora",
        insight_html="<b>29% da carteira</b> está em bancos. Sugestão: aporte em utilities ou FIIs.",
        feats=[
            ("shield", "Vê o risco escondido",     "Concentração por setor, HHI e ativos críticos."),
            ("chart",  "Plano de rebalanceamento", "A IA mostra exatamente onde aportar."),
            ("coin",   "Quanto vai pingar",        "Projeção real de renda passiva com sazonalidade B3."),
        ],
        cta_text="Quero analisar minha carteira",
        cta_sub="7 dias grátis · sem cartão · cauril.com.br",
    ),
    dict(
        slug="v2-prova",
        pill_color="gold",
        pill_text="BETA · 1.430 ATIVOS",
        kicker="ANÁLISE DE CARTEIRA COM IA",
        headline_lines=["Sua carteira", "vs. <em>CDI</em>:", "+6,2pp acima."],
        sub="Cotações ao vivo, fundamentos auditáveis e análise da IA em 60 segundos sobre seus ativos reais — não é planilha, não é achismo.",
        insight_color="green",
        insight_tag="Análise concluída · 11 ativos",
        insight_html="Carteira <b>sólida com viés de dividendos</b>. Diversificação acima da média.",
        feats=[
            ("signal", "Cotações ao vivo",  "B3 atualizada a cada 60 segundos."),
            ("brain",  "Fundamentos reais", "Cruzamento com dados oficiais CVM/bolsai."),
            ("check",  "Análise auditável", "Toda recomendação com os números que a geraram."),
        ],
        cta_text="Quero ver minha análise",
        cta_sub="7 dias grátis · sem cartão · cauril.com.br",
    ),
    dict(
        slug="v3-pergunta",
        pill_color="gold",
        pill_text="TESTE 7 DIAS GRÁTIS",
        kicker="PERGUNTA DO MÊS",
        headline_lines=["Quanto da", "sua carteira está", "em <em>1 só setor</em>?"],
        sub="A maioria dos investidores PF brasileiros tem 29% em bancos sem perceber. A IA do Cauril te mostra a sua composição real em 60s.",
        insight_color="gold",
        insight_tag="Insight da IA",
        insight_html="Média B3: <b>29% de concentração</b> num único setor. E a sua?",
        feats=[
            ("shield", "Vê sua concentração", "Por ativo, por setor, por tipo de investimento."),
            ("chart",  "Plano de aporte",     "Saiba onde colocar seu próximo aporte."),
            ("coin",   "Renda projetada",     "Quanto vai pingar em 1, 5, 10 anos."),
        ],
        cta_text="Descobrir agora",
        cta_sub="grátis · sem cartão · cauril.com.br",
    ),
    dict(
        slug="v4-valor",
        pill_color="green",
        pill_text="GRÁTIS · R$ 0",
        kicker="ANÁLISE DE CARTEIRA COM IA",
        headline_lines=["Análise que", "custaria <em>R$ 300</em>", "numa corretora."],
        sub="Aqui é em 60 segundos, com cotações ao vivo, IA real e zero custo no teste — sem cartão, sem pegadinha.",
        insight_color="blue",
        insight_tag="Hoje · 47 análises geradas",
        insight_html="IA processou <b>1.430 tickers da B3</b> em segundos. Sua vez.",
        feats=[
            ("brain",  "IA + dados reais",   "Gemini cruza seus ativos com fundamentos oficiais."),
            ("signal", "Resultado em 60s",   "Análise completa enquanto você toma um café."),
            ("check",  "Sem cartão, sem dor","Use 7 dias sem digitar cartão. Cancele com 1 clique."),
        ],
        cta_text="Quero minha análise grátis",
        cta_sub="cauril.com.br · 7 dias grátis · sem cartão",
    ),
]

def build_post(v):
    """Renderiza UMA variante e salva como PNG."""
    img = Image.new("RGB", (W, H), BG_BASE)
    img = img.convert("RGBA")
    draw_background(img)
    d = ImageDraw.Draw(img)

    # ── Header
    draw_brand(img, d, 64, 48)
    # Pill (top-right) — calcula posição
    pill_color = ACCENT[v["pill_color"]]
    pw, ph = measure(d, v["pill_text"], font("mono-bold", 18))
    pill_x = W - 64 - (pw + 22*2 + 10 + 14)
    draw_pill(img, d, (pill_x, 60), v["pill_text"], pill_color, font_size=18)

    # ── Kicker
    fnt_kick = font("mono", 18)
    d.line((64, 152, 110, 152), fill=GOLD, width=2)
    d.text((124, 144), v["kicker"], font=fnt_kick, fill=TEXT_MUTE, spacing=5)

    # ── Headline
    draw_headline(d, 64, 200, v["headline_lines"], max_w=W-128)

    # ── Sub
    fnt_sub = font("sans", 20)
    text_block(d, (64, 478), v["sub"], fnt_sub, TEXT_MUTE,
               max_width=W-128, line_spacing=1.4)

    # ── Mock + insight
    draw_mock(img, d, 64, 600, W-128,
              insight_color_key=v["insight_color"],
              insight_tag=v["insight_tag"],
              insight_html=v["insight_html"])

    # ── Features (3 cards)
    feat_y = 1040
    feat_gap = 14
    feat_w = (W - 128 - feat_gap*2) // 3
    feat_h = 140
    for i, (ico, title, desc) in enumerate(v["feats"]):
        fx = 64 + i*(feat_w + feat_gap)
        draw_feature_card(img, d, fx, feat_y, feat_w, feat_h, ico, title, desc)

    # ── CTA
    cta_y = 1198
    draw_cta(img, d, 64, cta_y, W-128, v["cta_text"], v["cta_sub"])

    # ── Footer disclaimer
    fnt_foot = font("mono", 11)
    foot_text = "FERRAMENTA EDUCACIONAL · NÃO É RECOMENDAÇÃO DE INVESTIMENTO"
    fw, _ = measure(d, foot_text, fnt_foot)
    d.text(((W-fw)//2, 1316), foot_text, font=fnt_foot, fill=TEXT_FAINT, spacing=4)

    # Save
    img = img.convert("RGB")
    out_path = OUT / f"post-{v['slug']}.png"
    img.save(out_path, "PNG", optimize=True)
    return out_path

if __name__ == "__main__":
    for v in VARIANTS:
        p = build_post(v)
        print(f"✓ {p.name} ({p.stat().st_size//1024} KB)")
