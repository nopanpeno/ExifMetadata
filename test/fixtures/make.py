# Bikin foto contoh untuk tes. Jalankan: python3 test/fixtures/make.py
from PIL import Image, ImageCms
import os
d = os.path.dirname(os.path.abspath(__file__))
im = Image.effect_noise((64, 48), 80).convert('RGB')

# 1) JPEG progresif + ICC + GPS barat/selatan
icc = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
ex = Image.Exif()
ex[0x010F] = 'ProgMake'
ex[0x0110] = 'ProgModel'
ex[0x8825] = {1: 'S', 2: (33.0, 51.0, 0.0), 3: 'W', 4: (151.0, 12.0, 0.0)}
im.save(f'{d}/progressive-icc-gps.jpg', exif=ex, progressive=True, icc_profile=icc, quality=90)

# 2) JPEG tanpa EXIF
im.save(f'{d}/no-exif.jpg', quality=90)

# 3) JPEG dengan nomor seri dan pemilik
ex = Image.Exif()
ex[0x010F] = 'SerMake'
ex[0x8769] = {0xA431: 'SN-12345', 0xA430: 'Budi'}  # BodySerialNumber, CameraOwnerName
im.save(f'{d}/serial-owner.jpg', exif=ex, quality=90)

# 4) sample.jpg: Make, Model, ISO, tanggal, GPS Jakarta
sm = Image.new('RGB', (40, 30), 'red')
ex = Image.Exif()
ex[0x010F] = 'TestMake'; ex[0x0110] = 'TestModel'
ex[0x8769] = {0x8827: 200, 0x9003: '2026:01:02 03:04:05'}
ex[0x8825] = {1: 'S', 2: (6.0, 12.0, 0.0), 3: 'E', 4: (106.0, 48.0, 0.0)}
sm.save(f'{d}/sample.jpg', exif=ex)

# 5) sample-rot.jpg: orientasi 6
sr = Image.new('RGB', (40, 30), 'blue')
ex = Image.Exif()
ex[0x010F] = 'RotMake'; ex[0x0112] = 6
sr.save(f'{d}/sample-rot.jpg', exif=ex)

# 6) gps-detail.jpg: GPS lengkap (ketinggian, arah, kecepatan, akurasi, waktu)
# Nilai pecahan harus RATIONAL (IFDRational); float biasa ditulis sebagai DOUBLE, tipe yang tidak sah di EXIF.
from PIL.TiffImagePlugin import IFDRational as R
im6 = Image.effect_noise((64, 48), 80).convert('RGB')
ex = Image.Exif()
ex[0x010F] = 'GpsMake'
ex[0x8825] = {1: 'S', 2: (R(6), R(12), R(0)), 3: 'E', 4: (R(106), R(48), R(0)), 5: 0, 6: R(1234, 10),
              7: (R(3), R(4), R(5)), 12: 'K', 13: R(40), 16: 'T', 17: R(90), 29: '2026:01:02', 31: R(5)}
im6.save(f'{d}/gps-detail.jpg', exif=ex, quality=90)

# 7) PNG dan WebP (dibuat sekali lalu dikomit; nilai acak bisa berbeda saat dibuat ulang)
from PIL import PngImagePlugin, ImageCms
XMP = ('<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
       '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator><rdf:Seq><rdf:li>Budi</rdf:li></rdf:Seq></dc:creator>'
       '</rdf:Description></rdf:RDF></x:xmpmeta>')
icc = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
exif = Image.Exif(); exif[0x010F] = 'PngMake'; exif[0x0112] = 6
exif[0x8825] = {1: 'S', 2: (6.0, 12.0, 0.0), 3: 'E', 4: (106.0, 48.0, 0.0)}
ia = Image.effect_noise((64, 48), 60).convert('RGBA')
info = PngImagePlugin.PngInfo(); info.add_text('Author', 'Budi'); info.add_text('Comment', 'rahasia'); info.add_itxt('XML:com.adobe.xmp', XMP)
ia.save(f'{d}/meta.png', pnginfo=info, exif=exif, icc_profile=icc)
Image.effect_noise((64, 48), 80).convert('RGB').save(f'{d}/plain.png')
Image.effect_noise((64, 48), 80).convert('RGB').save(f'{d}/meta.webp', quality=80, exif=exif, xmp=XMP.encode(), icc_profile=icc)
ia.save(f'{d}/alpha.webp', lossless=True, exif=exif)
fr = [Image.effect_noise((32, 32), s).convert('RGB') for s in (40, 80, 120)]
fr[0].save(f'{d}/anim.webp', save_all=True, append_images=fr[1:], duration=100, loop=0, exif=exif)
