export interface VariantInput {
  name: string;
  price: number;
  isDefault?: boolean;
  isAvailable?: boolean;
}

export interface ModifierOptionInput {
  name: string;
  priceDelta: number;
  isDefault?: boolean;
  isAvailable?: boolean;
}

export interface ModifierGroupInput {
  name: string;
  minSelect: number;
  maxSelect: number;
  options: ModifierOptionInput[];
}

export interface MenuItemRulesInput {
  price?: number;
  compareAtPrice?: number | null;
  variants: VariantInput[];
  modifierGroups: ModifierGroupInput[];
}

export interface RuleIssue {
  path: string;
  message: string;
}

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

const duplicates = (names: string[]) =>
  names.filter(
    (name, i) => names.findIndex((other) => sameName(other, name)) !== i,
  );

export function checkMenuItem(item: MenuItemRulesInput): {
  issues: RuleIssue[];
  price: number | undefined;
} {
  const issues: RuleIssue[] = [];
  let price = item.price;

  if (item.variants.length > 0) {
    if (item.variants.length === 1) {
      issues.push({
        path: 'variants',
        message: 'Use at least 2 variants, or none (set the price on the dish)',
      });
    }
    for (const name of duplicates(item.variants.map((v) => v.name))) {
      issues.push({
        path: 'variants',
        message: `Variant "${name}" appears twice`,
      });
    }
    const defaults = item.variants.filter((v) => v.isDefault).length;
    if (defaults > 1)
      issues.push({
        path: 'variants',
        message: 'Only one variant can be the default',
      });

    price = Math.min(...item.variants.map((v) => v.price));
  } else if (price === undefined || price === null) {
    issues.push({
      path: 'price',
      message: 'A dish without variants needs a price',
    });
  }

  if (
    item.compareAtPrice != null &&
    price !== undefined &&
    item.compareAtPrice <= price
  ) {
    issues.push({
      path: 'compareAtPrice',
      message: 'compareAtPrice must be higher than the price',
    });
  }

  for (const name of duplicates(item.modifierGroups.map((g) => g.name))) {
    issues.push({
      path: 'modifierGroups',
      message: `Group "${name}" appears twice`,
    });
  }
  item.modifierGroups.forEach((group, i) => {
    const at = `modifierGroups.${i}`;
    const count = group.options.length;

    if (count === 0)
      issues.push({
        path: `${at}.options`,
        message: `"${group.name}" needs at least one option`,
      });
    if (group.minSelect > group.maxSelect) {
      issues.push({
        path: `${at}.minSelect`,
        message: `"${group.name}": minSelect cannot be above maxSelect`,
      });
    }
    if (count > 0 && group.maxSelect > count) {
      issues.push({
        path: `${at}.maxSelect`,
        message: `"${group.name}": maxSelect (${group.maxSelect}) is more than its ${count} options`,
      });
    }
    if (
      count > 0 &&
      group.minSelect >
        group.options.filter((o) => o.isAvailable !== false).length
    ) {
      issues.push({
        path: `${at}.minSelect`,
        message: `"${group.name}" requires more choices than there are available options`,
      });
    }
    for (const name of duplicates(group.options.map((o) => o.name))) {
      issues.push({
        path: `${at}.options`,
        message: `"${group.name}": option "${name}" appears twice`,
      });
    }
    if (group.options.filter((o) => o.isDefault).length > group.maxSelect) {
      issues.push({
        path: `${at}.options`,
        message: `"${group.name}": more default options than maxSelect allows`,
      });
    }
  });

  return { issues, price };
}
