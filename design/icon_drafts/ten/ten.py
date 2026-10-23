# アイコン案10種：どれも「英単語」とわかる文字と、フラッシュ（稲妻・閃光・残像）の図柄を入れる
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, os
S=1024
FD='/System/Library/Fonts/'
GEO='/System/Library/Fonts/Supplemental/Georgia Bold.ttf'
GEOI='/System/Library/Fonts/Supplemental/Georgia Bold Italic.ttf'
MONO=FD+'Menlo.ttc'
MIN=FD+'ヒラギノ明朝 ProN.ttc'
G8=FD+'ヒラギノ角ゴシック W8.ttc'; G6=FD+'ヒラギノ角ゴシック W6.ttc'
NAVY=(17,48,78); NAVY2=(10,28,48); INK=(18,30,40); WHITE=(255,255,255)
YEL=(247,198,46); YEL2=(255,226,120); OK=(46,140,92); NG=(196,72,52); MID=(70,120,175)
def F(p,s,i=0): return ImageFont.truetype(p,s,index=i)
def grad(a,b,horiz=False):
    im=Image.new('RGB',(S,S)); d=ImageDraw.Draw(im)
    for k in range(S):
        t=k/(S-1); c=tuple(round(x+(z-x)*t) for x,z in zip(a,b))
        d.line([(k,0),(k,S)] if horiz else [(0,k),(S,k)],fill=c)
    return im
BOLT=[(0.62,0),(0.14,0.58),(0.46,0.58),(0.32,1),(0.86,0.38),(0.54,0.38),(0.74,0)]
def bolt(d,x,y,w,h,fill,outline=None,width=0):
    pts=[(x+px*w,y+py*h) for px,py in BOLT]
    d.polygon(pts,fill=fill,outline=outline,width=width)
def glow(im,draw_fn,radius=40,color=YEL):
    lay=Image.new('RGBA',(S,S),(0,0,0,0)); draw_fn(ImageDraw.Draw(lay),color)
    g=lay.filter(ImageFilter.GaussianBlur(radius)); im.paste(g,(0,0),g)

# 1 紺地に大きな黄色い稲妻、その上に白い明朝「英単語」
def i1():
    im=grad((26,72,112),NAVY2).convert('RGBA')
    glow(im,lambda d,c: bolt(d,300,90,440,840,c+(200,)),60)
    d=ImageDraw.Draw(im); bolt(d,300,90,440,840,YEL)
    d.text((512,520),'英単語',font=F(G8,200),fill=WHITE,anchor='mm',stroke_width=18,stroke_fill=NAVY2)
    return im
# 2 黄色地に紺の稲妻、下に太ゴシック「英単語」
def i2():
    im=grad((255,214,74),(244,180,30)); d=ImageDraw.Draw(im)
    bolt(d,330,90,380,620,NAVY)
    d.text((512,850),'英単語',font=F(G8,170),fill=NAVY,anchor='mm')
    return im
# 3 白い単語カード「word」に稲妻が走る、下帯に「英単語」
def i3():
    im=grad((28,77,112),NAVY2); d=ImageDraw.Draw(im)
    d.rounded_rectangle([120,230,800,700],56,fill=WHITE)
    d.text((460,470),'word',font=F(GEO,210),fill=INK,anchor='mm')
    bolt(d,700,110,190,360,YEL,outline=NAVY2,width=14)
    d.text((512,840),'英単語',font=F(G8,150),fill=WHITE,anchor='mm')
    return im
# 4 閃光：放射状の光の中心に明朝「英」、下に小さく「英単語フラッシュ」
def i4():
    im=Image.new('RGB',(S,S),NAVY2); d=ImageDraw.Draw(im)
    cx,cy=512,470
    for k in range(24):
        a=k*math.pi*2/24; a2=a+math.pi/24*0.55
        d.polygon([(cx,cy),(cx+900*math.cos(a),cy+900*math.sin(a)),(cx+900*math.cos(a2),cy+900*math.sin(a2))],fill=(30,70,108))
    rgba=im.convert('RGBA'); glow(rgba,lambda dd,c: dd.ellipse([cx-230,cy-230,cx+230,cy+230],fill=c+(255,)),70,YEL2)
    d=ImageDraw.Draw(rgba); d.ellipse([cx-215,cy-215,cx+215,cy+215],fill=(255,240,190))
    d.text((cx,cy+10),'英',font=F(MIN,300,1),fill=NAVY2,anchor='mm')
    d.text((512,880),'英単語フラッシュ',font=F(G6,92),fill=WHITE,anchor='mm')
    return rgba
# 5 スピード線と斜体の「ABC」、小さな稲妻、下に「英単語」
def i5():
    im=grad((22,62,98),NAVY2); d=ImageDraw.Draw(im)
    for k,(y,w) in enumerate([(300,6),(360,10),(430,4),(520,12),(600,6),(660,8)]):
        d.line([(60+k*20,y),(330+k*30,y)],fill=(141,184,220),width=w)
    d.text((600,470),'ABC',font=F(GEOI,250),fill=WHITE,anchor='mm')
    bolt(d,770,150,150,240,YEL)
    d.text((512,830),'英単語',font=F(G8,150),fill=YEL,anchor='mm')
    return im
