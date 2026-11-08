import React, { useState, useMemo } from 'react';
import { Recipe } from '../../types/prodcalc';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  PieChart, 
  Download, 
  Printer, 
  Search, 
  Filter, 
  ArrowUpDown,
  Package,
  Award,
  Layers,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface CostReportProps {
  recipes: Recipe[];
  currentBranch: string;
}

export function CostReport({ recipes, currentBranch }: CostReportProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'profit_pct' | 'cost_per_piece' | 'selling_price' | 'profit_per_piece'>('profit_pct');
  const [sortAsc, setSortAsc] = useState(false);

  // Summary Metrics
  const summary = useMemo(() => {
    if (recipes.length === 0) {
      return {
        totalRecipes: 0,
        avgProfitPct: 0,
        avgCostPerPiece: 0,
        avgSellingPrice: 0,
        topProfitRecipe: null as Recipe | null
      };
    }

    const totalCost = recipes.reduce((sum, r) => sum + r.cost_per_piece, 0);
    const totalSelling = recipes.reduce((sum, r) => sum + r.selling_price, 0);
    const totalProfitPct = recipes.reduce((sum, r) => sum + r.profit_pct, 0);

    const sortedByProfit = [...recipes].sort((a, b) => b.profit_pct - a.profit_pct);

    return {
      totalRecipes: recipes.length,
      avgProfitPct: Number((totalProfitPct / recipes.length).toFixed(1)),
      avgCostPerPiece: Number((totalCost / recipes.length).toFixed(2)),
      avgSellingPrice: Number((totalSelling / recipes.length).toFixed(2)),
      topProfitRecipe: sortedByProfit[0] || null
    };
  }, [recipes]);

  // Sorted and filtered recipes
  const sortedRecipes = useMemo(() => {
    return recipes
      .filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.code.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        return sortAsc ? valA - valB : valB - valA;
      });
  }, [recipes, searchTerm, sortField, sortAsc]);

  // Excel Export
  const handleExportExcel = () => {
    const exportRows = recipes.map((r, i) => ({
      'ลำดับ': i + 1,
      'รหัสสูตร': r.code,
      'ชื่อสูตร/สินค้า': r.name,
      'หมวดหมู่': r.category,
      'จำนวนผลิตต่อสูตร': r.yield_qty,
      'ต้นทุนวัตถุดิบ (฿)': r.ingredients_cost,
      'ต้นทุนค่าแรง (฿)': r.labor_cost,
      'ต้นทุนอื่นๆ (฿)': r.other_cost,
      'ต้นทุนรวมต่อสูตร (฿)': r.total_batch_cost,
      'ต้นทุนต่อชิ้น (฿)': r.cost_per_piece,
      'ราคาขาย (฿)': r.selling_price,
      'กำไรต่อชิ้น (฿)': r.profit_per_piece,
      'อัตรากำไร (%)': `${r.profit_pct.toFixed(1)}%`,
      'สาขา': r.branch || currentBranch
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'รายงานต้นทุน');
    XLSX.writeFile(wb, `ProdCalc_Cost_Report_${currentBranch}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* HEADER CARD */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div 
        style={{
          background: '#FFFFFF',
          border: '1.5px solid #C8E3F0',
          borderRadius: '16px',
          padding: '18px 22px',
          boxShadow: '0 4px 20px rgba(90, 164, 200, 0.08)'
        }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📊</span>
            <h1 style={{ color: '#1E3D52' }} className="text-lg sm:text-xl font-bold tracking-tight">
              รายงานวิเคราะห์ต้นทุนและผลกำไร (Cost & Profit Reports)
            </h1>
          </div>
          <p style={{ color: '#4A7592' }} className="text-xs sm:text-[13px] mt-1 font-normal leading-relaxed">
            ภาพรวมการจัดอันดับสินค้าตามความคุ้มค่า สัดส่วนต้นทุนวัตถุดิบ และประมาณการกำไร
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={handleExportExcel}
            style={{
              background: '#FFFFFF',
              border: '1.5px solid #C8E3F0',
              color: '#1E5A7A'
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-[#EEF6FB] transition-colors cursor-pointer"
          >
            <Download size={14} />
            <span>ส่งออก Excel</span>
          </button>

          <button
            onClick={handlePrint}
            style={{
              background: '#5BA4C8',
              color: '#FFFFFF'
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs hover:bg-[#3D7FA3] transition-all cursor-pointer"
          >
            <Printer size={14} />
            <span>พิมพ์รายงาน</span>
          </button>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* SUMMARY METRICS CARDS */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Metric 1 */}
        <div 
          style={{ background: '#FFFFFF', border: '1.5px solid #C8E3F0', borderRadius: '16px' }}
          className="p-4 shadow-xs"
        >
          <div className="flex items-center justify-between text-xs text-[#4A7592]">
            <span>จำนวนสูตรทั้งหมด</span>
            <span className="p-1.5 rounded-lg bg-[#EEF6FB] text-[#5BA4C8]">
              <Package size={14} />
            </span>
          </div>
          <div className="text-2xl font-black text-[#1E3D52] font-mono mt-2">
            {summary.totalRecipes} <span className="text-xs font-normal text-[#4A7592]">รายการ</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div 
          style={{ background: '#FFFFFF', border: '1.5px solid #C8E3F0', borderRadius: '16px' }}
          className="p-4 shadow-xs"
        >
          <div className="flex items-center justify-between text-xs text-[#4A7592]">
            <span>กำไรเฉลี่ยภาพรวม</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp size={14} />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono mt-2">
            {summary.avgProfitPct}%
          </div>
        </div>

        {/* Metric 3 */}
        <div 
          style={{ background: '#FFFFFF', border: '1.5px solid #C8E3F0', borderRadius: '16px' }}
          className="p-4 shadow-xs"
        >
          <div className="flex items-center justify-between text-xs text-[#4A7592]">
            <span>ต้นทุนเฉลี่ย/ชิ้น</span>
            <span className="p-1.5 rounded-lg bg-[#EEF6FB] text-[#1E5A7A]">
              <DollarSign size={14} />
            </span>
          </div>
          <div className="text-2xl font-black text-[#1E5A7A] font-mono mt-2">
            ฿{summary.avgCostPerPiece.toFixed(2)}
          </div>
        </div>

        {/* Metric 4 */}
        <div 
          style={{ background: '#FFFFFF', border: '1.5px solid #C8E3F0', borderRadius: '16px' }}
          className="p-4 shadow-xs"
        >
          <div className="flex items-center justify-between text-xs text-[#4A7592]">
            <span>กำไรสูงสุดในร้าน</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-500">
              <Award size={14} />
            </span>
          </div>
          <div className="text-sm font-bold text-[#1E3D52] truncate mt-2">
            {summary.topProfitRecipe?.name || '-'}
          </div>
          {summary.topProfitRecipe && (
            <span className="text-[11px] font-bold text-emerald-600 font-mono">
              กำไร {summary.topProfitRecipe.profit_pct.toFixed(1)}% (฿{summary.topProfitRecipe.profit_per_piece.toFixed(2)})
            </span>
          )}
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* COMPARATIVE BAR CHART VISUAL */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div 
        style={{
          background: '#FFFFFF',
          border: '1.5px solid #C8E3F0',
          borderRadius: '16px',
          padding: '18px',
          boxShadow: '0 4px 16px rgba(90, 164, 200, 0.06)'
        }}
        className="space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} color="#5BA4C8" />
            <h3 className="font-bold text-xs sm:text-sm text-[#1E3D52]">
              เปรียบเทียบ ต้นทุน (Cost) vs ราคาขาย (Price)
            </h3>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#EF4444]" />
              <span className="text-[#4A7592]">ต้นทุน/ชิ้น</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#5BA4C8]" />
              <span className="text-[#4A7592]">ราคาขาย</span>
            </span>
          </div>
        </div>

        {recipes.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#4A7592]">
            ยังไม่มีข้อมูลสูตรสำหรับแสดงกราฟเปรียบเทียบ
          </div>
        ) : (
          <div className="space-y-2.5 pt-2">
            {recipes.slice(0, 8).map(recipe => {
              const maxVal = Math.max(recipe.selling_price, recipe.cost_per_piece, 1);
              const costWidth = Math.min(100, (recipe.cost_per_piece / maxVal) * 100);
              const sellWidth = Math.min(100, (recipe.selling_price / maxVal) * 100);

              return (
                <div key={recipe.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#1E3D52] truncate max-w-[200px]">
                      {recipe.name}
                    </span>
                    <span className="text-[11px] font-mono text-[#4A7592]">
                      กำไร ฿{recipe.profit_per_piece.toFixed(2)} ({recipe.profit_pct.toFixed(1)}%)
                    </span>
                  </div>

                  <div className="w-full h-4 bg-slate-100 rounded-lg overflow-hidden flex relative">
                    <div 
                      style={{ width: `${costWidth}%`, background: '#F87171' }} 
                      className="h-full rounded-l transition-all"
                      title={`ต้นทุน: ฿${recipe.cost_per_piece.toFixed(2)}`}
                    />
                    <div 
                      style={{ width: `${Math.max(0, sellWidth - costWidth)}%`, background: '#5BA4C8' }} 
                      className="h-full rounded-r transition-all"
                      title={`กำไร: ฿${recipe.profit_per_piece.toFixed(2)}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* RANKING TABLE */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div 
        style={{
          background: '#FFFFFF',
          border: '1.5px solid #C8E3F0',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(90, 164, 200, 0.06)'
        }}
      >
        <div className="p-3.5 border-b border-[#E4F1F8] flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} color="#4A7592" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหารายการสูตร..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ background: '#F8FCFE', border: '1px solid #C8E3F0' }}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none focus:border-[#5BA4C8]"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-[#4A7592]">
            <span>จัดเรียงตาม:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as any)}
              style={{ border: '1px solid #C8E3F0' }}
              className="px-2.5 py-1 rounded-lg text-xs outline-none bg-white cursor-pointer"
            >
              <option value="profit_pct">อัตรากำไร %</option>
              <option value="profit_per_piece">กำไรบาท/ชิ้น</option>
              <option value="cost_per_piece">ต้นทุนต่อชิ้น</option>
              <option value="selling_price">ราคาขาย</option>
            </select>
            <button
              onClick={() => setSortAsc(!sortAsc)}
              style={{ border: '1px solid #C8E3F0' }}
              className="p-1 rounded-lg hover:bg-[#EEF6FB] cursor-pointer"
              title="สลับลำดับ มาก/น้อย"
            >
              <ArrowUpDown size={14} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr style={{ background: '#1E5A7A', color: '#FFFFFF' }} className="font-semibold select-none">
                <th className="py-2.5 px-3 w-12 text-center">อันดับ</th>
                <th className="py-2.5 px-3 min-w-[150px]">ชื่อสินค้า/สูตร</th>
                <th className="py-2.5 px-3 min-w-[100px]">หมวดหมู่</th>
                <th className="py-2.5 px-3 text-center">ผลิตได้ (ชิ้น)</th>
                <th className="py-2.5 px-3 text-right">ต้นทุนรวมสูตร</th>
                <th className="py-2.5 px-3 text-right">ต้นทุน/ชิ้น</th>
                <th className="py-2.5 px-3 text-right">ราคาขาย</th>
                <th className="py-2.5 px-3 text-right">กำไร/ชิ้น</th>
                <th className="py-2.5 px-3 text-center font-bold">อัตรากำไร (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4F1F8]">
              {sortedRecipes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#4A7592]">
                    ไม่พบรายการสูตร
                  </td>
                </tr>
              ) : (
                sortedRecipes.map((r, idx) => {
                  const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#F8FCFE';
                  return (
                    <tr key={r.id} style={{ background: rowBg }} className="hover:bg-[#EEF6FB]">
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-[#4A7592]">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[#1E3D52]">
                        {r.name}
                        <span className="block text-[10px] text-[#90C4DC] font-mono">{r.code}</span>
                      </td>
                      <td className="py-2.5 px-3 text-[#4A7592]">
                        {r.category}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {r.yield_qty}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#4A7592]">
                        ฿{r.total_batch_cost.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-[#1E5A7A]">
                        ฿{r.cost_per_piece.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#1E3D52]">
                        ฿{r.selling_price.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                        +฿{r.profit_per_piece.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span 
                          style={{
                            background: r.profit_pct >= 50 ? '#ECFDF5' : r.profit_pct >= 30 ? '#FFFBEB' : '#FEF2F2',
                            color: r.profit_pct >= 50 ? '#22C55E' : r.profit_pct >= 30 ? '#F59E0B' : '#EF4444',
                            border: `1px solid ${r.profit_pct >= 50 ? '#A7F3D0' : r.profit_pct >= 30 ? '#FDE68A' : '#FECACA'}`
                          }}
                          className="px-2 py-0.5 rounded-full font-mono font-black text-xs inline-block"
                        >
                          {r.profit_pct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
