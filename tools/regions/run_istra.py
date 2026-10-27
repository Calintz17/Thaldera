import json,cv2,numpy as np,sys
sys.path.insert(0,'tools/regions')
import seg
SP=seg.SP
a=json.load(open(seg.G+'istra_poly2.json')); seeds={k:v[0] for k,v in a.items()}
ids=['balamor','there-duun','region-roshen-buru','maison-tauroc']
s,L,res=seg.segment('img/cartes/istra.webp',seeds,ids,fillpts=[(.27,.575),(.3,.585),(.26,.60),(.545,.405)],excl=[(.30,.02,.78,.14),(.0,.80,.19,1.0),(.03,.53,.07,.60),(.08,.39,.16,.48),(.93,.74,.975,.80),(.9,.93,1,1)])
json.dump(res,open(SP+'istra_new.json','w'))
col={'balamor':(220,60,200),'there-duun':(255,140,40),'region-roshen-buru':(200,60,255),'maison-tauroc':(40,40,255)}
ov=s.copy(); h,w=L.shape
for i in ids:
    for r in [res[i]['poly']]+res[i]['polyx']:
        cv2.polylines(ov,[np.array([[x*w,y*h] for x,y in r],np.int32)],True,col[i],3)
cv2.imwrite(SP+'istra_new.png',ov)
print({i:(len(res[i]['poly']),len(res[i]['polyx'])) for i in ids})
