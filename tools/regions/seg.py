import cv2,numpy as np,json,sys
sys.path.insert(0,'tools/regions')
import mask2
SP='tools/regions/out/'
G='tools/regions/seeds/'
def fillh(m):
    h,w=m.shape; ff=m.copy(); mk=np.zeros((h+2,w+2),np.uint8); cv2.floodFill(ff,mk,(0,0),255); return m|cv2.bitwise_not(ff)
def segment(path, seeds, ids, fillpts=(), maxd=140, excl=()):
    s,L=mask2.land(path); h,w=L.shape
    L=L.copy()
    for (x,y) in fillpts: # remplissage manuel de trous (neige)
        inv=cv2.bitwise_not(L); n,lab=cv2.connectedComponents(inv)
        l=lab[int(y*h),int(x*w)]
        if l>0: L[lab==l]=255
    for (x0,y0,x1,y1) in excl: L[int(y0*h):int(y1*h),int(x0*w):int(x1*w)]=0
    sc=[]
    for i in ids:
        R=np.zeros((h,w),np.uint8); cv2.fillPoly(R,[np.array([[x*w,y*h] for x,y in seeds[i]],np.int32)],255)
        din=cv2.distanceTransform(R,cv2.DIST_L2,5); dout=cv2.distanceTransform(cv2.bitwise_not(R),cv2.DIST_L2,5)
        sc.append(np.where(R>0,din+1,-dout))
    sc=np.stack(sc); best=sc.argmax(0); mx=sc.max(0)
    res={}
    for k,i in enumerate(ids):
        md=maxd[i] if isinstance(maxd,dict) else maxd
        X=(((best==k)&(mx>-md)&(L>0))*255).astype(np.uint8)
        # garder composantes assez grandes ; nettoyer
        X=cv2.morphologyEx(X,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)))
        cs,hier=cv2.findContours(X,cv2.RETR_EXTERNAL,cv2.CHAN_APPROX_NONE if hasattr(cv2,'CHAN_APPROX_NONE') else cv2.CHAIN_APPROX_NONE)
        cs=sorted(cs,key=cv2.contourArea,reverse=True)
        rings=[]
        for j,c in enumerate(cs):
            if cv2.contourArea(c)<(350 if j else 1): continue
            a=cv2.approxPolyDP(c,1.3,True)[:,0,:]
            if len(a)<4: continue
            rings.append([[round(x/w,4),round(y/h,4)] for x,y in a])
        res[i]={'poly':rings[0],'polyx':rings[1:]}
    return s,L,res
