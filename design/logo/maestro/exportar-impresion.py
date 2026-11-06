"""Exportación de geometría SVG aprobada a EPS y PDF CMYK mediante ICC."""
from pathlib import Path
import xml.etree.ElementTree as ET
import re, math, json, shutil
from PIL import Image,ImageCms
from reportlab.pdfgen import canvas
from reportlab.lib.colors import CMYKColor
from pypdf import PdfReader,PdfWriter
from pypdf.generic import DictionaryObject,NameObject,TextStringObject,NumberObject,DecodedStreamObject,ArrayObject
base=Path(__file__).resolve().parent.parent
out=base/'biblioteca-completa-2026-11-05'
folder=out/'07-impresion'
profile=Path('/System/Library/ColorSync/Profiles/Generic CMYK Profile.icc')
transform=ImageCms.buildTransform('/System/Library/ColorSync/Profiles/sRGB Profile.icc',str(profile),'RGB','CMYK',renderingIntent=1)
colors={}
def color(s):
 if s not in colors:
  if s=='#000000': c=[0,0,0,1]
  elif s=='#FFFFFF': c=[0,0,0,0]
  else: c=[v/255 for v in ImageCms.applyTransform(Image.new('RGB',(1,1),s),transform).getpixel((0,0))]
  colors[s]=c
 return colors[s]
def nums(s):return [float(v) for v in re.findall(r'[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?',s)]
def visit(e,cmd,w,h,style=None):
 st=dict(style or {'fill':'#000000','stroke':'none','stroke-width':'1'})
 for k in ['fill','stroke','stroke-width','fill-rule','stroke-linejoin','stroke-linecap']:
  if k in e.attrib: st[k]=e.get(k)
 tag=e.tag.split('}')[-1]
 if tag in ['title','desc','metadata']:return
 cmd.append(('save',))
 for t,args in re.findall(r'(translate|scale)\(([^)]+)\)',e.get('transform','')):
  a=nums(args)
  cmd.append((t,a[0],a[1] if len(a)>1 else (0 if t=='translate' else a[0])))
 if tag in ['path','rect','circle']:
  p=[]
  if tag=='path':
   tokens=re.findall(r'[MCZ]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?',e.get('d',''));i=0
   while i<len(tokens):
    op=tokens[i];i+=1;n={'M':2,'C':6,'Z':0}[op];a=list(map(float,tokens[i:i+n]));i+=n;p.append((op,*a))
  elif tag=='rect':
   x=float(e.get('x',0));y=float(e.get('y',0));rw=w if e.get('width')=='100%' else float(e.get('width',0));rh=h if e.get('height')=='100%' else float(e.get('height',0));p=[('R',x,y,rw,rh)]
  else:p=[('O',float(e.get('cx')),float(e.get('cy')),float(e.get('r')))]
  cmd.append(('draw',p,st))
 for child in e:visit(child,cmd,w,h,st)
 cmd.append(('restore',))
def eps(commands,width,height):
 lines=['%!PS-Adobe-3.0 EPSF-3.0',f'%%BoundingBox: 0 0 {math.ceil(width)} {math.ceil(height)}',f'%%HiResBoundingBox: 0 0 {width:.6f} {height:.6f}','%%DocumentProcessColors: Cyan Magenta Yellow Black','%%ColorConversion: sRGB -> Generic CMYK Profile.icc, relative colorimetric','%%EndComments']
 for c in commands:
  op=c[0]
  if op in ['save','restore']:lines.append('gsave' if op=='save' else 'grestore')
  elif op in ['translate','scale']:lines.append(f'{c[1]:.9f} {c[2]:.9f} {op}')
  else:
   _,p,st=c
   def pathcmd():
    a=['newpath']
    for q in p:
     if q[0] in ['M','C']:a.append(' '.join(f'{v:.9f}' for v in q[1:])+(' moveto' if q[0]=='M' else ' curveto'))
     elif q[0]=='Z':a.append('closepath')
     elif q[0]=='R':
      _,x,y,w,h=q;a.extend([f'{x} {y} moveto',f'{w} 0 rlineto',f'0 {h} rlineto',f'{-w} 0 rlineto','closepath'])
     else:
      _,x,y,r=q;a.extend([f'{x+r} {y} moveto',f'{x} {y} {r} 0 360 arc','closepath'])
    return a
   for key in ['fill','stroke']:
    if st.get(key,'none')=='none':continue
    lines+=pathcmd();lines.append(' '.join(f'{v:.9f}' for v in color(st[key]))+' setcmykcolor')
    if key=='fill':lines.append('eofill' if st.get('fill-rule')=='evenodd' else 'fill')
    else:
     lines.extend([f'{st["stroke-width"]} setlinewidth',f'{ {"miter":0,"round":1,"bevel":2}.get(st.get("stroke-linejoin"),0)} setlinejoin',f'{ {"butt":0,"round":1,"square":2}.get(st.get("stroke-linecap"),0)} setlinecap','stroke'])
 lines+=['showpage','%%EOF'];return '\n'.join(lines)+'\n'
