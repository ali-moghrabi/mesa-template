"use client";

import QueryWrapper from "@/components/providers/query-wrapper";
import { CartButton } from "@/components/cart/CartButton";
import UserDropMenu from "@/components/shared/UserDropMenu";
import type { CurrencyConfig } from "@/lib/menu/money";

export default function SignedInControls({
  user,
  orderingEnabled,
  reservationsEnabled,
  currency,
  pricingNote,
}: {
  user: IUser;
  orderingEnabled: boolean;
  reservationsEnabled: boolean;
  currency: CurrencyConfig;
  pricingNote?: string;
}) {
  return (
    <QueryWrapper>
      {orderingEnabled && (
        <CartButton currency={currency} pricingNote={pricingNote} />
      )}
      <UserDropMenu
        user={user}
        reservationsEnabled={reservationsEnabled}
        orderingEnabled={orderingEnabled}
      />
    </QueryWrapper>
  );
}
