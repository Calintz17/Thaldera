import json,cv2,numpy as np,sys
sys.path.insert(0,'tools/regions')
sys.path.insert(0,'tools')
import seg
SP=seg.SP
b=json.load(open(seg.G+'polys.json'))
seeds={'altera':b['altera']['poly'],'dominion-sol':b['dominion-sol']['poly'],'consortium':b['havre-noir']['poly'],'repos-des-epees':b['repos-des-epees']['poly']}
ids=['altera','dominion-sol','consortium','repos-des-epees']
m=0.035
s,L,res=seg.segment('img/cartes/thaldera.webp',seeds,ids,excl=[(0,0,1,.025),(0,.985,1,1),(0,0,m,1),(1-m,0,1,1),(.24,.90,.52,.995),(.03,.82,.19,.99),(.42,.86,.62,.9),(.80,.93,1,1)],maxd={'altera':60,'dominion-sol':60,'consortium':170,'repos-des-epees':170})
json.dump(res,open(SP+'thal_new.json','w'))
col={'altera':(255,150,40),'dominion-sol':(40,60,230),'consortium':(30,180,240),'repos-des-epees':(60,200,60)}
ov=s.copy(); h,w=L.shape
for i in ids:
    cv2.polylines(ov,[np.array([[x*w,y*h] for x,y in seeds[i]],np.int32)],True,(200,200,200),1)
    for r in [res[i]['poly']]+res[i]['polyx']:
        cv2.polylines(ov,[np.array([[x*w,y*h] for x,y in r],np.int32)],True,col[i],3)
cv2.imwrite(SP+'thal_new.png',ov)
print({i:(len(res[i]['poly']),len(res[i]['polyx'])) for i in ids})
