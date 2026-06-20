# Support Call VPS + TURN Checklist

เอกสารนี้ใช้สำหรับเตรียมระบบโทรระหว่างแอดมินกับผู้ใช้ โดยให้เว็บอยู่บน Vercel และรัน `coturn` บน VPS ของเราเอง

## เป้าหมาย

- หน้าเว็บและ API รันบน Vercel ตามเดิม
- เสียงโทรคุยใช้ WebRTC
- TURN relay ใช้ `coturn` บน VPS ของเราเอง
- ระหว่างเตรียมระบบ ให้ล็อกปุ่มโทรเป็น `Coming Soon`
- เมื่อพร้อมเปิดจริง ให้เปลี่ยน `NEXT_PUBLIC_SUPPORT_CALLS_ENABLED=true`

## สถาปัตยกรรม

```txt
Customer/Admin Browser
  -> โหลดหน้าเว็บจาก Vercel
  -> เรียก API /api/support/ice หรือ /api/admin/support/ice
  -> ได้ STUN + TURN credential กลับมา
  -> Browser เชื่อม TURN server บน VPS โดยตรง

Vercel
  -> หน้าเว็บ
  -> signaling API
  -> สร้าง TURN credential จาก secret

VPS ของเราเอง
  -> รัน coturn
  -> เปิดพอร์ต relay สำหรับ WebRTC
```

## DNS ที่ต้องมี

- สร้าง subdomain เช่น `turn.example.com`
- ชี้ DNS มาที่ Public IP ของ VPS

## Firewall / Port

เปิดพอร์ตอย่างน้อย:

- `3478/tcp`
- `3478/udp`
- `5349/tcp` ถ้าจะใช้ `turns:`
- ช่วง relay ports เช่น `50000-55000/udp`

## ตัวอย่างติดตั้งบน Ubuntu

```bash
sudo apt update
sudo apt install -y coturn
```

## ตัวอย่าง `/etc/turnserver.conf`

```conf
listening-port=3478
tls-listening-port=5349

fingerprint
use-auth-secret
static-auth-secret=replace_with_your_secret
realm=turn.example.com
server-name=turn.example.com

no-cli
no-multicast-peers
stale-nonce=600

min-port=50000
max-port=55000
```

ถ้า VPS มีหลาย network interface หรืออยู่หลัง NAT ให้เพิ่ม:

```conf
external-ip=YOUR_PUBLIC_IP
```

ถ้าจะใช้ `turns:` ให้เพิ่ม cert:

```conf
cert=/etc/letsencrypt/live/turn.example.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.example.com/privkey.pem
```

เปิด service:

```bash
sudo systemctl enable coturn
sudo systemctl restart coturn
sudo systemctl status coturn
```

## ค่า Environment บน Vercel

```env
NEXT_PUBLIC_SUPPORT_CALLS_ENABLED=false
WEBRTC_STUN_URLS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
WEBRTC_TURN_URLS=turn:turn.example.com:3478?transport=udp,turn:turn.example.com:3478?transport=tcp
WEBRTC_TURN_SECRET=replace_with_your_secret
WEBRTC_TURN_TTL_SECONDS=3600
```

หมายเหตุ:

- แนะนำใช้ `WEBRTC_TURN_SECRET` สำหรับ production
- ถ้าใช้ provider ที่ให้ `username/password` แบบคงที่ ให้ใช้:

```env
WEBRTC_TURN_USERNAME=your_turn_username
WEBRTC_TURN_CREDENTIAL=your_turn_password
```

## ขั้นตอนเปิดใช้งานจริง

1. ตั้ง `coturn` บน VPS ให้พร้อม
2. ทดสอบว่า TURN reachable จากอินเทอร์เน็ต
3. ใส่ค่า env ใน Vercel
4. เปลี่ยน `NEXT_PUBLIC_SUPPORT_CALLS_ENABLED=true`
5. Redeploy
6. ทดสอบ 2 flow

- `ลูกค้าโทร -> แอดมินรับ -> คุยได้`
- `แอดมินโทร -> ลูกค้ารับ -> คุยได้`

## สถานะปัจจุบันของโค้ด

- โค้ดฝั่งโทรและ signaling ยังอยู่ครบ
- ปุ่มโทรฝั่งลูกค้าและแอดมินถูกล็อกเป็น `Coming Soon`
- เมื่อพร้อมเปิดจริง ให้เปิดด้วย env flag โดยไม่ต้องรื้อ flow ใหม่
