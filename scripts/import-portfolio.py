from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
import json, shutil, subprocess
import imageio_ffmpeg
src=Path('C:/Users/14855140708/Desktop/victor referencias')
root=Path('C:/Users/14855140708/Desktop/victor')
out=root/'assets/portfolio';out.mkdir(parents=True,exist_ok=True)
manifest={}; posters=[]
for f in sorted(src.iterdir()):
 if f.suffix.lower() not in ['.jpg','.jpeg','.png','.mp4']:continue
 name=f.stem
 if f.suffix.lower()=='.mp4':
  target=out/f.name
  if not target.exists():shutil.copy2(f,target)
  temp=out/(name+'-poster.jpg')
  subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-loglevel','error','-ss','0.15','-i',str(f),'-frames:v','1','-y',str(temp)],check=True)
  im=Image.open(temp);kind='video';media='assets/portfolio/'+f.name;posters.append((f.name,im.copy()));temp.unlink()
 else:
  im=ImageOps.exif_transpose(Image.open(f)).convert('RGB');kind='image'
  full=im.copy();full.thumbnail((2200,2200));full.save(out/(name+'.webp'),'WEBP',quality=91,method=5)
  media='assets/portfolio/'+name+'.webp'
 w,h=im.size
 im.thumbnail((720,1000));im.save(out/(name+'-thumb.webp'),'WEBP',quality=86,method=5)
 manifest[f.name]={'type':kind,'src':media,'thumb':'assets/portfolio/'+name+'-thumb.webp','width':w,'height':h}
(root/'assets/portfolio/media.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
sheet=Image.new('RGB',(240*4,340*((len(posters)+3)//4)),'#ddd');d=ImageDraw.Draw(sheet)
for i,(name,im) in enumerate(posters):
 im.thumbnail((230,290));x=i%4*240;y=i//4*340;sheet.paste(im,(x,y));d.text((x+3,y+295),name[:32],fill='black')
sheet.save('C:/Users/14855140708/Documents/ChatGPT/victor tattoo/output/portfolio/videos.jpg')
print('Prepared',len(manifest),'media files')
