"""Generate one discount-code page per brand from pilates.html's template.
Run from the repo root: python3 tools/codepages.py"""
import base64, html, json, re

B = [
 # slug, brand, pct, code, link, about, [try first], group, extra note, end
 ("solawave","Solawave",25,"PHYSICIANMOM","https://go.shopmy.us/p-108475179",
  "Solawave makes at-home LED skincare devices, including its red light wand and light therapy masks, plus serums and creams made to pair with them.",
  ["Radiant Renewal Skincare Wand","Wrinkle Retreat Pro LED Face Mask","LightBoost Collagen and Caffeine Eye Cream"],"beauty","",None),
 ("mutha","Mutha",15,"PHYSICIANMOM15","https://go.shopmy.us/p-108475400",
  "Mutha makes body care: rich body butters, body oils, body bars and lip care.",
  ["Mutha Body Butter","Mutha Body Oil (the discovery size is an easy way to start)","Pucker Up Lip Plump"],"beauty","",None),
 ("meaningful-beauty","Meaningful Beauty",15,"PHYSICIANMOM15","https://go.shopmy.us/p-105448276",
  "Meaningful Beauty is the skincare line co-founded by Cindy Crawford.",
  ["Ultra Lifting and Filling Treatment (the one from my reel)","Youth Activating Eye Serum"],"beauty","",None),
 ("naturium","Naturium",10,"PHYSICIANMOM10","https://go.shopmy.us/p-100312775",
  "Naturium makes skin and body care. The Glow Getter Multi-Oil Body Butter is the jar pictured here.",
  ["Glow Getter Multi-Oil Body Butter"],"beauty","",None),
 ("vetted-dermlab","Vetted Dermlab",15,"LAURENSFINDS15","https://go.shopmy.us/p-108475976",
  "Vetted Dermlab keeps skincare short: a cleanser, a moisturizer, a retinoid and a few others, sold alone or as simple routines.",
  ["Barrier Restore Routine","Core Protocol","Soak and Soothe System"],"beauty","",None),
 ("sleep-and-glow","Sleep &amp; Glow",15,"LAURENSFINDS15","https://go.shopmy.us/p-108475893",
  "Sleep &amp; Glow makes a beauty pillow designed for back sleeping.",
  ["The Sleep &amp; Glow Beauty Pillow"],"beauty","",None),
 ("sterling-forever","Sterling Forever",15,"LAURENSFINDS15","https://go.shopmy.us/p-108475726",
  "Sterling Forever makes everyday jewelry: tennis necklaces, studs, stacking rings and chain bracelets.",
  ["Cecil CZ Tennis Necklace","Pave Crescent Stacking Ring","Amari Oval Link Chain Bracelet"],"style","",None),
 ("alhena","Alhena",10,"lauren10","https://go.shopmy.us/p-108476556",
  "Alhena makes gold necklaces, cuffs and earrings, including coin pendants made for layering.",
  ["The Coin Collector","Athena Necklace","Vienna Cuff"],"style","",None),
 ("la-ligne","La Ligne",10,"LAUREN10","https://go.shopmy.us/p-108476672",
  "La Ligne is a New York label known for its striped knits and polished wardrobe staples.",
  [],"style","",None),
 ("cosabella","Cosabella",10,"LAURENSFINDS10","https://go.shopmy.us/p-108476236",
  "Cosabella is an Italian lingerie brand known for its Never Say Never lace thongs, bralettes and bodysuits.",
  ["Never Say Never Cutie Low Rise Thong 3-Pack","Never Say Never Plungie Longline Bralette","Never Say Never Balconette Bodysuit"],"style","",None),
 ("railey","Railey",10,"PHYSICIANMOM10","https://go.shopmy.us/p-108476913",
  "Railey makes relaxed basics: hoodies, sweatpants, tees, beanies, trucker hats and organic cotton totes.",
  ["Athletic Hoodie","Organic Cotton Tote","Trucker Hat"],"style","",None),
 ("geometry","Geometry",15,"PHYSICIANMOM","https://go.shopmy.us/p-108475609",
  "Geometry makes quick-drying kitchen towels, bath towels and waffle hand towels in seasonal prints. The holiday prints make easy hostess gifts.",
  ["Plaid About You kitchen towel","Figgy Pudding kitchen towel","Cozy Club kitchen towel"],"home","",None),
 ("literie","Literie",10,"LAURENF10","https://go.shopmy.us/p-106125745",
  "Literie makes candles named for places and moments, like The Christmas Tree Guy and Afternoon in Central Park.",
  ["The Christmas Tree Guy","Afternoon in Central Park","Island Hopping in Greece"],"home",
  "Through Nov 30, Literie is 20% off sitewide with no code needed. My code takes 10% off at other times.",None),
 ("truffle","Truffle",15,"PHYSICIANMOM15","https://go.shopmy.us/p-101600952",
  "Truffle makes travel cases, including the clear Clarity Jetset Case for toiletries and makeup.",
  ["Clarity Jetset Case"],"home","This code runs through Dec 31.","2026-12-31"),
 ("camp-snap","Camp Snap",7,"LAURENFINE7","https://go.shopmy.us/p-108477039",
  "Camp Snap makes screen-free digital cameras. You take the photo now and see it later, like a disposable camera you can reuse.",
  ["CS-8 Micro camera","Camera and carry case bundle","Adventure Wrist Strap"],"home","",None),
]
IMG = {"vetted-dermlab":"vetted","sleep-and-glow":"sleep-glow"}
GROUP = {"beauty":"beauty and skincare","style":"jewelry and style","home":"home and gifts"}

