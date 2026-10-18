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
