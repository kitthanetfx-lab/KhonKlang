import { after } from 'next/server';
import { SLIPOK_AUTO_RETRY_DELAY_MS } from '@/lib/slipok';

/** รอแล้วรัน task หลัง response — ใช้กับ SlipOK 1010 (ธนาคารยังไม่อัปเดต) */
export function scheduleSlipRetry(task: () => Promise<void>, delayMs = SLIPOK_AUTO_RETRY_DELAY_MS) {
  after(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, delayMs));
    try {
      await task();
    } catch (err) {
      console.error('[slipRetry] scheduled retry failed', err);
    }
  });
}