def plain(s): return html.unescape(s)

def page(t, row):
    slug,brand,pct,code,link,about,tries,group,note,end = row
    img = IMG.get(slug, slug)
    url = f"https://laurenfine.com/{slug}-discount-code"
    title = f"{plain(brand)} Discount Code: {pct}% Off | Lauren Fine, MD"
    desc = f"{plain(brand)} shared a {pct}% off code with Lauren Fine, MD for her readers. Tap to get it, plus what to try first and every other code she has."
    head = f'''<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="{url}">

<meta property="og:type" content="website">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{pct}% Off {brand}">
<meta property="og:description" content="{brand} shared a {pct}% off code with me. Tap to get it.">
<meta property="og:site_name" content="Lauren Fine, MD">
<meta property="og:image" content="https://laurenfine.com/img/deals/{img}.jpg">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{pct}% Off {brand}">
<meta name="twitter:description" content="{brand} shared a {pct}% off code with me. Tap to get it.">
'''
    faq = [(f"Is there a {plain(brand)} discount code?",
            f"Yes. {plain(brand)} shared a {pct}% off code with Lauren Fine, MD for her readers. Tap Get my code on this page to see it and copy it."),
           (f"How do I use the {plain(brand)} code?",
            f"Tap Get my code. The code is copied for you and {plain(brand)} opens. Add what you want to your cart and paste the code at checkout.")]
    ld = {"@context":"https://schema.org","@graph":[
        {"@type":"BreadcrumbList","itemListElement":[
            {"@type":"ListItem","position":1,"name":"Home","item":"https://laurenfine.com/"},
            {"@type":"ListItem","position":2,"name":"Deals and codes","item":"https://laurenfine.com/deals"},
            {"@type":"ListItem","position":3,"name":f"{plain(brand)} discount code","item":url}]},
        {"@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in faq]}]}
    head += f'<script type="application/ld+json">{json.dumps(ld)}</script>\n'
    t = re.sub(r'<title>.*?(?=<link rel="preconnect")', lambda m: head + "\n", t, count=1, flags=re.S)

    tries_html = ""
    if tries:
        lis = "".join(f'<li><a href="{link}" target="_blank" rel="noopener sponsored">{x}</a></li>' for x in tries)
        tries_html = f'<h2>What to try first</h2><ul class="cp-try">{lis}</ul>'
    note_html = f'<p class="cp-note">{note}</p>' if note else ""
    rel = [r for r in B if r[7] == group and r[0] != slug][:3]
    rel_html = "".join(f'<a class="cp-rel" href="/{r[0]}-discount-code"><img src="/img/deals/{IMG.get(r[0], r[0])}.jpg" alt="" width="800" height="1000" loading="lazy"><span>{r[1]}</span><em>{r[2]}% off</em></a>' for r in rel)
    faq_html = "".join(f'<details class="cp-faq"><summary>{html.escape(q)}</summary><p>{html.escape(a)}</p></details>' for q,a in faq)
    main = f'''<main class="shop pilates codepage">
<div class="cp-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/deals">Deals and codes</a> / {brand}</div>
<header class="code-hero">
  <p class="shop-eyebrow">{brand} discount code</p>
  <h1>{pct}% off <em>{brand}</em></h1>
  <p class="lede">{brand} shared a {pct}% off code with me for my readers. I am sharing it with you.</p>
</header>

<div class="cp-top">
  <img class="cp-photo" src="/img/deals/{img}.jpg" alt="{brand} product photo" width="800" height="1000">
  <div class="code-card" id="code-card">
    <div class="code-gate">
      <button type="button" class="code-btn" id="get-code">Get my {pct}% code</button>
      <p class="code-small">Your code appears here and is copied for you. Then we open {brand} so you can use it at checkout.</p>
    </div>
    <div class="code-reveal" aria-live="polite">
      <p class="code-label">Your code</p>
      <div class="code-box"><span class="code-value" id="code-value"></span><button type="button" class="code-copy" id="copy-code">Copy</button></div>
      <p class="code-status" id="code-status">Copied. Opening {brand} now. Paste the code at checkout.</p>
      <a class="shop-btn code-shop" id="shop-link" href="{link}" rel="noopener sponsored" target="_blank">Shop {brand}</a>
    </div>
    {note_html}
  </div>
</div>

<section class="cp-body">
  <h2>About {brand}</h2>
  <p>{about}</p>
  {tries_html}
  <h2>How the code works</h2>
  <ol class="cp-steps"><li>Tap <strong>Get my {pct}% code</strong>. It copies for you.</li><li>Shop on {brand}.</li><li>Paste the code at checkout for {pct}% off.</li></ol>
  <p class="cp-small">If a code ever stops working, email me at <a href="mailto:reasondxcoaching@gmail.com">reasondxcoaching@gmail.com</a> and I will update this page.</p>
  <h2>Questions</h2>
  {faq_html}
</section>

<section class="deals" aria-label="More codes">
  <p class="shop-step">More {GROUP[group]} codes</p>
  <div class="cp-rels">{rel_html}</div>
  <p style="margin-top:30px;text-align:center"><a class="shop-btn" href="/deals">See every code and this week&rsquo;s best sales</a></p>
</section>

<section class="code-invite" aria-label="Get new codes by email">
  <p class="shop-step">The Sunday Letter</p>
  <h2>New codes, <em>every Sunday</em></h2>
  <p>Brands share new codes with me all the time. I send the best ones in my Sunday email, along with one idea to make your week lighter.</p>
  <a class="shop-btn" href="/deals#get-codes">Get the codes by email</a>
</section>

<p class="shop-disclosure">This page contains affiliate links. If you buy through it, I may earn a small commission at no extra cost to you.</p>
</main>'''
    t = re.sub(r'<main class="shop pilates">.*?</main>', lambda m: main, t, count=1, flags=re.S)
    t = t.replace("atob('UEhZU0lDSUFOTU9NMjU=')", f"atob('{base64.b64encode(code.encode()).decode()}')")
    t = t.replace("var SHOP = 'https://go.shopmy.us/p-101325380';", f"var SHOP = '{link}';")
    t = t.replace("'lf_pilates_code'", f"'lf_{slug}_code'")
    t = t.replace("Paste the code at checkout on Pilates University.", f"Paste the code at checkout on {plain(brand)}.")
    t = t.replace("Opening Pilates University now. Enter the code at checkout.", f"Opening {plain(brand)} now. Enter the code at checkout.")
    t = t.replace("source:'pilates-page'", f"source:'{slug}-code-page'")
    if end:
        t = t.replace("<body>", f'<body data-end="{end}">', 1)
    css = '''.cp-crumbs{max-width:1120px;margin:0 auto;padding:118px 32px 0;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--gray)}
.cp-crumbs a{color:var(--gray);text-decoration:none;border-bottom:1px solid var(--cream-dark)}
.codepage .code-hero{padding-top:28px}
.cp-top{max-width:960px;margin:40px auto 0;padding:0 32px;display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center}
.cp-photo{width:100%;height:auto;display:block;aspect-ratio:4/5;object-fit:cover}
.cp-top .code-card{margin:0}
.cp-note{font-size:.86rem;line-height:1.7;color:#5A544E;margin-top:22px}
.cp-body{max-width:720px;margin:80px auto 0;padding:0 32px}
.cp-body h2{font-family:'Playfair Display',serif;font-weight:400;font-size:1.6rem;color:var(--black);margin:44px 0 14px}
.cp-body p,.cp-body li{font-size:1rem;line-height:1.85;color:#4A4540}
.cp-try{list-style:none;padding:0;border-top:1px solid var(--cream-dark)}
.cp-try li{border-bottom:1px solid var(--cream-dark);padding:14px 0}
.cp-try a{color:var(--black);text-decoration:none;border-bottom:1px solid var(--gold)}
.cp-steps{padding-left:22px}
.cp-small{font-size:.88rem !important;color:var(--gray) !important;margin-top:14px}
.cp-small a{color:var(--terracotta)}
.cp-faq{border-bottom:1px solid var(--cream-dark);padding:16px 0}
.cp-faq summary{cursor:pointer;font-weight:500;color:var(--black)}
.cp-faq p{margin-top:10px}
.cp-rels{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:22px}
.cp-rel{text-decoration:none;color:var(--black);background:#F4F1EC;display:block}
.cp-rel img{width:100%;height:auto;aspect-ratio:4/5;object-fit:cover;display:block}
.cp-rel span{display:block;font-family:'Playfair Display',serif;font-size:1.1rem;padding:14px 16px 2px}
.codepage .deals .shop-btn{display:inline-block;max-width:100%;white-space:normal;line-height:1.5;text-align:center}
.cp-rel em{display:block;font-style:normal;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);padding:0 16px 16px}
@media (max-width:720px){.cp-crumbs{padding:104px 20px 0}.cp-top{grid-template-columns:1fr;gap:24px;padding:0 16px}.cp-photo{max-width:300px;margin:0 auto}.cp-top .code-card{order:-1}.cp-body{padding:0 20px;margin-top:56px}.cp-rels{grid-template-columns:repeat(3,1fr);gap:10px}.cp-rel span{font-size:.9rem;padding:10px 8px 0}.codepage .deals .shop-btn{display:inline-block;max-width:100%;white-space:normal;line-height:1.5;text-align:center}
.cp-rel em{padding:0 8px 10px;font-size:.6rem}}
'''
    t = t.replace("</style>", css + "</style>", 1)
    if end:
        t = t.replace("</body>", f"<script>(function(){{var e='{end}'.replace(/-/g,'');var d=new Date();var t=d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();if(t>+e){{var c=document.getElementById('code-card');if(c)c.innerHTML='<p class=\"code-small\">This code has ended. <a href=\"/deals\">See the codes running now</a>.</p>';}}}})();</script>\n</body>", 1)
    return t

tpl = open("pilates.html").read()
for row in B:
    open(f"{row[0]}-discount-code.html", "w").write(page(tpl, row))
print(len(B), "pages")