def pdfdraw(c,commands):
 for q in commands:
  if q[0]=='save':c.saveState()
  elif q[0]=='restore':c.restoreState()
  elif q[0]=='translate':c.translate(q[1],q[2])
  elif q[0]=='scale':c.scale(q[1],q[2])
  else:
   _,ops,st=q;p=c.beginPath()
   for z in ops:
    if z[0]=='M':p.moveTo(*z[1:])
    elif z[0]=='C':p.curveTo(*z[1:])
    elif z[0]=='Z':p.close()
    elif z[0]=='R':p.rect(*z[1:])
    else:
     _,x,y,r=z;k=.5522847498307936*r
     p.moveTo(x+r,y);p.curveTo(x+r,y+k,x+k,y+r,x,y+r);p.curveTo(x-k,y+r,x-r,y+k,x-r,y);p.curveTo(x-r,y-k,x-k,y-r,x,y-r);p.curveTo(x+k,y-r,x+r,y-k,x+r,y);p.close()
   fill=st.get('fill')!='none';stroke=st.get('stroke')!='none'
   if fill:c.setFillColor(CMYKColor(*color(st['fill'])))
   if stroke:c.setStrokeColor(CMYKColor(*color(st['stroke'])));c.setLineWidth(float(st['stroke-width']));c.setLineJoin({'miter':0,'round':1,'bevel':2}.get(st.get('stroke-linejoin'),0))
   c.drawPath(p,fill=int(fill),stroke=int(stroke),fillMode=0 if st.get('fill-rule')=='evenodd' else 1)
raw=folder/'maestros-cmyk.tmp.pdf';c=canvas.Canvas(str(raw),pageCompression=1);c.setTitle('bnbtico · maestros CMYK · 100 mm de ancho')
records=[]
for theme in sorted((out/'01-logos').iterdir()):
 if not theme.is_dir() or theme.name in ['alta-resolucion','negro-transparente','tinta-transparente']:continue
 sources=list(sorted(theme.glob('*.svg')))+list(sorted((out/'00-maestros-svg'/theme.name).glob('*.svg')))
 for f in sources:
  root=ET.parse(f).getroot();_,_,w,h=map(float,root.get('viewBox').split());pt=100/25.4*72;hp=pt*h/w
  commands=[('save',),('translate',0,hp),('scale',pt/w,-pt/w)];visit(root,commands,w,h);commands.append(('restore',))
  target=folder/'eps-cmyk'/theme.name/(f.stem+'.eps');target.parent.mkdir(parents=True,exist_ok=True);target.write_text(eps(commands,pt,hp))
  c.setPageSize((pt,hp));c.bookmarkPage(f'{theme.name}-{f.stem}');c.addOutlineEntry(f'{theme.name} / {f.stem}',f'{theme.name}-{f.stem}',0);pdfdraw(c,commands);c.showPage();records.append({'page':len(records)+1,'theme':theme.name,'name':f.stem,'source':str(f.relative_to(out)),'eps':str(target.relative_to(out)),'widthMm':100})
c.save()
r=PdfReader(raw);writer=PdfWriter();writer.clone_document_from_reader(r)
# ReportLab registra Helvetica por defecto aunque no haya texto. Eliminar recurso y preámbulo sin uso.
for page in writer.pages:
 data=page.get_contents().get_data()
 data=re.sub(rb'BT /F1 12 Tf 14.4 TL ET\s*',b'',data)
 stream=DecodedStreamObject();stream.set_data(data);page[NameObject('/Contents')]=writer._add_object(stream)
 page['/Resources'].pop(NameObject('/Font'),None)
 page['/Resources'][NameObject('/ProcSet')]=ArrayObject([NameObject('/PDF')])
icc=DecodedStreamObject();icc.set_data(profile.read_bytes());icc[NameObject('/N')]=NumberObject(4);iccRef=writer._add_object(icc)
intent=DictionaryObject({NameObject('/Type'):NameObject('/OutputIntent'),NameObject('/S'):NameObject('/GTS_PDFX'),NameObject('/OutputConditionIdentifier'):TextStringObject('Generic CMYK Profile'),NameObject('/Info'):TextStringObject('Converted from sRGB using Apple Generic CMYK ICC; adapt profile to printer/paper'),NameObject('/DestOutputProfile'):iccRef})
writer._root_object[NameObject('/OutputIntents')]=ArrayObject([writer._add_object(intent)])
writer.add_metadata({'/Title':'bnbtico · maestros CMYK · 100 mm de ancho','/Creator':'Exportación de SVG aprobados; sin fuentes ni mapas de bits'})
with (folder/'maestros-cmyk.pdf').open('wb') as stream:writer.write(stream)
raw.unlink();shutil.copyfile(profile,folder/'Generic-CMYK-Profile.icc')
(folder/'paginas-y-colores.json').write_text(json.dumps({'profile':'Generic CMYK Profile.icc','intent':'relative colorimetric','colors':colors,'pages':records},indent=2)+'\n')
print(json.dumps({'eps':len(records),'pdfPages':len(PdfReader(folder/'maestros-cmyk.pdf').pages),'colors':colors}))
