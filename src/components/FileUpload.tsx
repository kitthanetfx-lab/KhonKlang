'use client';
import React, { useEffect, useMemo } from 'react';
import { CheckCircle2, Upload, FileText, X } from 'lucide-react';

/**
 * ช่องอัปโหลดไฟล์พร้อมพรีวิวรูปภาพ — ใช้ร่วมกันในฟอร์มสมัคร seller / middleman
 * เลือกรูปแล้วเห็นรูปทันที (ไม่ใช่แค่ชื่อไฟล์) / PDF แสดงไอคอนเอกสาร
 */
export function FileUpload({ label, accept, file, onChange, hint, required }: {
  label: string; accept: string; file: File | null;
  onChange: (f: File | null) => void; hint?: string; required?: boolean;
}) {
  const previewUrl = useMemo(() => (
    file && file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
  ), [file]);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const sizeText = file ? (file.size >= 1024 * 1024
    ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(file.size / 1024))} KB`) : '';

  return (
    <div>
      <label className="block text-sm font-medium mb-1.5 opacity-75">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <label className="relative flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50/20 dark:hover:bg-blue-900/10 transition-all">
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={e => { onChange(e.target.files?.[0] ?? null); e.target.value = ''; }}
        />
        {file ? (
          <div className="w-full flex flex-col items-center gap-2.5">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={`พรีวิว ${label}`}
                className="max-h-48 w-auto max-w-full rounded-lg object-contain shadow-sm border border-gray-200 dark:border-gray-700"
              />
            ) : (
              <FileText className="w-10 h-10 text-gray-400" />
            )}
            <div className="flex items-center gap-2 text-green-600 max-w-full">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium truncate max-w-[200px]">{file.name}</span>
              <span className="text-xs text-gray-400 shrink-0">({sizeText})</span>
            </div>
            <span className="text-xs text-gray-400">แตะเพื่อเปลี่ยนไฟล์</span>
            <button
              type="button"
              aria-label={`ลบไฟล์ ${label}`}
              onClick={e => { e.preventDefault(); e.stopPropagation(); onChange(null); }}
              className="absolute top-2 right-2 w-7 h-7 grid place-items-center rounded-full bg-gray-100 hover:bg-red-50 hover:text-red-500 text-gray-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="text-center text-gray-400 py-1">
            <Upload className="w-6 h-6 mx-auto mb-1.5" />
            <p className="text-sm">คลิกเพื่อเลือกไฟล์</p>
            {hint && <p className="text-xs mt-0.5">{hint}</p>}
          </div>
        )}
      </label>
    </div>
  );
}

export default FileUpload;
