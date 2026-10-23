from PIL import Image, ImageDraw, ImageFont
import math
S=1024
GEO='/System/Library/Fonts/Supplemental/Georgia Bold.ttf'
DIDOT='/System/Library/Fonts/Didot.ttc'
MONO='/System/Library/Fonts/Menlo.ttc'
MIN='/System/Library/Fonts/ヒラギノ明朝 ProN.ttc'
NAVY=(19,52,82); NAVY2=(12,34,56); INK=(21,33,42); WHITE=(255,255,255)
OK=(46,140,92); MID=(70,120,175); NG=(196,72,52); NA=(214,160,50); NEW=(214,222,226)
def grad(a,b):
    im=Image.new('RGB',(S,S)); d=ImageDraw.Draw(im)
    for y in range(S):
        t=y/(S-1); d.line([(0,y),(S,y)],fill=tuple(round(x+(z-x)*t) for x,z in zip(a,b)))
    return im
def F(p,s,i=0): return ImageFont.truetype(p,s,index=i)

# A ストップウォッチ：白い時計の輪と残り時間の弧、中にセリフの「A」
def A():
    im=grad((24,66,104),NAVY2); d=ImageDraw.Draw(im)
    cx,cy,R=512,560,330
    d.rounded_rectangle([462,150,562,215],18,fill=WHITE)            # 竜頭
    d.ellipse([cx-R,cy-R,cx+R,cy+R],outline=(255,255,255,60),width=1)
    d.ellipse([cx-R,cy-R,cx+R,cy+R],fill=(255,255,255))
    d.ellipse([cx-R+44,cy-R+44,cx+R-44,cy+R-44],fill=(236,242,246))
    d.arc([cx-R+22,cy-R+22,cx+R-22,cy+R-22],-90,200,fill=(46,140,92),width=30)
    d.text((cx,cy+10),'A',font=F(GEO,330),fill=INK,anchor='mm')
    return im

# B 語彙マップ：5×5の色マス（定着・習得中・要再習得…）、中央に白いカード「Aa」
def B():
    im=Image.new('RGB',(S,S),(16,40,62)); d=ImageDraw.Draw(im)
    pal=[OK,OK,MID,OK,MID, OK,MID,OK,NG,OK, MID,OK,None,OK,NA, OK,OK,MID,OK,MID, NA,OK,OK,MID,OK]
    n=5; m=110; g=18; c=(S-2*m-(n-1)*g)/n
    for i,col in enumerate(pal):
        x=m+(i%n)*(c+g); y=m+(i//n)*(c+g)
        if col: d.rounded_rectangle([x,y,x+c,y+c],22,fill=col)
    x=m+1*(c+g); y=m+1*(c+g); w=3*c+2*g
    d.rounded_rectangle([x-6,y-6,x+w+6,y+w+6],40,fill=(16,40,62))
    d.rounded_rectangle([x+8,y+8,x+w-8,y+w-8],36,fill=WHITE)
    d.text((x+w/2,y+w/2+8),'Aa',font=F(GEO,230),fill=INK,anchor='mm')
    return im

# C フラッシュ：紺の地に稲妻と、セリフ体の小文字「a」
def C():
    im=grad((28,77,112),NAVY2); d=ImageDraw.Draw(im)
    d.text((430,540),'a',font=F(GEO,640),fill=WHITE,anchor='mm')
    bolt=[(700,150),(560,520),(660,520),(560,880),(820,430),(712,430),(800,150)]
    d.polygon(bolt,fill=(242,196,72))
    return im

# D 和の明朝：白地に紺の「英」、周りに1分の弧（残り時間）
def D():
    im=Image.new('RGB',(S,S),(247,248,246)); d=ImageDraw.Draw(im)
    cx,cy,R=512,512,370
    d.ellipse([cx-R,cy-R,cx+R,cy+R],outline=(220,226,229),width=34)
    d.arc([cx-R,cy-R,cx+R,cy+R],-90,180,fill=(28,77,112),width=34)
    d.text((cx,cy+14),'英',font=F(MIN,420,1),fill=(20,40,60),anchor='mm')
    return im

# E 数字の札：紺の地に等幅の大きな「30」と「1 MIN」、下に◯✖のマーク
def E():
    im=Image.new('RGB',(S,S),(14,36,58)); d=ImageDraw.Draw(im)
    d.text((512,430),'30',font=F(MONO,420,1),fill=WHITE,anchor='mm')
    d.text((512,690),'WORDS · 1 MIN',font=F(MONO,64,1),fill=(141,184,220),anchor='mm')
    for i,(ch,col) in enumerate([('◯',OK),('◯',OK),('✖',NG),('◯',OK),('◯',OK)]):
        x=292+i*110
        d.rounded_rectangle([x-44,780,x+44,868],18,fill=col)
    return im

drafts=[('A',A()),('B',B()),('C',C()),('D',D()),('E',E())]
for k,im in drafts: im.save(f'icon_{k}.png')
cur=Image.open('/Users/icurate/Desktop/Claude code ビジネス/英単語フラッシュアプリ/eitango-flash/assets/icon.png').convert('RGB')
items=[('現行',cur)]+drafts
t=300; pad=40; W=len(items)*(t+pad)+pad
sheet=Image.new('RGB',(W,t+150),(240,242,241)); sd=ImageDraw.Draw(sheet)
mask=Image.new('L',(t,t),0); ImageDraw.Draw(mask).rounded_rectangle([0,0,t-1,t-1],int(t*0.225),fill=255)
lab=F('/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc',34) if __import__('os').path.exists('/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc') else F(MIN,34,1)
for i,(k,im) in enumerate(items):
    x=pad+i*(t+pad); sheet.paste(im.resize((t,t),Image.LANCZOS),(x,40),mask)
    sd.text((x+t/2,t+90),k,font=lab,fill=(30,40,50),anchor='mm')
sheet.save('sheet.png')
# 小さいサイズ（ホーム画面の実寸感）
sm=Image.new('RGB',(len(items)*80+20,100),(240,242,241))
m2=Image.new('L',(60,60),0); ImageDraw.Draw(m2).rounded_rectangle([0,0,59,59],13,fill=255)
for i,(k,im) in enumerate(items): sm.paste(im.resize((60,60),Image.LANCZOS),(20+i*80,20),m2)
sm.save('small.png')
print('ok')
