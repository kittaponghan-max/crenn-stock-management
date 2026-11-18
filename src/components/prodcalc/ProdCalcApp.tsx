import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { sendDiscordNotification } from '../../lib/discordNotify';
import { PagePermission } from '../../utils/permissions';
import { Recipe, ProdcalcIngredientPrice } from '../../types/prodcalc';
import { IngredientPricing } from './IngredientPricing';
import { RecipeList } from './RecipeList';
import { RecipeEditor } from './RecipeEditor';
import { CostReport } from './CostReport';
import {
  FlaskConical,
  BookOpen,
  BarChart2,
  Coffee,
  ChevronDown,
  ChevronRight,
  Loader2
} from 'lucide-react';

interface ProdCalcAppProps {
  currentUser: {
    name: string;
    role: string;
    branch: string;
  };
  onSwitchToCafe: () => void;
  onSwitchToHelloCrenn?: () => void;
  onSwitchToLeavePortal?: () => void;
  onLogout: () => void;
  isReadOnly?: boolean;
  tabPermissions?: {
    ingredients: PagePermission;
    recipes: PagePermission;
    reports: PagePermission;
  };
}

export function ProdCalcApp({
  currentUser,
  onSwitchToCafe,
  onSwitchToHelloCrenn,
  onSwitchToLeavePortal,
  onLogout,
  isReadOnly = false,
  tabPermissions,
}: ProdCalcAppProps) {
  const effectivePerms = {
    ingredients: tabPermissions?.ingredients ?? 'edit',
    recipes: tabPermissions?.recipes ?? 'edit',
    reports: tabPermissions?.reports ?? 'edit',
  };

  // Navigation tabs: 'ingredients' | 'recipes' | 'recipeEditor' | 'reports'
  const [currentTab, setCurrentTab] = useState<'ingredients' | 'recipes' | 'recipeEditor' | 'reports'>(() => {
    if (effectivePerms.recipes !== 'hidden') return 'recipes';
    if (effectivePerms.ingredients !== 'hidden') return 'ingredients';
    return 'reports';
  });

  useEffect(() => {
    if (currentTab === 'ingredients' && effectivePerms.ingredients === 'hidden') {
      setCurrentTab(effectivePerms.recipes !== 'hidden' ? 'recipes' : 'reports');
    } else if ((currentTab === 'recipes' || currentTab === 'recipeEditor') && effectivePerms.recipes === 'hidden') {
      setEditingRecipe(null);
      setCurrentTab(effectivePerms.ingredients !== 'hidden' ? 'ingredients' : 'reports');
    } else if (currentTab === 'reports' && effectivePerms.reports === 'hidden') {
      setCurrentTab(effectivePerms.recipes !== 'hidden' ? 'recipes' : 'ingredients');
    }
  }, [currentTab, effectivePerms.ingredients, effectivePerms.recipes, effectivePerms.reports]);

  // Recipe editing state
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  // Supabase connection indicator & user dropdown menu state
  const [dbStatus, setDbStatus] = useState<'connected' | 'checking' | 'offline'>(supabase ? 'checking' : 'offline');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserMenuOpen(false);
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userMenuOpen]);

  // Stored recipes
  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    try {
      const saved = localStorage.getItem(`prodcalc-recipes-${currentUser.branch}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    // Initial sample recipes to showcase calculations
    return [
      {
        id: 'r-sample-1',
        code: 'REC-101',
        name: 'ข้าวเหนียวมะม่วงพรีเมียม (Mango Sticky Rice)',
        category: 'เค้กและขนมหวาน (Cake & Dessert)',
        image: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&w=400&q=80',
        yield_qty: 20,
        serving_qty: 1,
        ingredients_cost: 320,
        labor_cost: 100,
        other_cost: 48,
        total_batch_cost: 468,
        cost_per_piece: 23.40,
        pricing_method: 'margin_pct',
        target_margin_pct: 53.2,
        target_profit_thb: 26.60,
        selling_price: 50.00,
        discount_pct: 0,
        vat_pct: 0,
        profit_per_piece: 26.60,
        profit_pct: 53.2,
        branch: currentUser.branch,
        ingredients: [
          { id: 'i1', ingredient_price_id: 'sample-mango', ingredient_name: 'มะม่วงน้ำดอกไม้สุก', qty: 3, unit: 'กิโลกรัม', unit_cost: 60, total_cost: 180 },
          { id: 'i2', ingredient_price_id: 'sample-rice', ingredient_name: 'ข้าวเหนียวเขี้ยวงู', qty: 1.5, unit: 'กิโลกรัม', unit_cost: 45, total_cost: 67.5 },
          { id: 'i3', ingredient_price_id: 'sample-coconut', ingredient_name: 'กะทิสดกล่อง', qty: 1, unit: 'ลิตร', unit_cost: 72.5, total_cost: 72.5 }
        ],
        labor: [
          { id: 'l1', description: 'มูลข้าวเหนียว + ปอกผลไม้', hours: 2, rate_per_hour: 50, total_cost: 100 }
        ],
        other: [
          { id: 'o1', description: 'กล่องบรรจุภัณฑ์ใส + ช้อน', qty: 20, unit_cost: 2.4, total_cost: 48 }
        ]
      },
      {
        id: 'r-sample-2',
        code: 'REC-102',
        name: 'เอสเพรสโซ่เย็นสูตรทางร้าน (Signature Iced Espresso)',
        category: 'เครื่องดื่มกาแฟ (Coffee)',
        image: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=400&q=80',
        yield_qty: 1,
        serving_qty: 1,
        ingredients_cost: 18.50,
        labor_cost: 4.00,
        other_cost: 5.50,
        total_batch_cost: 28.00,
        cost_per_piece: 28.00,
        pricing_method: 'fixed_price',
        target_margin_pct: 56.9,
        target_profit_thb: 37.00,
        selling_price: 65.00,
        discount_pct: 0,
        vat_pct: 0,
        profit_per_piece: 37.00,
        profit_pct: 56.9,
        branch: currentUser.branch,
        ingredients: [
          { id: 'i4', ingredient_price_id: 'sample-coffee', ingredient_name: 'เมล็ดกาแฟ Everyday Blend', qty: 0.02, unit: 'kg', unit_cost: 450, total_cost: 9.00 },
          { id: 'i5', ingredient_price_id: 'sample-milk', ingredient_name: 'นมสด Meiji', qty: 0.12, unit: 'L', unit_cost: 50, total_cost: 6.00 },
          { id: 'i6', ingredient_price_id: 'sample-syrup', ingredient_name: 'น้ำเชื่อมละลายเร็ว', qty: 0.03, unit: 'L', unit_cost: 35, total_cost: 3.50 }
        ],
        labor: [
          { id: 'l2', description: 'บาริสต้าสกัดกาแฟและชง', hours: 0.08, rate_per_hour: 50, total_cost: 4.00 }
        ],
        other: [
          { id: 'o2', description: 'แก้ว 16oz + ฝา + หลอดกระดาษ', qty: 1, unit_cost: 5.50, total_cost: 5.50 }
        ]
      }
    ];
  });

  // Available ingredients for recipe editor
  const [availableIngredients, setAvailableIngredients] = useState<ProdcalcIngredientPrice[]>([]);

  // Load recipes from Supabase on mount
  useEffect(() => {
    if (!supabase) {
      setDbStatus('offline');
      return;
    }
    setDbStatus('checking');
    const fetchRecipes = async () => {
      try {
        const { data, error } = await supabase
          .from('recipes')
          .select('*')
          .eq('branch', currentUser.branch);

        if (error) {
          setDbStatus('offline');
        } else {
          setDbStatus('connected');
          if (data && data.length > 0) {
            setRecipes(data as Recipe[]);
          }
        }
      } catch (err) {
        console.warn('Supabase recipes fetch note:', err);
        setDbStatus('offline');
      }
    };
    fetchRecipes();
  }, [currentUser.branch]);

  // Load available ingredients from ProdCalc prices
  useEffect(() => {
    const key = `prodcalc-ingredient-prices-${currentUser.branch}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setAvailableIngredients(JSON.parse(saved));
      } catch {}
    }
  }, [currentTab, currentUser.branch]);

  // Save recipe
  const handleSaveRecipe = async (savedRecipe: Recipe) => {
    if (isReadOnly) return;
    const existingIndex = recipes.findIndex(r => r.id === savedRecipe.id);
    let updated: Recipe[] = [];

    if (existingIndex >= 0) {
      updated = [...recipes];
      updated[existingIndex] = savedRecipe;
    } else {
      updated = [savedRecipe, ...recipes];
    }

    setRecipes(updated);
    try {
      localStorage.setItem(`prodcalc-recipes-${currentUser.branch}`, JSON.stringify(updated));
      if (supabase) {
        await supabase.from('recipes').upsert(savedRecipe, { onConflict: 'id' });
      }
    } catch (err) {
      console.warn('Supabase recipe save note:', err);
    }

    // Send Discord Notification (non-blocking)
    const actionLabel = existingIndex >= 0 ? 'อัปเดตสูตรอาหาร ProdCalc' : 'สร้างสูตรอาหารใหม่ ProdCalc';
    sendDiscordNotification(
      `🧮 **[${actionLabel} - สาขา ${currentUser.branch}]**\n` +
      `👤 ผู้บันทึก: ${currentUser.name}\n` +
      `📖 สูตร: ${savedRecipe.code ? `[${savedRecipe.code}] ` : ''}${savedRecipe.name}\n` +
      `💰 ต้นทุน/ชิ้น: ฿${Number(savedRecipe.cost_per_piece || 0).toFixed(2)} | ราคาขาย: ฿${Number(savedRecipe.selling_price || 0).toFixed(2)}\n` +
      `📈 กำไร: ฿${Number(savedRecipe.profit_per_piece || 0).toFixed(2)} (${Number(savedRecipe.profit_pct || 0).toFixed(1)}%)`,
      'notifyOnProdCalcRecipes'
    );

    setEditingRecipe(null);
    setCurrentTab('recipes');
  };

  // Delete recipe
  const handleDeleteRecipe = async (id: string) => {
    if (isReadOnly) return;
    if (window.confirm('คุณต้องการลบสูตรนี้หรือไม่? การลบนี้จะไม่สามารถย้อนกลับได้')) {
      const updated = recipes.filter(r => r.id !== id);
      setRecipes(updated);
      try {
        localStorage.setItem(`prodcalc-recipes-${currentUser.branch}`, JSON.stringify(updated));
        if (supabase) {
          await supabase.from('recipes').delete().eq('id', id);
        }
      } catch (err) {}
    }
  };

  const branchLabel =
    currentUser.branch === 'Rayong'
      ? 'สาขาระยอง (Rayong)'
      : currentUser.branch === 'Bangkok'
        ? 'สาขากรุงเทพฯ (Bangkok)'
        : currentUser.branch;

  const userInitial = (currentUser.name || 'U').charAt(0).toUpperCase();

  const navItems: Array<{
    id: 'ingredients' | 'recipes' | 'reports';
    label: string;
    icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
    isActive: boolean;
  }> = [
    ...(effectivePerms.ingredients !== 'hidden'
      ? [
          {
            id: 'ingredients' as const,
            label: 'วัตถุดิบ & Yield',
            icon: FlaskConical,
            isActive: currentTab === 'ingredients',
          },
        ]
      : []),
    ...(effectivePerms.recipes !== 'hidden'
      ? [
          {
            id: 'recipes' as const,
            label: `สูตรอาหาร (${recipes.length})`,
            icon: BookOpen,
            isActive: currentTab === 'recipes' || currentTab === 'recipeEditor',
          },
        ]
      : []),
    ...(effectivePerms.reports !== 'hidden'
      ? [
          {
            id: 'reports' as const,
            label: 'รายงานต้นทุน',
            icon: BarChart2,
            isActive: currentTab === 'reports',
          },
        ]
      : []),
  ];

  const defaultHomeTab: 'ingredients' | 'recipes' | 'reports' =
    effectivePerms.recipes !== 'hidden'
      ? 'recipes'
      : effectivePerms.ingredients !== 'hidden'
        ? 'ingredients'
        : 'reports';

  const isIngredientsReadOnly = isReadOnly || effectivePerms.ingredients === 'read';
  const isRecipesReadOnly = isReadOnly || effectivePerms.recipes === 'read';

  return (
    <div className="min-h-screen bg-[#F0F5F4] text-[#2D4A49] font-sans pb-24 md:pb-12">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* ROW 1: TOP NAVIGATION BAR (Matches Main App TopNav) */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#D4E4E3] shadow-xs px-4 py-3 w-full">
        <div className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto flex items-center justify-between">
          {/* Left: Brand Wordmark CRENN + Sub-App Label */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => { setCurrentTab(defaultHomeTab); setEditingRecipe(null); }}
              className="text-left group focus:outline-none cursor-pointer"
              title="กลับหน้าหลัก ProdCalc"
            >
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-[0.22em] uppercase leading-none font-sans">
                CRENN
              </h1>
              <p className="text-[9px] text-[#5A8A88] font-bold tracking-widest uppercase mt-0.5">
                ProdCalc · Cost System
              </p>
            </button>
          </div>

          {/* Center: Vertical Icon-Above-Label Navigation Tabs */}
          <nav
            aria-label="เมนูหลัก ProdCalc"
            className="hidden md:flex items-center justify-center gap-1 flex-1 px-2"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setCurrentTab(item.id); setEditingRecipe(null); }}
                  className={`flex flex-col items-center justify-center gap-[2px] px-[12px] py-[6px] rounded-lg min-w-[68px] cursor-pointer relative transition-all duration-150 ${
                    item.isActive
                      ? 'bg-[#E8F3F2] text-[#5A8A88]'
                      : 'text-[#A8BCBB] hover:bg-[#F0F5F4] hover:text-[#5A8A88]'
                  }`}
                  title={item.label}
                  aria-current={item.isActive ? 'page' : undefined}
                >
                  <Icon size={18} strokeWidth={1.5} />
                  <span
                    className={`text-[9px] leading-none whitespace-nowrap mt-[1px] tabular-nums ${
                      item.isActive ? 'font-semibold text-[#5A8A88]' : 'font-normal'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Right: User Avatar Pill + Dropdown Menu */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="relative inline-block text-left select-none" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-[#E8F3F2] hover:bg-[#D8EAE8] border border-[#D4E4E3] transition-colors focus:outline-none shadow-xs cursor-pointer"
                title="โปรไฟล์ผู้ใช้"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <div className="w-7 h-7 rounded-full bg-[#5A8A88] text-white flex items-center justify-center text-xs font-bold uppercase shrink-0">
                  {userInitial}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-[11px] font-bold text-slate-800 leading-tight">
                    {currentUser.name}
                  </p>
                  {currentUser.role && (
                    <p className="text-[9px] text-[#5A8A88] font-semibold leading-tight capitalize">
                      {currentUser.role}
                    </p>
                  )}
                </div>
                <ChevronDown
                  size={12}
                  className={`text-[#5A8A88] transition-transform duration-200 shrink-0 ${
                    userMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 w-[225px] bg-white border border-[#D4E4E3] rounded-[12px] p-1.5 shadow-[0_8px_24px_rgba(45,74,73,0.12)] z-[200] animate-in fade-in slide-in-from-top-2 duration-150"
                >
                  {/* Branch & User Info */}
                  <div className="px-3 py-2 rounded-lg bg-[#F8FCFC] border border-[#D4E4E3]/60 mb-1">
                    <p className="text-[11px] font-bold text-[#2D4A49] truncate">
                      {currentUser.name}
                    </p>
                    <p className="text-[10px] text-[#6B8F8E] truncate mt-0.5">
                      📍 {branchLabel}
                    </p>
                  </div>

                  {/* Quick Switch to Cafe Management */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onSwitchToCafe();
                    }}
                    className="w-full flex items-center justify-between px-3 py-[9px] rounded-lg text-xs text-[#2D4A49] hover:bg-[#E8F3F2] hover:text-[#5A8A88] font-normal transition-all duration-100 cursor-pointer text-left group select-none"
                  >
                    <div className="flex items-center gap-[10px] min-w-0">
                      <span className="text-[14px] shrink-0 leading-none">☕</span>
                      <span className="truncate text-[12px]">สลับไป Cafe Management</span>
                    </div>
                    <ChevronRight size={13} className="text-[#A8BCBB] group-hover:text-[#5A8A88] shrink-0 ml-2 transition-colors" />
                  </button>

                  {onSwitchToHelloCrenn && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onSwitchToHelloCrenn();
                      }}
                      className="w-full flex items-center justify-between px-3 py-[9px] rounded-lg text-xs text-[#2D4A49] hover:bg-[#E8F3F2] hover:text-[#5A8A88] font-normal transition-all duration-100 cursor-pointer text-left group select-none"
                    >
                      <div className="flex items-center gap-[10px] min-w-0">
                        <span className="text-[14px] shrink-0 leading-none">📍</span>
                        <span className="truncate text-[12px]">สลับไป Hello, Crenn</span>
                      </div>
                      <ChevronRight size={13} className="text-[#A8BCBB] group-hover:text-[#5A8A88] shrink-0 ml-2 transition-colors" />
                    </button>
                  )}

                  {onSwitchToLeavePortal && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onSwitchToLeavePortal();
                      }}
                      className="w-full flex items-center justify-between px-3 py-[9px] rounded-lg text-xs text-[#2D4A49] hover:bg-[#E8F3F2] hover:text-[#5A8A88] font-normal transition-all duration-100 cursor-pointer text-left group select-none"
                    >
                      <div className="flex items-center gap-[10px] min-w-0">
                        <span className="text-[14px] shrink-0 leading-none">🗓️</span>
                        <span className="truncate text-[12px]">สลับไป Leave Portal</span>
                      </div>
                      <ChevronRight size={13} className="text-[#A8BCBB] group-hover:text-[#5A8A88] shrink-0 ml-2 transition-colors" />
                    </button>
                  )}

                  {/* Divider */}
                  <div className="h-[1px] bg-[#D4E4E3] mx-2 my-1" />

                  {/* Logout */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center justify-between px-3 py-[9px] rounded-lg text-xs text-rose-600 hover:bg-rose-50 font-medium transition-all duration-100 cursor-pointer text-left group select-none"
                  >
                    <div className="flex items-center gap-[10px] min-w-0">
                      <span className="text-[14px] shrink-0 leading-none">🚪</span>
                      <span className="truncate text-[12px]">ออกจากระบบ (Logout)</span>
                    </div>
                    <ChevronRight size={13} className="text-rose-400 group-hover:text-rose-600 shrink-0 ml-2 transition-colors" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* ROW 2: SECONDARY STATUS & APP SWITCHER BAR (Matches SupabaseStatusBar) */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="w-full relative bg-white/80 backdrop-blur-xs border-b border-[#D4E4E3] shadow-xs px-4 md:px-6 lg:px-8 py-2 z-10 shrink-0">
        <div className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto flex items-center justify-between text-xs min-h-[32px]">
          {/* Left: Switch back to Main App Pill */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onSwitchToCafe}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E8F3F2] hover:bg-[#D8EAE8] border border-[#5A8A88] text-[#2D4A49] transition-colors focus:outline-none shadow-xs text-xs font-bold cursor-pointer whitespace-nowrap"
              title="สลับไปยังระบบ Cafe Management System"
            >
              <Coffee size={13} className="text-[#5A8A88]" />
              <span>Cafe Management</span>
            </button>
            {onSwitchToHelloCrenn && (
              <button
                type="button"
                onClick={onSwitchToHelloCrenn}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E8F3F2] hover:bg-[#D8EAE8] border border-[#5A8A88] text-[#2D4A49] transition-colors focus:outline-none shadow-xs text-xs font-bold cursor-pointer whitespace-nowrap"
                title="เปิดแอปพลิเคชัน Hello, Crenn (GPS ลงเวลาเข้า-ออกงานอัตโนมัติ)"
              >
                <span className="text-sm">📍</span>
                <span>Hello, Crenn</span>
              </button>
            )}
            {onSwitchToLeavePortal && (
              <button
                type="button"
                onClick={onSwitchToLeavePortal}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F4FBF9] hover:bg-[#E1F3EE] border border-[#3D7A6E] text-[#1F4E45] transition-colors focus:outline-none shadow-xs text-xs font-bold cursor-pointer whitespace-nowrap"
                title="เปิดแอปพลิเคชัน Leave Portal (ระบบบริหารจัดการการลา)"
              >
                <span className="text-sm">🗓️</span>
                <span>Leave Portal</span>
              </button>
            )}
          </div>

          {/* Right: Supabase Status Indicator */}
          <div className="flex items-center gap-1.5 font-semibold text-[11px]">
            {dbStatus === 'connected' && (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E] shadow-[0_0_6px_#22C55E]"></span>
                </span>
                <span className="text-emerald-700">Supabase ● Connected</span>
              </>
            )}

            {dbStatus === 'checking' && (
              <>
                <Loader2 size={12} className="animate-spin text-amber-500" />
                <span className="text-amber-700">Supabase ● Connecting...</span>
              </>
            )}

            {dbStatus === 'offline' && (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span className="text-rose-700">Supabase ● Disconnected (Offline)</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* MAIN CONTAINER (Aligned to max-w-6xl grid) */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <main className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        {currentTab === 'ingredients' && effectivePerms.ingredients !== 'hidden' && (
          <IngredientPricing currentBranch={currentUser.branch} isReadOnly={isIngredientsReadOnly} />
        )}

        {currentTab === 'recipes' && effectivePerms.recipes !== 'hidden' && (
          <RecipeList
            recipes={recipes}
            onNewRecipe={() => {
              if (isRecipesReadOnly) return;
              setEditingRecipe(null);
              setCurrentTab('recipeEditor');
            }}
            onEditRecipe={(r) => {
              if (isRecipesReadOnly) return;
              setEditingRecipe(r);
              setCurrentTab('recipeEditor');
            }}
            onDeleteRecipe={handleDeleteRecipe}
            currentBranch={currentUser.branch}
            isReadOnly={isRecipesReadOnly}
          />
        )}

        {currentTab === 'recipeEditor' && effectivePerms.recipes !== 'hidden' && (
          <RecipeEditor
            initialRecipe={editingRecipe}
            availableIngredients={availableIngredients}
            onSave={handleSaveRecipe}
            onCancel={() => {
              setEditingRecipe(null);
              setCurrentTab('recipes');
            }}
            currentBranch={currentUser.branch}
            isReadOnly={isRecipesReadOnly}
          />
        )}

        {currentTab === 'reports' && effectivePerms.reports !== 'hidden' && (
          <CostReport recipes={recipes} currentBranch={currentUser.branch} />
        )}
      </main>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* MOBILE BOTTOM NAVIGATION */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="md:hidden fixed bottom-3 left-4 right-4 z-40">
        <div className="bg-white/95 border border-[#D4E4E3] backdrop-blur-md shadow-[0_8px_24px_rgba(45,74,73,0.16)] rounded-2xl p-1 flex items-center justify-around gap-1">
          {effectivePerms.ingredients !== 'hidden' && (
            <button
              type="button"
              onClick={() => { setCurrentTab('ingredients'); setEditingRecipe(null); }}
              className={`flex-1 py-1.5 rounded-xl text-[9.5px] flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                currentTab === 'ingredients'
                  ? 'bg-[#E8F3F2] text-[#5A8A88] font-semibold'
                  : 'text-[#A8BCBB] hover:text-[#5A8A88]'
              }`}
            >
              <FlaskConical size={16} strokeWidth={1.5} />
              <span>วัตถุดิบ</span>
            </button>
          )}

          {effectivePerms.recipes !== 'hidden' && (
            <button
              type="button"
              onClick={() => { setCurrentTab('recipes'); setEditingRecipe(null); }}
              className={`flex-1 py-1.5 rounded-xl text-[9.5px] flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                currentTab === 'recipes' || currentTab === 'recipeEditor'
                  ? 'bg-[#E8F3F2] text-[#5A8A88] font-semibold'
                  : 'text-[#A8BCBB] hover:text-[#5A8A88]'
              }`}
            >
              <BookOpen size={16} strokeWidth={1.5} />
              <span>สูตร ({recipes.length})</span>
            </button>
          )}

          {effectivePerms.reports !== 'hidden' && (
            <button
              type="button"
              onClick={() => { setCurrentTab('reports'); setEditingRecipe(null); }}
              className={`flex-1 py-1.5 rounded-xl text-[9.5px] flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                currentTab === 'reports'
                  ? 'bg-[#E8F3F2] text-[#5A8A88] font-semibold'
                  : 'text-[#A8BCBB] hover:text-[#5A8A88]'
              }`}
            >
              <BarChart2 size={16} strokeWidth={1.5} />
              <span>รายงาน</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

