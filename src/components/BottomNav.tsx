import React, { useState } from 'react';
import { 
  Home, 
  Package, 
  ClipboardList, 
  CheckSquare, 
  ShoppingCart, 
  Cake, 
  ChefHat, 
  MoreHorizontal,
  X, 
  ChevronRight, 
  LogOut, 
  Settings, 
  History, 
  Coffee, 
  Building,
  User as UserIcon
} from 'lucide-react';
import { Branch } from '../types';
import { UserRole } from './LoginForm';

export interface BottomNavProps {
  activeTab: string;
  onNavigate: (tab: any) => void;
  onLogout: () => void;
  user: {
    name: string;
    role: UserRole;
    branch?: Branch;
  };
}

export function BottomNav({ activeTab, onNavigate, onLogout, user }: BottomNavProps) {
  const [activeSheetTab, setActiveSheetTab] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);

  const NAV_TABS = [
    { id: 'home', label: 'หน้าหลัก', icon: Home, hasSubmenu: false },
    { id: 'stock', label: 'สต็อก', icon: Package, hasSubmenu: true },
    { id: 'reports', label: 'รายงาน', icon: ClipboardList, hasSubmenu: true },
    { id: 'checkin', label: 'Check-in', icon: CheckSquare, hasSubmenu: true },
    { id: 'purchasing', label: 'Purchasing', icon: ShoppingCart, hasSubmenu: false },
    { id: 'bakery', label: 'Bakery', icon: Cake, hasSubmenu: true },
    { id: 'rnd', label: 'R&D', icon: ChefHat, hasSubmenu: false },
    { id: 'more', label: 'เพิ่มเติม', icon: MoreHorizontal, hasSubmenu: true }
  ];

  const isTabActive = (tabId: string) => {
    if (tabId === 'home') return activeTab === 'home' || activeTab === 'dashboard';
    if (tabId === 'stock') return activeTab === 'barStock' || activeTab === 'bakeryStock';
    if (tabId === 'reports') {
      return [
        'barReceiving', 'bakeryReceiving', 'barDailyCount', 'bakeryDailyCount',
        'barWasteLog', 'bakeryWasteLog', 'barWaste', 'logs', 'stockSubmitHistory', 'receivingHistory'
      ].includes(activeTab);
    }
    if (tabId === 'checkin') return activeTab === 'barChecklist' || activeTab === 'bakeryChecklist' || activeTab === 'checklistHistory';
    if (tabId === 'purchasing') return activeTab === 'barPurchasing';
    if (tabId === 'bakery') return activeTab === 'bakeryPlan' || activeTab === 'bakeryPlanHistory';
    if (tabId === 'rnd') return activeTab === 'rndReport';
    if (tabId === 'more') return activeTab === 'userSettings';
    return false;
  };

  const handleTabClick = (tab: typeof NAV_TABS[0]) => {
    if (tab.hasSubmenu) {
      setActiveSheetTab(prev => prev === tab.id ? null : tab.id);
    } else {
      setActiveSheetTab(null);
      if (tab.id === 'home') onNavigate('home');
      else if (tab.id === 'purchasing') onNavigate('barPurchasing');
      else if (tab.id === 'rnd') onNavigate('rndReport');
    }
  };

  const handleNavigateSubItem = (tab: string) => {
    setActiveSheetTab(null);
    onNavigate(tab);
  };

  return (
    <>
      {/* Fixed Bottom Navigation Bar */}
      <nav 
        aria-label="Main Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#D4E4E3] shadow-lg select-none py-2"
      >
        <div className="max-w-md mx-auto flex items-center overflow-x-auto no-scrollbar px-1.5 gap-1">
          {NAV_TABS.map(tab => {
            const Icon = tab.icon;
            const active = isTabActive(tab.id);
            const isSheetOpen = activeSheetTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`flex flex-col items-center justify-center min-w-[58px] py-1 px-2 rounded-full transition-all select-none shrink-0 ${
                  active || isSheetOpen
                    ? 'bg-[#E8F3F2] text-[#5A8A88] font-bold shadow-xs'
                    : 'text-[#A8BCBB] hover:text-[#5A8A88] font-medium bg-transparent'
                }`}
              >
                <div className="relative">
                  <Icon size={18} strokeWidth={active || isSheetOpen ? 2.5 : 2} />
                  {tab.hasSubmenu && (
                    <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[#5A8A88]/50"></span>
                  )}
                </div>
                <span className="text-[10px] mt-1 leading-tight tracking-tight">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SUB-MENUS AS BOTTOM SHEET (DISMISSIBLE)
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeSheetTab && (
        <div 
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setActiveSheetTab(null)}
        >
          <div 
            className="w-full max-w-md mx-auto bg-white rounded-t-3xl shadow-2xl border-t border-[#D4E4E3] p-4 max-h-[82vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto mb-3"></div>

            {/* TAB 2: สต็อก Sub-menu */}
            {activeSheetTab === 'stock' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-[#E8F3F2] text-[#5A8A88]">
                      <Package size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">จัดการสต็อก (Stock)</h4>
                      <p className="text-[11px] text-slate-400">เลือกแผนกเพื่อเข้าบันทึกสต็อก</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveSheetTab(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => handleNavigateSubItem('barStock')}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-[#E8F3F2] border border-slate-100 hover:border-[#D4E4E3] transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600 group-hover:scale-105 transition-transform">
                        <Coffee size={22} />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-800">📦 สรุป Stock บาร์</h5>
                        <p className="text-[11px] text-slate-500 mt-0.5">บันทึกและจัดการสต็อกสำหรับบาร์</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-400 group-hover:text-[#5A8A88]" />
                  </button>

                  <button
                    onClick={() => handleNavigateSubItem('bakeryStock')}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-[#E8F3F2] border border-slate-100 hover:border-[#D4E4E3] transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-rose-100 text-rose-600 group-hover:scale-105 transition-transform">
                        <Cake size={22} />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-800">🍳 สรุป Stock ครัว</h5>
                        <p className="text-[11px] text-slate-500 mt-0.5">บันทึกและจัดการสต็อกสำหรับครัว</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-400 group-hover:text-[#5A8A88]" />
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: รายงาน Sub-menu (2 Groups) */}
            {activeSheetTab === 'reports' && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-[#E8F3F2] text-[#5A8A88]">
                      <ClipboardList size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">ศูนย์รวมรายงาน (Reports)</h4>
                      <p className="text-[11px] text-slate-400">รายงานประจำวันและประวัติย้อนหลัง</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveSheetTab(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Group 1: รายงานประจำวัน */}
                <div>
                  <span className="text-[11px] font-bold text-[#5A8A88] uppercase tracking-wider block mb-2 px-1">
                    Group 1: รายงานประจำวัน
                  </span>
                  <div className="space-y-1.5">
                    <button
                      onClick={() => handleNavigateSubItem('barReceiving')}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#E8F3F2] text-left text-xs transition-colors"
                    >
                      <span className="font-semibold text-slate-700">📦 รายงานตรวจรับวัตถุดิบ (บาร์)</span>
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>
                    <button
                      onClick={() => handleNavigateSubItem('bakeryReceiving')}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#E8F3F2] text-left text-xs transition-colors"
                    >
                      <span className="font-semibold text-slate-700">📦 รายงานตรวจรับวัตถุดิบ (ครัว)</span>
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>
                    <button
                      onClick={() => handleNavigateSubItem('barDailyCount')}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#E8F3F2] text-left text-xs transition-colors"
                    >
                      <span className="font-semibold text-slate-700">📋 รายงานตรวจนับสต็อก (บาร์)</span>
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>
                    <button
                      onClick={() => handleNavigateSubItem('bakeryDailyCount')}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#E8F3F2] text-left text-xs transition-colors"
                    >
                      <span className="font-semibold text-slate-700">📋 รายงานตรวจนับสต็อก (ครัว)</span>
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>
                    <button
                      onClick={() => handleNavigateSubItem('barWasteLog')}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#E8F3F2] text-left text-xs transition-colors"
                    >
                      <span className="font-semibold text-slate-700">🗑️ รายงาน Waste/ของเสีย (บาร์)</span>
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>
                    <button
                      onClick={() => handleNavigateSubItem('bakeryWasteLog')}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#E8F3F2] text-left text-xs transition-colors"
                    >
                      <span className="font-semibold text-slate-700">🗑️ รายงาน Waste/ของเสีย (ครัว)</span>
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>
                    <button
                      onClick={() => handleNavigateSubItem('barWaste')}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#E8F3F2] text-left text-xs transition-colors"
                    >
                      <span className="font-semibold text-slate-700">☕ รายงาน Waste เมล็ดกาแฟ</span>
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>
                  </div>
                </div>

                {/* Group 2: ประวัติย้อนหลัง */}
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2 px-1">
                    Group 2: ประวัติย้อนหลัง
                  </span>
                  <div className="space-y-1.5">
                    <button
                      onClick={() => handleNavigateSubItem('logs')}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#E8F3F2] text-left text-xs transition-colors"
                    >
                      <span className="font-semibold text-slate-700">🕐 ประวัติการแก้ไขข้อมูล</span>
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>
                    <button
                      onClick={() => handleNavigateSubItem('stockSubmitHistory')}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#E8F3F2] text-left text-xs transition-colors"
                    >
                      <span className="font-semibold text-slate-700">🕐 ประวัติรายงานนับสต็อก</span>
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>
                    <button
                      onClick={() => handleNavigateSubItem('receivingHistory')}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#E8F3F2] text-left text-xs transition-colors"
                    >
                      <span className="font-semibold text-slate-700">🕐 ประวัติการรับวัตถุดิบ</span>
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Check-in Sub-menu */}
            {activeSheetTab === 'checkin' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-[#E8F3F2] text-[#5A8A88]">
                      <CheckSquare size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Check-in & Check-out</h4>
                      <p className="text-[11px] text-slate-400">แบบฟอร์มตรวจสอบการทำงานประจำวัน</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveSheetTab(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => handleNavigateSubItem('barChecklist')}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-[#E8F3F2] border border-slate-100 hover:border-[#D4E4E3] transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-purple-100 text-purple-600 group-hover:scale-105 transition-transform">
                        <CheckSquare size={20} />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-800">✅ Check-in & Check-out (บาร์)</h5>
                        <p className="text-[11px] text-slate-500 mt-0.5">เปิด-ปิดบาร์ และตรวจความเรียบร้อย</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-400 group-hover:text-[#5A8A88]" />
                  </button>

                  <button
                    onClick={() => handleNavigateSubItem('bakeryChecklist')}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-[#E8F3F2] border border-slate-100 hover:border-[#D4E4E3] transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-pink-100 text-pink-600 group-hover:scale-105 transition-transform">
                        <CheckSquare size={20} />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-800">✅ Check-in & Check-out (ครัว)</h5>
                        <p className="text-[11px] text-slate-500 mt-0.5">เปิด-ปิดครัว และตรวจความเรียบร้อย</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-400 group-hover:text-[#5A8A88]" />
                  </button>

                  <button
                    onClick={() => handleNavigateSubItem('checklistHistory')}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-[#E8F3F2] border border-slate-100 hover:border-[#D4E4E3] transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600 group-hover:scale-105 transition-transform">
                        <History size={20} />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-800">🕐 ประวัติ Check-in & Check-out</h5>
                        <p className="text-[11px] text-slate-500 mt-0.5">ตรวจสอบบันทึกย้อนหลัง</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-400 group-hover:text-[#5A8A88]" />
                  </button>
                </div>
              </div>
            )}

            {/* TAB 6: Bakery Sub-menu */}
            {activeSheetTab === 'bakery' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-[#E8F3F2] text-[#5A8A88]">
                      <Cake size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">แผนงาน Bakery</h4>
                      <p className="text-[11px] text-slate-400">ตารางอบขนมและประวัติแผนงาน</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveSheetTab(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => handleNavigateSubItem('bakeryPlan')}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-[#E8F3F2] border border-slate-100 hover:border-[#D4E4E3] transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-amber-100 text-amber-600 group-hover:scale-105 transition-transform">
                        <Cake size={20} />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-800">🧁 แผนงาน Bakery</h5>
                        <p className="text-[11px] text-slate-500 mt-0.5">บันทึกและจัดการแผนงานอบขนม</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-400 group-hover:text-[#5A8A88]" />
                  </button>

                  <button
                    onClick={() => handleNavigateSubItem('bakeryPlanHistory')}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-[#E8F3F2] border border-slate-100 hover:border-[#D4E4E3] transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-orange-100 text-orange-600 group-hover:scale-105 transition-transform">
                        <History size={20} />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-800">🕐 ประวัติแผนงาน Bakery (24 สัปดาห์)</h5>
                        <p className="text-[11px] text-slate-500 mt-0.5">ตรวจสอบแผนงานย้อนหลัง 24 สัปดาห์</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-400 group-hover:text-[#5A8A88]" />
                  </button>
                </div>
              </div>
            )}

            {/* TAB 8: เพิ่มเติม Sub-menu */}
            {activeSheetTab === 'more' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-[#E8F3F2] text-[#5A8A88]">
                      <MoreHorizontal size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">เมนูเพิ่มเติม (More)</h4>
                      <p className="text-[11px] text-slate-400">การตั้งค่า โปรไฟล์ และระบบ</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveSheetTab(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-1.5 text-xs">
                  <button
                    onClick={() => handleNavigateSubItem('userSettings')}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[#E8F3F2] text-left transition-colors font-medium text-slate-700"
                  >
                    <div className="flex items-center gap-2.5">
                      <Settings size={18} className="text-slate-500" />
                      <span>⚙️ ตั้งค่า / Settings</span>
                    </div>
                    <ChevronRight size={15} className="text-slate-400" />
                  </button>

                  <button
                    onClick={() => { setActiveSheetTab(null); setShowProfileModal(true); }}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[#E8F3F2] text-left transition-colors font-medium text-slate-700"
                  >
                    <div className="flex items-center gap-2.5">
                      <UserIcon size={18} className="text-slate-500" />
                      <span>👤 โปรไฟล์ผู้ใช้</span>
                    </div>
                    <ChevronRight size={15} className="text-slate-400" />
                  </button>

                  <button
                    onClick={() => { setActiveSheetTab(null); setShowBranchModal(true); }}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[#E8F3F2] text-left transition-colors font-medium text-slate-700"
                  >
                    <div className="flex items-center gap-2.5">
                      <Building size={18} className="text-slate-500" />
                      <span>🏪 ข้อมูลสาขา</span>
                    </div>
                    <ChevronRight size={15} className="text-slate-400" />
                  </button>

                  <button
                    onClick={() => handleNavigateSubItem('logs')}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[#E8F3F2] text-left transition-colors font-medium text-slate-700"
                  >
                    <div className="flex items-center gap-2.5">
                      <History size={18} className="text-slate-500" />
                      <span>🕐 ประวัติแก้ไขข้อมูล</span>
                    </div>
                    <ChevronRight size={15} className="text-slate-400" />
                  </button>

                  <button
                    onClick={() => { setActiveSheetTab(null); onLogout(); }}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-rose-50 text-left transition-colors font-bold text-rose-600 border-t border-slate-100 mt-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <LogOut size={18} className="text-rose-500" />
                      <span>🚪 ออกจากระบบ (Logout)</span>
                    </div>
                    <ChevronRight size={15} className="text-rose-400" />
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-16 h-16 rounded-full bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center font-bold text-2xl mx-auto shadow-xs border-2 border-[#D4E4E3]">
              {user.name.charAt(0)}
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-800">{user.name}</h3>
              <p className="text-xs font-semibold text-[#5A8A88] mt-0.5">{user.role}</p>
              <p className="text-[11px] text-slate-400 mt-1">สาขา: {user.branch === 'Rayong' ? 'ระยอง' : 'กรุงเทพฯ'}</p>
            </div>
            <div className="pt-2 space-y-2">
              <button
                onClick={() => { setShowProfileModal(false); onNavigate('userSettings'); }}
                className="w-full py-2.5 rounded-full bg-[#E8F3F2] text-[#476E6C] font-semibold text-xs hover:bg-[#D8EAE8] transition-colors"
              >
                จัดการบัญชีและความปลอดภัย
              </button>
              <button
                onClick={() => { setShowProfileModal(false); onLogout(); }}
                className="w-full py-2.5 rounded-full bg-rose-50 text-rose-600 font-semibold text-xs hover:bg-rose-100 transition-colors"
              >
                ออกจากระบบ
              </button>
              <button
                onClick={() => setShowProfileModal(false)}
                className="w-full py-2 rounded-full text-slate-400 font-medium text-xs hover:text-slate-600 transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch Info Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center mx-auto">
              <Building size={24} />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-bold text-slate-800">ข้อมูลสาขา (Branch Info)</h3>
              <p className="text-xs text-slate-600 mt-2 font-medium">
                📍 สาขาปัจจุบัน: <span className="font-bold text-[#5A8A88]">{user.branch === 'Rayong' ? 'สาขาระยอง (Rayong)' : 'สาขากรุงเทพฯ (Bangkok)'}</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                ระบบจัดเก็บข้อมูลและประวัติสต็อกแยกตามสาขาเพื่อความถูกต้องของการดำเนินงาน
              </p>
            </div>
            <button
              onClick={() => setShowBranchModal(false)}
              className="w-full py-2.5 rounded-full bg-[#5A8A88] text-white font-semibold text-xs hover:bg-[#476E6C] transition-colors"
            >
              ตกลง (OK)
            </button>
          </div>
        </div>
      )}
    </>
  );
}
