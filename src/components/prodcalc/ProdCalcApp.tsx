import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Recipe, ProdcalcIngredientPrice } from '../../types/prodcalc';
import { IngredientPricing } from './IngredientPricing';
import { RecipeList } from './RecipeList';
import { RecipeEditor } from './RecipeEditor';
import { CostReport } from './CostReport';
import { 
  Calculator, 
  FlaskConical, 
  BookOpen, 
  BarChart2, 
  Bell, 
  User, 
  Coffee, 
  LogOut, 
  Sparkles,
  ChevronDown
} from 'lucide-react';

interface ProdCalcAppProps {
  currentUser: {
    name: string;
    role: string;
    branch: string;
  };
  onSwitchToCafe: () => void;
  onLogout: () => void;
  isReadOnly?: boolean;
}

export function ProdCalcApp({ currentUser, onSwitchToCafe, onLogout, isReadOnly = false }: ProdCalcAppProps) {
  // Navigation tabs: 'ingredients' | 'recipes' | 'recipeEditor' | 'reports'
  const [currentTab, setCurrentTab] = useState<'ingredients' | 'recipes' | 'recipeEditor' | 'reports'>('recipes');

  // Recipe editing state
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

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
    if (!supabase) return;
    const fetchRecipes = async () => {
      try {
        const { data, error } = await supabase
          .from('recipes')
          .select('*')
          .eq('branch', currentUser.branch);

        if (!error && data && data.length > 0) {
          setRecipes(data as Recipe[]);
        }
      } catch (err) {
        console.warn('Supabase recipes fetch note:', err);
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

  return (
    <div style={{ background: '#FDFAF5', minHeight: '100vh', color: '#1E3D52' }} className="font-sans pb-24 md:pb-12">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* TOP NAVIGATION BAR */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header 
        style={{
          background: '#FFFFFF',
          borderBottom: '1.5px solid #C8E3F0',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          boxShadow: '0 2px 12px rgba(90, 164, 200, 0.08)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Brand Left */}
          <div className="flex items-center gap-2.5">
            <div 
              style={{ background: '#5BA4C8' }}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[12px] shadow-sm"
            >
              🧮
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-[12px] tracking-wider uppercase text-[#1E5A7A]">CRENN</span>
                <span className="text-[10px] text-[#5BA4C8] font-bold">|</span>
                <span className="font-extrabold text-[12px] text-[#1E3D52]">ProdCalc</span>
              </div>
              <span className="text-[9.5px] text-[#4A7592] font-medium hidden sm:block">
                Production Cost Calculator
              </span>
            </div>
          </div>

          {/* Desktop Center Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-[#EEF6FB] p-1 rounded-xl border border-[#C8E3F0]">
            <button
              onClick={() => { setCurrentTab('ingredients'); setEditingRecipe(null); }}
              style={{
                background: currentTab === 'ingredients' ? '#5BA4C8' : 'transparent',
                color: currentTab === 'ingredients' ? '#FFFFFF' : '#4A7592'
              }}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FlaskConical size={13} />
              <span>วัตถุดิบ & Yield</span>
            </button>

            <button
              onClick={() => { setCurrentTab('recipes'); setEditingRecipe(null); }}
              style={{
                background: currentTab === 'recipes' || currentTab === 'recipeEditor' ? '#5BA4C8' : 'transparent',
                color: currentTab === 'recipes' || currentTab === 'recipeEditor' ? '#FFFFFF' : '#4A7592'
              }}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <BookOpen size={13} />
              <span>สูตรอาหาร ({recipes.length})</span>
            </button>

            <button
              onClick={() => { setCurrentTab('reports'); setEditingRecipe(null); }}
              style={{
                background: currentTab === 'reports' ? '#5BA4C8' : 'transparent',
                color: currentTab === 'reports' ? '#FFFFFF' : '#4A7592'
              }}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <BarChart2 size={13} />
              <span>รายงานต้นทุน</span>
            </button>
          </nav>

          {/* Right Actions: App Switcher & User Profile */}
          <div className="flex items-center gap-2">
            {/* Switch to Cafe Management System */}
            <button
              onClick={onSwitchToCafe}
              style={{
                background: '#FFFFFF',
                border: '1.5px solid #C8E3F0',
                color: '#1E5A7A'
              }}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 hover:bg-[#EEF6FB] hover:border-[#5BA4C8] transition-all cursor-pointer shadow-2xs"
              title="สลับไปยังระบบ Cafe Management System"
            >
              <Coffee size={13} color="#5BA4C8" />
              <span className="hidden sm:inline">สลับไป Cafe Mgmt</span>
              <span className="sm:hidden text-[10px]">Cafe</span>
            </button>

            {/* User Badge */}
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#EEF6FB] border border-[#C8E3F0] text-[10px]">
              <div className="w-5 h-5 rounded-full bg-[#5BA4C8] text-white flex items-center justify-center font-bold text-[9px]">
                {currentUser.name.charAt(0)}
              </div>
              <div className="text-left leading-tight">
                <span className="font-bold text-[#1E3D52] block text-[10.5px]">{currentUser.name}</span>
                <span className="text-[9px] text-[#4A7592]">{currentUser.branch}</span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              style={{ border: '1px solid #C8E3F0', color: '#EF4444' }}
              className="p-1.5 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
              title="ออกจากระบบ"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* MAIN CONTAINER */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {currentTab === 'ingredients' && (
          <IngredientPricing currentBranch={currentUser.branch} isReadOnly={isReadOnly} />
        )}

        {currentTab === 'recipes' && (
          <RecipeList
            recipes={recipes}
            onNewRecipe={() => {
              if (isReadOnly) return;
              setEditingRecipe(null);
              setCurrentTab('recipeEditor');
            }}
            onEditRecipe={(r) => {
              if (isReadOnly) return;
              setEditingRecipe(r);
              setCurrentTab('recipeEditor');
            }}
            onDeleteRecipe={handleDeleteRecipe}
            currentBranch={currentUser.branch}
            isReadOnly={isReadOnly}
          />
        )}

        {currentTab === 'recipeEditor' && (
          <RecipeEditor
            initialRecipe={editingRecipe}
            availableIngredients={availableIngredients}
            onSave={handleSaveRecipe}
            onCancel={() => {
              setEditingRecipe(null);
              setCurrentTab('recipes');
            }}
            currentBranch={currentUser.branch}
            isReadOnly={isReadOnly}
          />
        )}

        {currentTab === 'reports' && (
          <CostReport recipes={recipes} currentBranch={currentUser.branch} />
        )}
      </main>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* MOBILE BOTTOM NAVIGATION (PILL STYLE) */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="md:hidden fixed bottom-3 left-4 right-4 z-40">
        <div 
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1.5px solid #C8E3F0',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 32px rgba(90, 164, 200, 0.25)',
            borderRadius: '9999px'
          }}
          className="p-1.5 flex items-center justify-around"
        >
          <button
            onClick={() => { setCurrentTab('ingredients'); setEditingRecipe(null); }}
            style={{
              background: currentTab === 'ingredients' ? '#5BA4C8' : 'transparent',
              color: currentTab === 'ingredients' ? '#FFFFFF' : '#4A7592'
            }}
            className="flex-1 py-1.5 rounded-full text-[10px] font-bold flex flex-col items-center gap-0.5 transition-all"
          >
            <FlaskConical size={15} />
            <span className="text-[9.5px]">วัตถุดิบ</span>
          </button>

          <button
            onClick={() => { setCurrentTab('recipes'); setEditingRecipe(null); }}
            style={{
              background: currentTab === 'recipes' || currentTab === 'recipeEditor' ? '#5BA4C8' : 'transparent',
              color: currentTab === 'recipes' || currentTab === 'recipeEditor' ? '#FFFFFF' : '#4A7592'
            }}
            className="flex-1 py-1.5 rounded-full text-[10px] font-bold flex flex-col items-center gap-0.5 transition-all"
          >
            <BookOpen size={15} />
            <span className="text-[9.5px]">สูตร</span>
          </button>

          <button
            onClick={() => { setCurrentTab('reports'); setEditingRecipe(null); }}
            style={{
              background: currentTab === 'reports' ? '#5BA4C8' : 'transparent',
              color: currentTab === 'reports' ? '#FFFFFF' : '#4A7592'
            }}
            className="flex-1 py-1.5 rounded-full text-[10px] font-bold flex flex-col items-center gap-0.5 transition-all"
          >
            <BarChart2 size={15} />
            <span className="text-[9.5px]">รายงาน</span>
          </button>
        </div>
      </div>
    </div>
  );
}
