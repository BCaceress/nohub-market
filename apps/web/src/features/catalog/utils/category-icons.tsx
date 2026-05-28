import {
  Apple,
  Baby,
  Banana,
  Beef,
  Beer,
  Briefcase,
  Cake,
  Candy,
  Car,
  Carrot,
  Coffee,
  Cookie,
  CupSoda,
  Dumbbell,
  Egg,
  Fish,
  Flame,
  FlaskConical,
  Gift,
  GlassWater,
  Grape,
  Heart,
  Home,
  IceCream,
  Leaf,
  Milk,
  Package,
  Palette,
  Pizza,
  Salad,
  Sandwich,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Star,
  Tag,
  TrendingUp,
  Utensils,
  Wheat,
  Wine,
  Zap,
} from "lucide-react";

export type IconDefinition = {
  id: string;
  label: string;
  Component: React.ElementType;
};

export const ICON_OPTIONS: IconDefinition[] = [
  { id: "beer", label: "Cervejas", Component: Beer },
  { id: "wine", label: "Vinhos", Component: Wine },
  { id: "coffee", label: "Café / quentes", Component: Coffee },
  { id: "milk", label: "Laticínios / leite", Component: Milk },
  { id: "cup-soda", label: "Refrigerantes / sucos", Component: CupSoda },
  { id: "glass-water", label: "Água / bebidas", Component: GlassWater },
  { id: "apple", label: "Frutas", Component: Apple },
  { id: "banana", label: "Frutas tropicais", Component: Banana },
  { id: "grape", label: "Uvas / vitivinícola", Component: Grape },
  { id: "carrot", label: "Hortifruti", Component: Carrot },
  { id: "salad", label: "Saladas / naturais", Component: Salad },
  { id: "leaf", label: "Orgânicos / natural", Component: Leaf },
  { id: "beef", label: "Carnes / açougue", Component: Beef },
  { id: "fish", label: "Pescados", Component: Fish },
  { id: "egg", label: "Ovos", Component: Egg },
  { id: "utensils", label: "Gastronomia / restaurante", Component: Utensils },
  { id: "flame", label: "Grelhados / churrasco", Component: Flame },
  { id: "wheat", label: "Padaria / grãos", Component: Wheat },
  { id: "sandwich", label: "Lanches / padaria", Component: Sandwich },
  { id: "pizza", label: "Pizzas / fastfood", Component: Pizza },
  { id: "cake", label: "Bolos / confeitaria", Component: Cake },
  { id: "cookie", label: "Biscoitos / snacks", Component: Cookie },
  { id: "candy", label: "Doces / confeitaria", Component: Candy },
  { id: "ice-cream", label: "Sorvetes / gelados", Component: IceCream },
  { id: "shopping-cart", label: "Mercearia", Component: ShoppingCart },
  { id: "shopping-bag", label: "Sacola / geral", Component: ShoppingBag },
  { id: "package", label: "Estoque / geral", Component: Package },
  { id: "tag", label: "Promoções / ofertas", Component: Tag },
  { id: "home", label: "Casa / limpeza", Component: Home },
  { id: "flask-conical", label: "Limpeza / químicos", Component: FlaskConical },
  { id: "heart", label: "Saúde / farmácia", Component: Heart },
  { id: "baby", label: "Bebê / infantil", Component: Baby },
  { id: "dumbbell", label: "Fitness / esporte", Component: Dumbbell },
  { id: "car", label: "Automotivo", Component: Car },
  { id: "star", label: "Premium / destaque", Component: Star },
  { id: "gift", label: "Presentes", Component: Gift },
  { id: "zap", label: "Promoção / energéticos", Component: Zap },
  { id: "trending-up", label: "Eletrônicos / tech", Component: TrendingUp },
  { id: "briefcase", label: "Profissional / negócios", Component: Briefcase },
  { id: "palette", label: "Arte / criatividade", Component: Palette },
  { id: "shield", label: "Proteção / segurança", Component: Shield },
];

/** Render a category icon component by its string ID. Falls back to fallback. */
export function CategoryIcon({
  iconId,
  color,
  className,
}: {
  iconId: string | null | undefined;
  color?: string | null;
  className?: string;
}) {
  if (!iconId) return null;
  const def = ICON_OPTIONS.find((o) => o.id === iconId);
  if (!def) return null;
  return (
    <def.Component className={className ?? "h-3.5 w-3.5"} style={color ? { color } : undefined} />
  );
}
