import type { NextConfig } from "next";

// Security headers — กัน clickjacking, MIME sniffing, ควบคุมการรั่วของ referrer/สิทธิ์
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // อนุญาตกล้อง/ไมค์ให้ทั้งหน้าเราและ iframe วิดีโอคอล (Jitsi: meet.jit.si) — ถ้าใส่แค่ self จะเปิดกล้อง/ไมค์ในคอลไม่ได้
  { key: "Permissions-Policy", value: 'camera=(self "https://meet.jit.si"), microphone=(self "https://meet.jit.si"), display-capture=(self "https://meet.jit.si"), geolocation=(self)' },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
