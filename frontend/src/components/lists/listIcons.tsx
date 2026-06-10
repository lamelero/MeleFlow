import type { ComponentType, SVGProps } from "react";
import {
  Pencil, ShoppingCart, Briefcase, Home, Flame, BookOpen, Music,
  Globe, Monitor, Paintbrush, Wrench, Calendar, Star, TrendingUp,
  Lightbulb, Crosshair, Trophy, Box, Gift, Sun, Truck, DollarSign,
  GraduationCap, Leaf, Heart, Clapperboard, Cake, Gamepad2,
  Dumbbell, Coffee, Dog, Cat, Plane, Car, Bike, Anchor,
  Phone, Camera, Palette, Waves, Cloud, Moon, Zap,
  Smile, Frown, Meh, ThumbsUp, ThumbsDown,
} from "lucide-react";

export interface ListIconDef {
  name: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const LIST_ICONS: ListIconDef[] = [
  // Original 28 icons (preserving names for backward compat)
  { name: "pencil", icon: Pencil },
  { name: "shopping-cart", icon: ShoppingCart },
  { name: "briefcase", icon: Briefcase },
  { name: "home", icon: Home },
  { name: "fire", icon: Flame },
  { name: "book-open", icon: BookOpen },
  { name: "musical-note", icon: Music },
  { name: "globe-alt", icon: Globe },
  { name: "computer", icon: Monitor },
  { name: "paint-brush", icon: Paintbrush },
  { name: "wrench", icon: Wrench },
  { name: "calendar", icon: Calendar },
  { name: "star", icon: Star },
  { name: "trending-up", icon: TrendingUp },
  { name: "light-bulb", icon: Lightbulb },
  { name: "target", icon: Crosshair },
  { name: "trophy", icon: Trophy },
  { name: "cube", icon: Box },
  { name: "gift", icon: Gift },
  { name: "sun", icon: Sun },
  { name: "truck", icon: Truck },
  { name: "currency-dollar", icon: DollarSign },
  { name: "academic-cap", icon: GraduationCap },
  { name: "leaf", icon: Leaf },
  { name: "heart", icon: Heart },
  { name: "film", icon: Clapperboard },
  { name: "cake", icon: Cake },
  { name: "controller", icon: Gamepad2 },
  // New icons (48 total)
  { name: "dumbbell", icon: Dumbbell },
  { name: "coffee", icon: Coffee },
  { name: "dog", icon: Dog },
  { name: "cat", icon: Cat },
  { name: "plane", icon: Plane },
  { name: "car", icon: Car },
  { name: "bike", icon: Bike },
  { name: "anchor", icon: Anchor },
  { name: "phone", icon: Phone },
  { name: "camera", icon: Camera },
  { name: "palette", icon: Palette },
  { name: "waves", icon: Waves },
  { name: "cloud", icon: Cloud },
  { name: "moon", icon: Moon },
  { name: "zap", icon: Zap },
  { name: "smile", icon: Smile },
  { name: "frown", icon: Frown },
  { name: "meh", icon: Meh },
  { name: "thumbs-up", icon: ThumbsUp },
  { name: "thumbs-down", icon: ThumbsDown },
];

export function ListIcon({
  name,
  className = "h-4 w-4",
}: {
  name: string;
  className?: string;
}) {
  const def = LIST_ICONS.find((i) => i.name === name);
  if (!def) return null;
  const Icon = def.icon;
  return <Icon className={className} />;
}
