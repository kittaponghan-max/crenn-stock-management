export interface SourcingOption {
  id: string;
  source_name: string;
  price: number;
  qty: number;
  unit: string;
  is_default: boolean;
}

export interface ProdcalcIngredientPrice {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  ingredient_brand: string;
  ingredient_unit: string;
  image?: string;
  category?: string;
  yield_pct: number;
  sourcing: SourcingOption[];
  effective_cost_per_unit: number;
  branch: string;
  updated_at?: string;
  created_at?: string;
}

export interface RecipeIngredientItem {
  id: string;
  ingredient_price_id: string;
  ingredient_name: string;
  qty: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
}

export interface RecipeLaborItem {
  id: string;
  description: string;
  hours: number;
  rate_per_hour: number;
  total_cost: number;
}

export interface RecipeOtherItem {
  id: string;
  description: string;
  qty: number;
  unit_cost: number;
  total_cost: number;
}

export type PricingMethod = 'margin_pct' | 'profit_thb' | 'fixed_price' | 'discount_price' | 'net_price';

export interface Recipe {
  id: string;
  code: string;
  name: string;
  category: string;
  image?: string;
  yield_qty: number; // ผลิตได้กี่ชิ้นต่อสูตร
  serving_qty: number; // ขายครั้งละกี่ชิ้น
  ingredients_cost: number;
  labor_cost: number;
  other_cost: number;
  total_batch_cost: number;
  cost_per_piece: number;
  pricing_method: PricingMethod;
  target_margin_pct: number;
  target_profit_thb: number;
  selling_price: number;
  discount_pct: number;
  vat_pct: number;
  profit_per_piece: number;
  profit_pct: number;
  branch: string;
  ingredients: RecipeIngredientItem[];
  labor: RecipeLaborItem[];
  other: RecipeOtherItem[];
  created_at?: string;
  updated_at?: string;
}

export const PRODCALC_CATEGORIES = [
  'เบเกอรี่ (Bakery)',
  'เค้กและขนมหวาน (Cake & Dessert)',
  'เครื่องดื่มกาแฟ (Coffee)',
  'เครื่องดื่มไม่ใช่กาแฟ (Non-Coffee)',
  'อาหารและของทานเล่น (Food & Snacks)',
  'สินค้าพรีเมียม / จัดชุด (Set & Hampers)',
  'อื่นๆ (Others)'
];
