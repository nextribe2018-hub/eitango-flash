# 案1（稲妻＋英単語）に「フラッシュ／FLASH」を、斜体・スピード線・発光でフラッシュらしく入れる
from PIL import Image, ImageDraw, ImageFont, ImageFilter
S=1024
FD='/System/Library/Fonts/'
G8=FD+'ヒラギノ角ゴシック W8.ttc'; G9=FD+'ヒラギノ角ゴシック W9.ttc'
AVC=FD+'Avenir Next Condensed.ttc'
NAVY2=(10,28,48); WHITE=(255,255,255); YEL=(247,198,46); YEL2=(255,236,150)
def F(p,s,i=0): return ImageFont.truetype(p,s,index=i)
BOLT=[(0.62,0),(0.14,0.58),(0.46,0.58),(0.32,1),(0.86,0.38),(0.54,0.38),(0.74,0)]
def grad(a,b):
    im=Image.new('RGBA',(S,S)); d=ImageDraw.Draw(im)
    for k in range(S):
        t=k/(S-1); d.line([(0,k),(S,k)],fill=tuple(round(x+(z-x)*t) for x,z in zip(a,b))+(255,))
    return im
def base(bolt_box=(300,60,440,880),alpha=255):
    im=grad((26,72,112),NAVY2)
    x,y,w,h=bolt_box; pts=[(x+px*w,y+py*h) for px,py in BOLT]
    g=Image.new('RGBA',(S,S),(0,0,0,0)); ImageDraw.Draw(g).polygon(pts,fill=YEL+(170,))
    g=g.filter(ImageFilter.GaussianBlur(60)); im.alpha_composite(g)
    l=Image.new('RGBA',(S,S),(0,0,0,0)); ImageDraw.Draw(l).polygon(pts,fill=YEL+(alpha,)); im.alpha_composite(l)
    return im
def shear(layer,s=0.28,cy=512):
    return layer.transform((S,S),Image.AFFINE,(1,s,-s*cy,0,1,0),resample=Image.BICUBIC)
def text_layer(txt,font,xy,fill,stroke=0,stroke_fill=None,anchor='mm'):
    l=Image.new('RGBA',(S,S),(0,0,0,0)); ImageDraw.Draw(l).text(xy,txt,font=font,fill=fill,anchor=anchor,stroke_width=stroke,stroke_fill=stroke_fill); return l
def speed(im,y0,y1,x0,x1,col=(255,236,150),n=5):
    d=ImageDraw.Draw(im)
    for k in range(n):
        y=y0+(y1-y0)*k/(n-1); w=[6,10,14,10,6][k%5]
        d.line([(x0+k*18,y),(x1-k*30,y)],fill=col+(230,),width=w)
def word(im,y=360,size=190):
    lay=text_layer('英単語',F(G8,size),(512,y),WHITE,18,NAVY2)
    # 文字の中の閉じたすき間（「語」の口など）から稲妻が透けないよう、すき間を紺で埋める
    hole=lay.split()[3].filter(ImageFilter.MaxFilter(31)).filter(ImageFilter.MinFilter(31))
    under=Image.new('RGBA',(S,S),NAVY2+(0,)); under.putalpha(hole)
    im.alpha_composite(under); im.alpha_composite(lay)
def glowtext(im,layer,radius=18,col=YEL):
    a=layer.split()[3]; g=Image.new('RGBA',(S,S),col+(0,)); g.putalpha(a.filter(ImageFilter.GaussianBlur(radius)))
    im.alpha_composite(g); im.alpha_composite(layer)

# a：英字「FLASH」斜体（Avenir Next Condensed Heavy Italic）、黄色の発光（スピード線なし。本人指定）
def a():
    im=base(); word(im)
    t=text_layer('FLASH',F(AVC,250,9),(512,650),YEL,14,NAVY2)
    glowtext(im,t,22); return im
# b：カタカナ「フラッシュ」を斜めに倒した極太ゴシック、左にスピード線
def b():
    im=base(); word(im,340,200)
    speed(im,590,700,30,170)
    t=shear(text_layer('フラッシュ',F(G9,150),(560,650),YEL,14,NAVY2),0.3,650)
    glowtext(im,t,20); return im
# c：「FLASH」を稲妻のように斜めに切って上下をずらす
def c():
    im=base(); word(im)
    f=F(AVC,260,9); t=text_layer('FLASH',f,(512,660),WHITE,14,NAVY2)
    m1=Image.new('L',(S,S),0); ImageDraw.Draw(m1).polygon([(0,0),(S,0),(S,600),(0,720)],fill=255)
    top=Image.new('RGBA',(S,S),(0,0,0,0)); top.paste(t,(0,0),m1)
    m2=Image.eval(m1,lambda v:255-v); bot=Image.new('RGBA',(S,S),(0,0,0,0)); bot.paste(t,(0,0),m2)
    lay=Image.new('RGBA',(S,S),(0,0,0,0)); lay.alpha_composite(top,(-14,-6)); lay.alpha_composite(bot,(18,8))
    glowtext(im,lay,20,YEL)
    ImageDraw.Draw(im).line([(40,735),(980,585)],fill=YEL+(255,),width=8)
    return im
# d：「フラッシュ」に残像（右から左へ薄くなる複製）＋白から黄へ
def d():
    im=base(); word(im,340,200)
    f=F(G9,150)
    for k,a_ in [(4,40),(3,70),(2,110),(1,160)]:
        ghost=shear(text_layer('フラッシュ',f,(540-k*34,650),YEL+(a_,)),0.3,650); im.alpha_composite(ghost)
    t=shear(text_layer('フラッシュ',f,(540,650),YEL2,12,NAVY2),0.3,650)
    glowtext(im,t,16); return im

out=[]
for k,fn in zip('abcd',[a,b,c,d]):
    im=fn().convert('RGB'); im.save(f'icon_1{k}.png'); out.append((k,im))
t=300; pad=36
sheet=Image.new('RGB',(4*(t+pad)+pad,t+110),(240,242,241)); sd=ImageDraw.Draw(sheet)
mask=Image.new('L',(t,t),0); ImageDraw.Draw(mask).rounded_rectangle([0,0,t-1,t-1],int(t*0.225),fill=255)
for i,(k,im) in enumerate(out):
    x=pad+i*(t+pad); sheet.paste(im.resize((t,t),Image.LANCZOS),(x,30),mask)
    sd.text((x+t/2,t+70),'1'+k,font=F(FD+'ヒラギノ角ゴシック W6.ttc',34),fill=(30,40,50),anchor='mm')
sheet.save('sheet1.png')
sm=Image.new('RGB',(4*76+16,96),(240,242,241)); m2=Image.new('L',(60,60),0); ImageDraw.Draw(m2).rounded_rectangle([0,0,59,59],13,fill=255)
for i,(k,im) in enumerate(out): sm.paste(im.resize((60,60),Image.LANCZOS),(16+i*76,18),m2)
sm.save('small1.png'); print('ok')
