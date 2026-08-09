import { PROVINCE_NAMES } from '@/lib/provinceGeo';

export interface ProfileAddressFields {
  houseNo: string;
  moo: string;
  road: string;
  provinceName: string;
  amphoreName: string;
  tambonName: string;
  postalCode: string;
}

export const EMPTY_PROFILE_ADDRESS: ProfileAddressFields = {
  houseNo: '',
  moo: '',
  road: '',
  provinceName: '',
  amphoreName: '',
  tambonName: '',
  postalCode: '',
};

export function parseProfileAddress(addr: string): ProfileAddressFields {
  const postalM = addr.match(/\b(\d{5})\b/);
  const roadM = addr.match(/ถ\.(\S+)/);
  const mooM = addr.match(/หมู่(?:ที่)?\s*(\d+)/);
  const amphoeM = addr.match(/อ\.(\S+)/);
  const tambonM = addr.match(/ต\.(\S+)/);
  const firstTok = addr.trim().split(/\s+/)[0];
  return {
    houseNo: (firstTok && /^[\d/]/.test(firstTok)) ? firstTok : '',
    moo: mooM ? mooM[1] : '',
    road: roadM ? roadM[1] : '',
    provinceName: PROVINCE_NAMES.find(p => addr.includes(p)) || '',
    amphoreName: amphoeM ? amphoeM[1] : '',
    tambonName: tambonM ? tambonM[1] : '',
    postalCode: postalM ? postalM[1] : '',
  };
}

export function buildProfileAddress(f: ProfileAddressFields): string {
  return [
    f.houseNo,
    f.moo ? `หมู่ ${f.moo}` : '',
    f.road ? `ถ.${f.road}` : '',
    f.tambonName ? `ต.${f.tambonName}` : '',
    f.amphoreName ? `อ.${f.amphoreName}` : '',
    f.provinceName ? `จ.${f.provinceName}` : '',
    f.postalCode,
  ].filter(Boolean).join(' ');
}

export function isShippingAddressComplete(phone: string, addr: ProfileAddressFields): boolean {
  return !!(
    phone.trim()
    && addr.houseNo.trim()
    && addr.provinceName
    && addr.amphoreName
    && addr.tambonName
  );
}
