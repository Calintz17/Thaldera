import json, sys, cv2, numpy as np
sys.path.insert(0,'tools'); import landmask
G='tools/'
T={}
for f in ['monde','thaldera','roshen-buru','keras-tauroc']:
    d=json.load(open(f'data/{f}.json')); d=d if isinstance(d,list) else d['fiches']
    for e in d: T[e['id']]=e
def fill(m):
    h,w=m.shape; ff=m.copy(); mk=np.zeros((h+2,w+2),np.uint8); cv2.floodFill(ff,mk,(0,0),255); return m|cv2.bitwise_not(ff)
def land_istra():
    s,k=landmask.landmask('img/cartes/istra.webp',dark=85,ink=0.07); return s,k
def land_thal():
    im=cv2.imread('img/cartes/thaldera.webp'); s=cv2.resize(im,None,fx=.25,fy=.25,interpolation=cv2.INTER_AREA)
    g=cv2.cvtColor(s,cv2.COLOR_BGR2GRAY); gb=cv2.GaussianBlur(g,(0,0),4); h,w=g.shape
    m=(gb<144).astype(np.uint8)*255
    for sl in (np.s_[:int(h*.03)],np.s_[-int(h*.03):]): m[sl]=0
    m[:,:int(w*.03)]=0; m[:,-int(w*.03):]=0
    m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(11,11))); m=fill(m)
    m=cv2.morphologyEx(m,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7))); return s,m
JOBS=[('istra',land_istra,['balamor','there-duun','region-roshen-buru','maison-tauroc'],{'there-duun':45}),
      ('thaldera',land_thal,['altera','dominion-sol','consortium','repos-des-epees'],{})]
out={}
D=10
for name,fn,ids,close in JOBS:
    s,L=fn(); h,w=L.shape
    sc=[]
    for i in ids:
        e=T[i]; R=np.zeros((h,w),np.uint8)
        cv2.fillPoly(R,[np.array([[x*w,y*h] for x,y in e['poly']],np.int32)],255)
        R=fill(R)
        Lm=L
        if i in close:
            k=close[i]; Lm=cv2.morphologyEx(L,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(k,k)))
        S=fill(cv2.bitwise_and(R,Lm))
        din=cv2.distanceTransform(S,cv2.DIST_L2,5); dout=cv2.distanceTransform(cv2.bitwise_not(S),cv2.DIST_L2,5)
        sc.append(np.where(S>0,din+1,-dout)); 
    sc=np.stack(sc); best=sc.argmax(0); mx=sc.max(0)
    Lall=L.copy()
    for k,i in enumerate(ids):
        if i in close:
            kk=close[i]; Lall=cv2.bitwise_or(Lall,cv2.morphologyEx(L,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(kk,kk))))
    for k,i in enumerate(ids):
        X=(((best==k)&(mx>-D)&(Lall>0))*255).astype(np.uint8)
        X=fill(X); X=cv2.morphologyEx(X,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5))); X=cv2.medianBlur(X,5)
        cs,_=cv2.findContours(X,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
        cs=sorted(cs,key=cv2.contourArea,reverse=True)
        rings=[]
        for j,c in enumerate(cs):
            if cv2.contourArea(c)<(150 if j else 1): continue
            a_=cv2.approxPolyDP(c,1.2,True)[:,0,:]
            if len(a_)<4: continue
            rings.append([[round(x/w,4),round(y/h,4)] for x,y in a_])
        out[i]={'poly':rings[0],'polyx':rings[1:]}
        print(i,len(T[i]['poly']),'->',len(rings[0]),'+',len(rings)-1,'iles')
json.dump(out,open(G+'snapped.json','w'))
# overlay
for name,fn,ids,_ in JOBS:
    s,L=fn(); h,w=L.shape; ov=cv2.resize(cv2.imread(f'img/cartes/{name}.webp'),(w,h))
    for i in ids:
        for r in [out[i]['poly']]+out[i]['polyx']:
            cv2.polylines(ov,[np.array([[x*w,y*h] for x,y in r],np.int32)],True,(0,0,255),2)
    cv2.imwrite(f'/tmp/snap_{name}.png',ov)
