"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import type { ApiResult } from "@/admin/lib/menu/api";
import {
  addToCart,
  clearCart,
  getCart,
  removeCartLine,
  setCartQuantity,
} from "@/lib/actions/cart.actions";
import {
  CART_KEY,
  EMPTY_CART,
  requestSignIn,
  withQuantity,
  type AddToCartInput,
  type Cart,
} from "@/lib/cart";

export class CartError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function unwrap(promise: Promise<ApiResult<Cart>>): Promise<Cart> {
  const result = await promise;
  if (!result.ok) throw new CartError(result.message, result.status);
  return result.data;
}

const MUTATION_KEY = ["cart", "change"] as const;

export function useCart(enabled = true) {
  return useQuery({
    queryKey: CART_KEY,
    queryFn: () => unwrap(getCart()),
    enabled,
    staleTime: 30_000,
    retry: (count, error) =>
      !(error instanceof CartError && error.status < 500) && count < 2,
  });
}

export function useCartChanges() {
  const client = useQueryClient();

  const settle = (cart: Cart) => {
    if (client.isMutating({ mutationKey: MUTATION_KEY }) <= 1)
      client.setQueryData(CART_KEY, cart);
  };
  const optimistic = async (change: (cart: Cart) => Cart) => {
    await client.cancelQueries({ queryKey: CART_KEY });
    const before = client.getQueryData<Cart>(CART_KEY);
    if (before) client.setQueryData(CART_KEY, change(before));
    return { before };
  };
  const rollback = (
    error: Error,
    _variables: unknown,
    snapshot?: { before?: Cart },
  ) => {
    if (snapshot?.before) client.setQueryData(CART_KEY, snapshot.before);
    void client.invalidateQueries({ queryKey: CART_KEY });
    toast.add({
      title: "Your cart didn't change",
      description: error.message,
      type: "error",
    });
  };

  const quantity = useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: ({ lineId, quantity }: { lineId: string; quantity: number }) =>
      unwrap(setCartQuantity(lineId, quantity)),
    onMutate: ({ lineId, quantity }) =>
      optimistic((cart) => withQuantity(cart, lineId, quantity)),
    onSuccess: settle,
    onError: rollback,
  });

  const remove = useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: (lineId: string) => unwrap(removeCartLine(lineId)),
    onMutate: (lineId) => optimistic((cart) => withQuantity(cart, lineId, 0)),
    onSuccess: settle,
    onError: rollback,
  });

  const clear = useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: () => unwrap(clearCart()),
    onMutate: () => optimistic(() => EMPTY_CART),
    onSuccess: settle,
    onError: rollback,
  });

  return { quantity, remove, clear };
}

export function useAddToCart({
  onAdded,
  onSignedOut,
}: {
  onAdded?: (cart: Cart) => void;
  onSignedOut?: (input: AddToCartInput & { name: string }) => boolean;
} = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      variantId,
      optionIds,
      quantity,
      note,
    }: AddToCartInput & { name: string }) =>
      unwrap(addToCart({ itemId, variantId, optionIds, quantity, note })),
    onSuccess: (cart, input) => {
      client.setQueryData(CART_KEY, cart);
      onAdded?.(cart);
      toast.add({
        title: `${input.quantity > 1 ? `${input.quantity} × ` : ""}${input.name} added`,
        type: "success",
      });
    },
    onError: (error, input) => {
      if (error instanceof CartError && error.status === 401) {
        if (onSignedOut?.(input)) return;
        requestSignIn();
        toast.add({
          title: "Sign in to order",
          description:
            "Your order is saved to your account, so it follows you to any device.",
          type: "info",
        });
        return;
      }
      toast.add({
        title: "Couldn't add this dish",
        description: error.message,
        type: "error",
      });
    },
  });
}
