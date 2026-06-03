'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function Register() {
  const router = useRouter();
  const [type, setType] = useState<'individual' | 'corporate'>('individual');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    bankAccountName: '',
    bankName: '',
    accountNumber: '',
  });
  
  const [validationError, setValidationError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear validation error when user types
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateNames()) return;
    
    // In a real app, we would upload files to Appwrite Storage and insert data to the database here
    router.push('/payment');
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto glass-panel rounded-2xl p-6 sm:p-10 animate-fade-in shadow-xl">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-gray-900 dark:text-white">ข้อมูลผู้ขาย</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-8">กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้องเพื่อประโยชน์ของท่าน</p>

        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-8">
          <button
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              type === 'individual' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
            onClick={() => setType('individual')}
          >
            บุคคลธรรมดา
          </button>
          <button
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              type === 'corporate' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
            onClick={() => setType('corporate')}
          >
            นิติบุคคล
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2 opacity-80">ชื่อจริง (ไม่ต้องใส่คำนำหน้า)</label>
              <input
                required
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                className="w-full bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="เช่น สมชาย"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 opacity-80">นามสกุล</label>
              <input
                required
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                className="w-full bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="เช่น ใจดี"
              />
            </div>
          </div>

          {type === 'corporate' && (
            <div>
              <label className="block text-sm font-medium mb-2 opacity-80">ชื่อบริษัท / ห้างหุ้นส่วนจำกัด</label>
              <input
                required
                type="text"
                className="w-full bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="บริษัท ตัวอย่าง จำกัด"
              />
            </div>
          )}

          <hr className="border-gray-200 dark:border-gray-700 my-8" />
          
          <h2 className="text-xl font-semibold mb-4">ข้อมูลบัญชีธนาคาร (สำหรับรับเงิน)</h2>

          <div>
            <label className="block text-sm font-medium mb-2 opacity-80">ชื่อบัญชีธนาคาร</label>
            <input
              required
              type="text"
              name="bankAccountName"
              value={formData.bankAccountName}
              onChange={handleInputChange}
              onBlur={validateNames}
              className={`w-full bg-white/50 dark:bg-gray-900/50 border ${validationError ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 dark:border-gray-700 focus:ring-blue-500'} rounded-xl px-4 py-3 outline-none focus:ring-2 transition-all`}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2 opacity-80">ธนาคาร</label>
              <select 
                required
                className="w-full bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              >
                <option value="">เลือกธนาคาร...</option>
                <option value="kbank">กสิกรไทย (KBANK)</option>
                <option value="scb">ไทยพาณิชย์ (SCB)</option>
                <option value="bbl">กรุงเทพ (BBL)</option>
                <option value="ktb">กรุงไทย (KTB)</option>
                <option value="krungsri">กรุงศรีอยุธยา (BAY)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 opacity-80">เลขที่บัญชี</label>
              <input
                required
                type="text"
                className="w-full bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="012-3-45678-9"
              />
            </div>
          </div>

          <hr className="border-gray-200 dark:border-gray-700 my-8" />

          <h2 className="text-xl font-semibold mb-4">เอกสารแนบ</h2>
          
          <div className="space-y-6">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm font-medium mb-1">อัปโหลดรูปบัตรประชาชน{type === 'corporate' ? ' / หนังสือรับรองบริษัท' : ''}</p>
              <p className="text-xs text-gray-500 mb-4">รองรับ JPG, PNG ขนาดไม่เกิน 5MB</p>
              <input type="file" required accept="image/*" className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            </div>

            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm font-medium mb-1">อัปโหลดรูปหน้าสมุดบัญชีธนาคาร</p>
              <p className="text-xs text-gray-500 mb-4">ต้องเห็นชื่อบัญชีและเลขที่บัญชีชัดเจน</p>
              <input type="file" required accept="image/*" className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-medium transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            ดำเนินการต่อ <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