# 6 稲妻の境目で紺と黄に二分。上に白い「A」、下に紺の「英」
def i6():
    im=Image.new('RGB',(S,S),YEL); d=ImageDraw.Draw(im)
    d.polygon([(0,0),(S,0),(S,380),(600,420),(700,560),(0,640)],fill=NAVY)
    d.text((470,270),'ABC',font=F(GEO,250),fill=WHITE,anchor='mm')
    d.text((512,830),'英単語',font=F(G8,190),fill=NAVY,anchor='mm')
    return im
# 7 フラッシュ暗算の電光表示：黒地に黄色のドットで「ABC」、下に「英単語」
def i7():
    im=Image.new('RGB',(S,S),(14,18,24)); d=ImageDraw.Draw(im)
    small=Image.new('L',(42,14),0); sd=ImageDraw.Draw(small)
    sd.text((21,7),'ABC',font=F(MONO,14,1),fill=255,anchor='mm')
    dot=20; ox,oy=512-21*dot,190
    for y in range(14):
        for x in range(42):
            on=small.getpixel((x,y))>110
            cx,cy=ox+x*dot+dot/2,oy+y*dot+dot/2
            d.ellipse([cx-7,cy-7,cx+7,cy+7],fill=YEL if on else (40,44,52))
    bolt(d,430,520,160,230,YEL)
    d.text((512,860),'英単語',font=F(G8,150),fill=WHITE,anchor='mm')
    return im
# 8 カメラのストロボ光：白い光の円に「英単語」、周りに光線、右上に稲妻
def i8():
    im=grad((24,66,104),NAVY2).convert('RGBA'); cx,cy=512,540
    glow(im,lambda d,c: d.ellipse([cx-300,cy-300,cx+300,cy+300],fill=c+(255,)),90,(255,255,255))
    d=ImageDraw.Draw(im)
    for k in range(12):
        a=k*math.pi/6
        d.line([(cx+330*math.cos(a),cy+330*math.sin(a)),(cx+430*math.cos(a),cy+430*math.sin(a))],fill=YEL,width=22)
    d.ellipse([cx-280,cy-280,cx+280,cy+280],fill=WHITE)
    d.text((cx,cy-40),'英単語',font=F(G8,140),fill=NAVY,anchor='mm')
    d.text((cx,cy+90),'FLASH',font=F(MONO,80,1),fill=(28,77,112),anchor='mm')
    bolt(d,760,60,170,270,YEL)
    return im
# 9 カードの残像：3枚のカードが流れ、先頭に「Word」、稲妻のバッジ、下に「英単語」
def i9():
    im=grad((28,77,112),NAVY2).convert('RGBA')
    for k,(x,a) in enumerate([(120,60),(200,120),(280,255)]):
        lay=Image.new('RGBA',(S,S),(0,0,0,0)); ld=ImageDraw.Draw(lay)
        ld.rounded_rectangle([x,220,x+560,640],44,fill=(255,255,255,a))
        if k==2: ld.text((x+280,430),'Word',font=F(GEO,180),fill=INK+(255,),anchor='mm')
        im.alpha_composite(lay)
    d=ImageDraw.Draw(im)
    d.ellipse([700,150,900,350],fill=YEL); bolt(d,745,175,110,150,NAVY2)
    d.text((512,830),'英単語',font=F(G8,150),fill=WHITE,anchor='mm')
    return im
# 10 白地に紺のセリフ「E」、稲妻が「E」を貫く、下に「英単語」
def i10():
    im=Image.new('RGB',(S,S),(248,248,245)); d=ImageDraw.Draw(im)
    d.text((512,420),'E',font=F(GEO,560),fill=NAVY,anchor='mm')
    bolt(d,520,80,260,580,YEL,outline=(248,248,245),width=16)
    d.text((512,850),'英単語',font=F(G8,150),fill=NAVY,anchor='mm')
    return im

fns=[i1,i2,i3,i4,i5,i6,i7,i8,i9,i10]
ims=[]
for k,fn in enumerate(fns,1):
    im=fn().convert('RGB'); im.save(f'icon_{k:02d}.png'); ims.append(im)
t=300; pad=36; cols=5
lab=F(G6,34)
sheet=Image.new('RGB',(cols*(t+pad)+pad,2*(t+110)+30),(240,242,241)); sd=ImageDraw.Draw(sheet)
mask=Image.new('L',(t,t),0); ImageDraw.Draw(mask).rounded_rectangle([0,0,t-1,t-1],int(t*0.225),fill=255)
for k,im in enumerate(ims):
    x=pad+(k%cols)*(t+pad); y=30+(k//cols)*(t+110)
    sheet.paste(im.resize((t,t),Image.LANCZOS),(x,y),mask)
    sd.text((x+t/2,y+t+40),str(k+1),font=lab,fill=(30,40,50),anchor='mm')
sheet.save('sheet10.png')
sm=Image.new('RGB',(10*76+16,96),(240,242,241)); m2=Image.new('L',(60,60),0); ImageDraw.Draw(m2).rounded_rectangle([0,0,59,59],13,fill=255)
for k,im in enumerate(ims): sm.paste(im.resize((60,60),Image.LANCZOS),(16+k*76,18),m2)
sm.save('small10.png'); print('ok')
