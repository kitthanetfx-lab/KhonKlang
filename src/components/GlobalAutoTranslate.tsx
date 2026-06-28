'use client';

import { useEffect } from 'react';
import { useAppPreferences } from './AppPreferences';
import { translateText } from '@/lib/autoTranslate';

const textNodeCache = new WeakMap<Text, string>();
const attrCache = new WeakMap<Element, Map<string, string>>();

function shouldSkipElement(el: Element | null): boolean {
  if (!el) return true;
  const tag = el.tagName;
  if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'SVG', 'PATH', 'CODE', 'PRE'].includes(tag)) return true;
  return !!el.closest('[data-no-auto-translate="true"]');
}

function setAttrOriginal(el: Element, attr: string, value: string) {
  let map = attrCache.get(el);
  if (!map) {
    map = new Map<string, string>();
    attrCache.set(el, map);
  }
  if (!map.has(attr)) map.set(attr, value);
}

function processElement(el: Element, locale: 'th' | 'en') {
  if (shouldSkipElement(el)) return;

  const attrs = ['placeholder', 'title', 'aria-label', 'alt'];
  for (const attr of attrs) {
    if (!el.hasAttribute(attr)) continue;
    const current = el.getAttribute(attr) || '';
    if (locale === 'en') {
      setAttrOriginal(el, attr, current);
      el.setAttribute(attr, translateText(current, locale));
    } else {
      const original = attrCache.get(el)?.get(attr);
      if (typeof original === 'string') el.setAttribute(attr, original);
    }
  }

  if (el instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(el.type)) {
    const current = el.value || '';
    if (locale === 'en') {
      setAttrOriginal(el, 'value', current);
      el.value = translateText(current, locale);
    } else {
      const original = attrCache.get(el)?.get('value');
      if (typeof original === 'string') el.value = original;
    }
  }

  if (el.tagName === 'OPTION') {
    const option = el as HTMLOptionElement;
    const current = option.text;
    if (locale === 'en') {
      if (!option.dataset.kkOriginalText) option.dataset.kkOriginalText = current;
      option.text = translateText(current, locale);
    } else if (option.dataset.kkOriginalText) {
      option.text = option.dataset.kkOriginalText;
    }
  }
}

function processTextNode(node: Text, locale: 'th' | 'en') {
  const parent = node.parentElement;
  if (shouldSkipElement(parent)) return;
  const current = node.nodeValue || '';
  if (!current.trim()) return;
  if (locale === 'en') {
    if (!textNodeCache.has(node)) textNodeCache.set(node, current);
    node.nodeValue = translateText(current, locale);
  } else if (textNodeCache.has(node)) {
    node.nodeValue = textNodeCache.get(node) || current;
  }
}

function processSubtree(root: Node, locale: 'th' | 'en') {
  if (root.nodeType === Node.TEXT_NODE) {
    processTextNode(root as Text, locale);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;

  const element = root as Element;
  processElement(element, locale);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let current: Node | null = walker.currentNode;
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) processTextNode(current as Text, locale);
    if (current.nodeType === Node.ELEMENT_NODE) processElement(current as Element, locale);
    current = walker.nextNode();
  }
}

export function GlobalAutoTranslate() {
  const { locale } = useAppPreferences();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const originalTitle = document.title;
    document.title = locale === 'en' ? translateText(originalTitle, locale) : originalTitle;
    processSubtree(document.body, locale);

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          processTextNode(mutation.target as Text, locale);
          continue;
        }
        mutation.addedNodes.forEach(node => processSubtree(node, locale));
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    const originalAlert = window.alert;
    const originalConfirm = window.confirm;
    const originalPrompt = window.prompt;

    window.alert = (message?: unknown) => originalAlert(typeof message === 'string' ? translateText(message, locale) : message as any);
    window.confirm = (message?: string) => originalConfirm(typeof message === 'string' ? translateText(message, locale) : message);
    window.prompt = (message?: string, defaultValue?: string) =>
      originalPrompt(typeof message === 'string' ? translateText(message, locale) : message, defaultValue);

    return () => {
      observer.disconnect();
      window.alert = originalAlert;
      window.confirm = originalConfirm;
      window.prompt = originalPrompt;
      document.title = originalTitle;
    };
  }, [locale]);

  return null;
}

export default GlobalAutoTranslate;
