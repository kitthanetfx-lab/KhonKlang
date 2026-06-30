'use client';

export interface CartItem {
  dealId: string;
  title: string;
  price: number;
  imageUrl: string;
  sellerName: string;
  location: string;
  quantity: number;
}

const CART_STORAGE_KEY = 'khonklang.market.cart';

function readCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) as CartItem[] : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('khonklang-cart-updated'));
}

export function getCartItems() {
  return readCart();
}

export function getCartCount() {
  return readCart().reduce((sum, item) => sum + item.quantity, 0);
}

export function addToCart(item: Omit<CartItem, 'quantity'>, quantity = 1) {
  const cart = readCart();
  const idx = cart.findIndex(entry => entry.dealId === item.dealId);
  if (idx >= 0) {
    cart[idx] = { ...cart[idx], quantity: cart[idx].quantity + quantity };
  } else {
    cart.push({ ...item, quantity });
  }
  writeCart(cart);
}

export function updateCartQuantity(dealId: string, quantity: number) {
  const cart = readCart()
    .map(item => item.dealId === dealId ? { ...item, quantity } : item)
    .filter(item => item.quantity > 0);
  writeCart(cart);
}

export function removeFromCart(dealId: string) {
  writeCart(readCart().filter(item => item.dealId !== dealId));
}

export function clearCart() {
  writeCart([]);
}
