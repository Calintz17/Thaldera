# Audit des paysages: ouvre chaque fiche dans Chromium et releve les images de paysage affichees.
# Usage: python3 tools/audit_paysages.py <racine> <port> <sortie.json>  (serveur http sur <port>)
import json,sys
from playwright.sync_api import sync_playwright
root,port,out=sys.argv[1:4]
D={}
for f in ['monde','thaldera','roshen-buru','keras-tauroc']:
    try:
        for e in json.load(open(f'{root}/data/{f}.json')): D[e['id']]=e
    except Exception as x: print(f,x)
ids=[i for i,e in D.items() if e['type'] in('pnj','pj','lieu','sujet','organisation','clan','evenement','ville')]
res={}
with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page(viewport={'width':1300,'height':850})
    pg.goto(f'http://localhost:{port}/index.html');pg.wait_for_timeout(1500)
    for i in ids:
        pg.evaluate("location.hash='#/'");pg.wait_for_timeout(80)
        pg.evaluate(f"location.hash='#/{i}'");pg.wait_for_timeout(450)
        res[i]=pg.evaluate("()=>[...document.querySelectorAll('.landscape-frame img')].map(i=>i.getAttribute('src'))")
    b.close()
json.dump(res,open(out,'w'))
print('done',len(res))
