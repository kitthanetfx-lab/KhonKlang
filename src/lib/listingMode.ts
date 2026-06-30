export interface ListingModeState {
  direct: boolean;
  escrow: boolean;
  chat: boolean;
  certified: boolean;
}

export const DEFAULT_LISTING_MODE: ListingModeState = {
  direct: true,
  escrow: true,
  chat: true,
  certified: false,
};

export function parseListingMode(mode: string | null | undefined): ListingModeState {
  if (!mode || mode === 'normal') return { ...DEFAULT_LISTING_MODE };
  if (mode === 'certified') return { ...DEFAULT_LISTING_MODE, certified: true };

  const tokens = new Set(
    String(mode)
      .split(',')
      .map(token => token.trim())
      .filter(Boolean),
  );

  return {
    direct: tokens.has('direct'),
    escrow: tokens.has('escrow') || tokens.has('certified'),
    chat: tokens.has('chat'),
    certified: tokens.has('certified'),
  };
}

export function serializeListingMode(state: ListingModeState): string {
  const tokens = [
    state.direct ? 'direct' : '',
    state.escrow ? 'escrow' : '',
    state.chat ? 'chat' : '',
    state.certified ? 'certified' : '',
  ].filter(Boolean);

  return tokens.join(',');
}

export function isCertifiedMode(mode: string | null | undefined) {
  return parseListingMode(mode).certified;
}

export function supportsDirectPurchase(mode: string | null | undefined) {
  return parseListingMode(mode).direct;
}

export function supportsEscrowPurchase(mode: string | null | undefined) {
  return parseListingMode(mode).escrow;
}

export function supportsSellerChat(mode: string | null | undefined) {
  return parseListingMode(mode).chat;
}
