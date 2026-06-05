'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, AlertCircle, ArrowRight, CheckCircle2, Link2 } from 'lucide-react';
import { account } from '@/lib/appwrite';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get('role') || 'seller';

  // ถ้าลงทะเบียนไปแล้ว (มี firstName ใน prefs) ให้ข้ามไปหน้าหลัก
  useEffect(() => {
    account.get().then((u) => {
      const prefs = u.prefs as Record<string, string>;
      if (prefs?.firstName) {
        router.replace('/');
      }
    }).catch(() => {
      router.replace('/login');
    });
  }, [router]);

  const [type, setType] = useState<'individual' | 'corporate'>('individual');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    bankAccountName: '',
    bankName: '',
    accountNumber: '',
  });
  const [validationError, setValidationError] = useState('');
  const [saving, setSaving] = useState(false);
  const [linkedAccount, setLinkedAccount] = useState(false);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (validationError) setValidationError('');
  };

  const validateNames = () => {
    const fullName = `${formData.firstName} ${formData.lastName}`.trim().toLowerCase();
    const bankName = formData.bankAccountName.trim().toLowerCase();
    if (fullName && bankName && fullName !== bankName) {
      setValidationError('ชื่อ-นามสกุล และชื่อบัญชีธนาคารไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateNames()) return;

    setSaving(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        setValidationError(data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
        return;
      }

      if (data.linked) {
        // พบบัญชีเดิม → แสดง popup แล้วไปหน้าหลัก
        setLinkedAccount(true);
        setTimeout(() => router.push('/'), 2500);
      } else {
        router.push('/');
      }
    } catch {
      setValidationError('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = role === 'middleman' ? 'คนกลาง' : 'ผู้ขาย';
  const inputClass =
    'w-full bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all';

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6">
      {/* Linked account notification */}
      {linkedAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-sm mx-4 text-center shadow-2xl animate-fade-in">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <Link2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">เชื่อมบัญชีสำเร็จ!</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              พบข้อมูลบัญชีของคุณในระบบแล้ว บัญชีนี้ได้รับการเชื่อมโยงเข้าด้วยกันเรียบร้อย
            </p>
            <p className="text-xs text-gray-400 mt-3">กำลังพาไปหน้าหลัก...</p>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto glass-panel rounded-2xl p-6 sm:p-10 animate-fade-in shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">ข้อมูลผู้ใช้งาน</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            role === 'middleman'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
          }`}>
            สมัครเป็น{roleLabel}
          </span>
        </div>
        <p className="text-gray-600 dark:text-gray-300 mb-8">
          กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้องเพื่อประโยชน์ของท่าน
        </p>

        {/* บุคคลธรรมดา / นิติบุคคล */}
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-8">
          {(['individual', 'corporate'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                type === t
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
              onClick={() => setType(t)}
            >
              {t === 'individual' ? 'บุคคลธรรมดา' : 'นิติบุคคล'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ชื่อ - นามสกุล */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2 opacity-80">ชื่อจริง (ไม่ต้องใส่คำนำหน้า)</label>
              <input
                required type="text" name="firstName"
                value={formData.firstName} onChange={handleInputChange}
                className={inputClass} placeholder="เช่น สมชาย"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 opacity-80">นามสกุล</label>
              <input
                required type="text" name="lastName"
                value={formData.lastName} onChange={handleInputChange}
                className={inputClass} placeholder="เช่น ใจดี"
              />
            </div>
          </div>

          {/* ชื่อบริษัท (นิติบุคคล) */}
          {type === 'corporate' && (
            <div>
              <label className="block text-sm font-medium mb-2 opacity-80">ชื่อบริษัท / ห้างหุ้นส่วนจำกัด</label>
              <input
                required type="text" className={inputClass}
                placeholder="บริษัท ตัวอย่าง จำกัด"
              />
            </div>
          )}

          {/* เบอร์โทรศัพท์ */}
          <div>
            <label className="block text-sm font-medium mb-2 opacity-80">
              เบอร์โทรศัพท์
              <span className="ml-2 text-xs text-blue-500 font-normal">
                ใช้ยืนยันตัวตนและเชื่อมบัญชีข้ามแพลตฟอร์ม
              </span>
            </label>
            <input
              required type="tel" name="phone"
              value={formData.phone} onChange={handleInputChange}
              className={inputClass} placeholder="0812345678"
              pattern="[0-9]{9,10}"
            />
          </div>

          {/* ที่อยู่ */}
          <div>
            <label className="block text-sm font-medium mb-2 opacity-80">ที่อยู่</label>
            <textarea
              required name="address"
              value={formData.address} onChange={handleInputChange}
              rows={3}
              className="w-full bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
              placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
            />
          </div>

          <hr className="border-gray-200 dark:border-gray-700 my-2" />
          <h2 className="text-xl font-semibold mb-4">ข้อมูลบัญชีธนาคาร (สำหรับรับเงิน)</h2>

          {/* ชื่อบัญชีธนาคาร */}
          <div>
            <label className="block text-sm font-medium mb-2 opacity-80">ชื่อบัญชีธนาคาร</label>
            <input
              required type="text" name="bankAccountName"
              value={formData.bankAccountName} onChange={handleInputChange}
              onBlur={validateNames}
              className={`w-full bg-white/50 dark:bg-gray-900/50 border ${
                validationError
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-200 dark:border-gray-700 focus:ring-blue-500'
              } rounded-xl px-4 py-3 outline-none focus:ring-2 transition-all`}
              placeholder="ต้องตรงกับชื่อ-นามสกุล หรือชื่อบริษัท"
            />
            {validationError && (
              <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> {validationError}
              </p>
            )}
            {formData.firstName && formData.bankAccountName && !validationError && (
              <p className="text-green-500 text-sm mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> ชื่อบัญชีตรงกัน
              </p>
            )}
          </div>

          {/* ธนาคาร + เลขบัญชี */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2 opacity-80">ธนาคาร</label>
              <select
                required name="bankName"
                onChange={handleInputChange}
                className={inputClass}
              >
                <option value="">เลือกธนาคาร...</option>
                <option value="kbank">กสิกรไทย (KBANK)</option>
                <option value="scb">ไทยพาณิชย์ (SCB)</option>
                <option value="bbl">กรุงเทพ (BBL)</option>
                <option value="ktb">กรุงไทย (KTB)</option>
                <option value="krungsri">กรุงศรีอยุธยา (BAY)</option>
                <option value="ttb">ทหารไทยธนชาต (TTB)</option>
                <option value="gsb">ออมสิน (GSB)</option>
                <option value="baac">ธ.ก.ส. (BAAC)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 opacity-80">เลขที่บัญชี</label>
              <input
                required type="text" name="accountNumber"
                value={formData.accountNumber} onChange={handleInputChange}
                className={inputClass} placeholder="012-3-45678-9"
              />
            </div>
          </div>

          <hr className="border-gray-200 dark:border-gray-700 my-2" />
          <h2 className="text-xl font-semibold mb-4">เอกสารแนบ</h2>

          <div className="space-y-4">
            {[
              {
                label: `อัปโหลดรูปบัตรประชาชน${type === 'corporate' ? ' / หนังสือรับรองบริษัท' : ''}`,
              },
              { label: 'อัปโหลดรูปหน้าสมุดบัญชีธนาคาร' },
            ].map(({ label }) => (
              <div
                key={label}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm font-medium mb-1">{label}</p>
                <p className="text-xs text-gray-500 mb-4">รองรับ JPG, PNG ขนาดไม่เกิน 5MB</p>
                <input
                  type="file" required accept="image/*"
                  className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            ))}
          </div>

          <button
            type="submit" disabled={saving}
            className="w-full mt-8 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-4 rounded-xl font-medium transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            {saving
              ? 'กำลังตรวจสอบและบันทึก...'
              : <> บันทึกและไปหน้าหลัก <ArrowRight className="w-5 h-5" /> </>}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Register() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">กำลังโหลด...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
