import cv2,numpy as np
def land(path,sc=0.5,sthr=88,dark=95,ink=0.10,hole_min=0.0004):
    im=cv2.imread(path); s=cv2.resize(im,None,fx=sc,fy=sc,interpolation=cv2.INTER_AREA)
    hsv=cv2.cvtColor(s,cv2.COLOR_BGR2HSV); g=cv2.cvtColor(s,cv2.COLOR_BGR2GRAY)
    S=cv2.GaussianBlur(hsv[...,1],(0,0),5*sc/0.5)
    m1=S>sthr
    d=(g<dark).astype(np.float32); dd=cv2.GaussianBlur(d,(0,0),7*sc/0.5); m2=dd>ink
    m=((m1|m2)*255).astype(np.uint8)
    k=lambda n:cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(n,n))
    m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,k(9)); m=cv2.morphologyEx(m,cv2.MORPH_OPEN,k(9))
    h,w=m.shape
    # remplir seulement les petits trous (ile interieure, blanc des montagnes), garder les mers interieures
    inv=cv2.bitwise_not(m); n,lab,st,_=cv2.connectedComponentsWithStats(inv)
    out=m.copy()
    for i in range(1,n):
        x,y,ww,hh,a=st[i]
        touches = x==0 or y==0 or x+ww==w or y+hh==h
        if not touches and a< hole_min*h*w: out[lab==i]=255
    n,lab,st,_=cv2.connectedComponentsWithStats(out)
    keep=np.zeros_like(out)
    for i in range(1,n):
        if st[i,4]>400*(sc/0.5)**2: keep[lab==i]=255
    return s,keep
if __name__=='__main__':
    import sys
    s,k=land(sys.argv[1]); ov=s.copy()
    c,_=cv2.findContours(k,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_NONE); cv2.drawContours(ov,c,-1,(0,255,0),2); cv2.imwrite(sys.argv[2],ov); print(ov.shape)
