import cv2, numpy as np, sys
def landmask(path, sc=0.25, dark=115, ink=0.06):
    im=cv2.imread(path); s=cv2.resize(im,None,fx=sc,fy=sc,interpolation=cv2.INTER_AREA)
    hsv=cv2.cvtColor(s,cv2.COLOR_BGR2HSV); g=cv2.cvtColor(s,cv2.COLOR_BGR2GRAY)
    S=cv2.GaussianBlur(hsv[...,1],(0,0),3)
    t,_=cv2.threshold(S,0,255,cv2.THRESH_BINARY+cv2.THRESH_OTSU)
    m1=(S>t)
    d=(g<dark).astype(np.float32); dd=cv2.GaussianBlur(d,(0,0),5)
    m2=dd>ink
    m=((m1|m2)*255).astype(np.uint8)
    k=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(15,15))
    m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,k)
    ff=m.copy(); h,w=m.shape; mk=np.zeros((h+2,w+2),np.uint8); cv2.floodFill(ff,mk,(0,0),255); m=m|cv2.bitwise_not(ff)
    m=cv2.morphologyEx(m,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(9,9)))
    n,lab,st,_=cv2.connectedComponentsWithStats(m); keep=np.zeros_like(m)
    for i in range(1,n):
        if st[i,4]>600: keep[lab==i]=255
    return s,keep
if __name__=='__main__':
    s,k=landmask(sys.argv[1]); ov=s.copy()
    c,_=cv2.findContours(k,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE); cv2.drawContours(ov,c,-1,(0,255,0),2); cv2.imwrite(sys.argv[2],ov)
