from PIL import Image, ImageDraw
import math
from pathlib import Path
p=Path('public')
for size in (192,512):
 im=Image.new('RGB',(size,size),'#3562d8')
 draw=ImageDraw.Draw(im)
 for offset in (-0.16,0,0.16):
  pts=[]
  for i in range(201):
   x=0.24+i/200*0.52
   y=0.50+offset+0.045*math.sin((x-.24)/.52*2*math.pi)
   pts.append((round(x*size),round(y*size)))
  draw.line(pts,fill='white',width=round(size*.038),joint='curve')
  rad=size*.019
  for x,y in [pts[0],pts[-1]]:draw.ellipse([x-rad,y-rad,x+rad,y+rad],fill='white')
 im.save(p/f'icon-{size}.png')
rows=['date;merchant;amount;currency']
items=[('Аренда квартиры',19000,5),('Домашний интернет',790,8),('YANDEX*PLUS',399,10),('ЖКХ',7200,12),('MTS',650,15),('NETFLIX',899,17),('IVI',399,19),('OPENAI CHATGPT',1999,21),('SPOTIFY',299,23),('ICLOUD',149,25),('ADOBE',999,27)]
for month in [3,4,5,6,7,8]:
 for name,amount,day in items:
  if name=='ЖКХ':amount={3:6900,4:7350,5:7120,6:7480,7:7040,8:7230}[month]
  if name=='NETFLIX' and month<8:amount=699
  rows.append(f'2026-{month:02d}-{day:02d};{name};-{amount};RUB')
rows += ['2024-10-02;Страхование квартиры;-12000;RUB','2025-10-02;Страхование квартиры;-12000;RUB','2026-07-03;Покупка продуктов;-2150;RUB','2026-07-18;Аптека;-650;RUB','2026-08-04;Возврат товара;1250;RUB']
(p/'example-statement.csv').write_text('\n'.join(rows),encoding='utf-8-sig')
print('Created PWA icons and synthetic statement example.')
