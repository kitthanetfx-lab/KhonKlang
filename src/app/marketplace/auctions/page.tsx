import { redirect } from 'next/navigation';

export default function MarketplaceAuctionsRedirect() {
  redirect('/marketplace?zone=auction');
}
