import {
  Award,
  Beef,
  Beer,
  CakeSlice,
  ChefHat,
  Clock,
  Coffee,
  Croissant,
  Egg,
  Fish,
  Flame,
  Heart,
  Leaf,
  MapPin,
  Pizza,
  Recycle,
  Salad,
  Soup,
  Sparkles,
  Sprout,
  Star,
  Users,
  Utensils,
  UtensilsCrossed,
  Wheat,
  Wine,
  type LucideIcon,
} from "lucide-react";
import type { IconName } from "@/constants/icon-names";

const ICONS: Record<IconName, LucideIcon> = {
  leaf: Leaf,
  flame: Flame,
  heart: Heart,
  utensils: Utensils,
  "utensils-crossed": UtensilsCrossed,
  wine: Wine,
  "chef-hat": ChefHat,
  wheat: Wheat,
  fish: Fish,
  coffee: Coffee,
  sprout: Sprout,
  star: Star,
  award: Award,
  "map-pin": MapPin,
  clock: Clock,
  users: Users,
  sparkles: Sparkles,
  "cake-slice": CakeSlice,
  croissant: Croissant,
  egg: Egg,
  salad: Salad,
  soup: Soup,
  beef: Beef,
  pizza: Pizza,
  beer: Beer,
  recycle: Recycle,
};

export function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const Component = ICONS[name];
  return <Component aria-hidden="true" className={className} />;
}
