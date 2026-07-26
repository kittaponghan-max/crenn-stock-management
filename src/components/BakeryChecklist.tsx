import React, { useState, useMemo } from 'react';
import { CheckCircle2, Circle, ClipboardList, Save, Send, Clock, MapPin, Coffee, Package, CreditCard, Sparkles, AlertCircle, Calendar, User, Printer, LogOut, ChevronDown, FileDown, ChefHat } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { Ingredient } from '../types';

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

interface ChecklistCategory {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: ChecklistItem[];
}

interface BakeryChecklistProps {
  onSave: (type: 'Check-in' | 'Check-out', data: any) => void;
  user: { name: string; role: string };
  checklistRecords?: any[];
  isReadOnly?: boolean;
}

export function BakeryChecklist({ onSave, user, checklistRecords = [], isReadOnly = false }: BakeryChecklistProps) {
  const [type, setType] = useState<'Check-in' | 'Check-out'>('Check-in');
  const reportDate = format(new Date(), 'yyyy-MM-dd');
  const reporterName = user.name;
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const initialCheckIn: ChecklistCategory[] = [
    {
      id: 'b_equipment',
      title: '1. ระบบไฟฟ้าและอุปกรณ์เครื่องจักร (Equipment & Utilities)',
      icon: <ChefHat size={20} />,
      items: [
        { id: 'be1', label: 'เปิดสวิตช์ไฟและพัดลมดูดอากาศในครัว', checked: false },
        { id: 'be2', label: 'เปิดเตาอบและตั้งค่าอุณหภูมิเพื่อวอร์มเตา (Pre-heat) สำหรับขนมล็อตแรก', checked: false },
        { id: 'be3', label: 'เปิดตู้พรูฟแป้ง (Proofing Cabinet) ตั้งค่าอุณหภูมิและความชื้นให้พร้อมใช้งาน', checked: false },
        { id: 'be4', label: 'ตรวจสอบและจดบันทึกอุณหภูมิตู้เย็น (ควรอยู่ที่ 2-4°C) และตู้แช่แข็ง (ควรอยู่ที่ -18°C) ว่าทำงานปกติ ไม่มีน้ำแข็งเกาะหนา', checked: false },
        { id: 'be5', label: 'ตรวจสอบการทำงานของเครื่องชั่งน้ำหนักดิจิทัล (เปิดเทสว่าตัวเลขขึ้นปกติ)', checked: false }
      ]
    },
    {
      id: 'b_prep',
      title: '2. การจัดการแป้งโดว์และขนม (Dough & Baking Process)',
      icon: <Coffee size={20} />,
      items: [
        { id: 'bp1', label: 'นำแป้งโดว์ที่พักไว้ข้ามคืน (Overnight Dough) ออกจากตู้เย็น เช่น ครัวซองต์, แป้งทาร์ต, หรือขนมปัง นำเข้าตู้พรูฟ หรือพักให้คลายความเย็น', checked: false },
        { id: 'bp2', label: 'นำขนมที่ทำเสร็จแล้วจากตู้เย็น/ตู้แช่แข็ง ออกมาจัดตกแต่ง (Garnish) เช่น บีบครีม, วางผลไม้สด', checked: false },
        { id: 'bp3', label: 'อบขนมล็อตเช้า (Morning Bake) เช่น พัฟ, ครัวซองต์, มัฟฟิน', checked: false },
        { id: 'bp4', label: 'ตรวจสอบเช็คสภาพขนมเค้กหรือขนมที่ค้างจากเมื่อวานในตู้แช่ ว่าหน้าตาและคุณภาพยังพร้อมขายหรือไม่ (ตามหลักอายุการเก็บรักษา - Shelf Life)', checked: false },
        { id: 'bp5', label: 'ส่งมอบขนมที่เสร็จแล้ว พร้อมจัดเรียงขึ้นตู้โชว์ (Showcase) ให้ทีมหน้าร้าน', checked: false }
      ]
    },
    {
      id: 'b_daily_prep',
      title: '3. การเตรียมวัตถุดิบประจำวัน (Daily Prep / Mise en place)',
      icon: <Package size={20} />,
      items: [
        { id: 'bdp1', label: 'เช็คและจัดเรียงวัตถุดิบตามระบบ FIFO (First In, First Out) ของเก่าใช้ก่อน ของใหม่ดันไว้ด้านหลัง', checked: false },
        { id: 'bdp2', label: 'ชั่งตวงวัตถุดิบ (Scaling) สำหรับสูตรขนมที่จะทำในวันนี้ (เช่น ตวงแป้ง, น้ำตาล, ผงฟู แยกใส่ถาดไว้)', checked: false },
        { id: 'bdp3', label: 'เตรียมส่วนผสมที่ต้องใช้ระหว่างวัน เช่น ตีวิปครีม, ทำซอสผลไม้, ละลายช็อกโกแลต, หรือหั่นผลไม้สด', checked: false },
        { id: 'bdp4', label: 'นำเนยและไข่ไก่ออกจากตู้เย็น เพื่อให้ได้อุณหภูมิห้อง (Room Temperature) ตามที่สูตรต้องการ', checked: false }
      ]
    },
    {
      id: 'b_inventory',
      title: '4. การจัดการสต็อก (Stock & Inventory)',
      icon: <ClipboardList size={20} />,
      items: [
        { id: 'bi1', label: 'ตรวจสอบวัตถุดิบหลัก (แป้ง, น้ำตาล, เนย, นม, ไข่) ว่าเพียงพอต่อยอดการผลิตวันนี้หรือไม่', checked: false },
        { id: 'bi2', label: 'แจ้งทีมสั่งซื้อหรือจดลงใบสั่งของ (Ordering List) ทันทีหากมีวัตถุดิบใดใกล้หมด (Below Minimum Stock)', checked: false }
      ]
    }
  ];

  const initialCheckOut: ChecklistCategory[] = [
    {
      id: 'bo_storage',
      title: '1. การจัดการขนมและวัตถุดิบที่เหลือ (Food & Waste Management)',
      icon: <Package size={20} />,
      items: [
        { id: 'bos1', label: 'เก็บขนมและวัตถุดิบที่เหลือเข้าตู้เย็น โดย ต้องใส่กล่องปิดฝามิดชิด หรือซีลพลาสติก (Wrap) ทุกครั้ง', checked: false },
        { id: 'bos2', label: 'ติดป้ายชื่อและวันที่ (Date Labeling) บนกล่องวัตถุดิบที่เปิดใช้แล้ว หรือขนมที่เตรียมไว้ เพื่อใช้เช็คอายุการเก็บ', checked: false },
        { id: 'bos3', label: 'ทิ้งขนมหรือวัตถุดิบที่หมดอายุ/ไม่ได้คุณภาพ พร้อมจดบันทึกลงใน Waste Log (สมุดจดของเสีย) เพื่อนำไปคำนวณต้นทุน', checked: false },
        { id: 'bos4', label: 'เคลียร์ของสด เช่น ผลไม้ตกแต่ง หรือครีมที่เหลือ หากเก็บไม่ได้ให้ทิ้ง ห้ามปล่อยคาตู้เย็น', checked: false }
      ]
    },
    {
      id: 'bo_prep_tmr',
      title: '2. การเตรียมงานสำหรับวันพรุ่งนี้ (Prep for Tomorrow)',
      icon: <Coffee size={20} />,
      items: [
        { id: 'bot1', label: 'นวดแป้งโดว์ หรือผสมส่วนผสมที่ต้องพักข้ามคืน (Overnight Retardation) และเก็บเข้าตู้เย็น', checked: false },
        { id: 'bot2', label: 'นำวัตถุดิบแช่แข็งที่ต้องใช้พรุ่งนี้ (เช่น เนย, ซอสผลไม้แช่แข็ง, แป้งแช่แข็ง) ลงมาละลาย (Defrost) ในตู้เย็นช่องธรรมดา', checked: false },
        { id: 'bot3', label: 'ชั่งตวงของแห้ง (Dry Ingredients) สำหรับคิวงานอบตอนเช้าของวันพรุ่งนี้ เพื่อความรวดเร็ว', checked: false }
      ]
    },
    {
      id: 'bo_cleaning',
      title: '3. การทำความสะอาดเครื่องมือและอุปกรณ์ (Equipment Cleaning)',
      icon: <Sparkles size={20} />,
      items: [
        { id: 'boc1', label: 'ปิดเตาอบ (ทิ้งไว้ให้คลายความร้อน) จากนั้นใช้ผ้าชุบน้ำหมาดเช็ดคราบเนย/เศษขนมปังภายในเตาและหน้ากระจก', checked: false },
        { id: 'boc2', label: 'ทำความสะอาดเครื่องผสมอาหาร (Stand Mixer) ทั้งตัวเครื่อง, หัวตี (ตะกร้อ/ใบไม้/ตะขอ) และโถผสมอาหาร ให้ปราศจากคราบไขมัน', checked: false },
        { id: 'boc3', label: 'เทน้ำออกจากตู้พรูฟแป้ง และเช็ดทำความสะอาดภายในตู้ไม่ให้มีคราบน้ำขัง (ป้องกันเชื้อรา)', checked: false },
        { id: 'boc4', label: 'ล้างทำความสะอาดถาดอบ, พิมพ์ขนม, แผ่นซิลิโคน (Silpat), ไม้พาย, ถ้วยตวง นำไปผึ่งหรือเช็ดให้แห้งสนิท', checked: false },
        { id: 'boc5', label: 'เก็บอุปกรณ์ทั้งหมดเข้าตู้หรือชั้นวางให้เป็นระเบียบ', checked: false }
      ]
    },
    {
      id: 'bo_area_cleaning',
      title: '4. การทำความสะอาดพื้นที่ครัว (Area Cleaning)',
      icon: <Sparkles size={20} />,
      items: [
        { id: 'boa1', label: 'เช็ดทำความสะอาดโต๊ะสแตนเลส/โต๊ะเตรียมขนม (Workbench) ด้วยน้ำยาทำความสะอาดและน้ำยาฆ่าเชื้อ (Sanitizer)', checked: false },
        { id: 'boa2', label: 'ขัดล้างอ่างล้างจาน (Sink) และตักเศษอาหารออกจาก บ่อดักไขมัน (Grease Trap) (ควรทำทุกวันเพื่อไม่ให้ท่อตันและส่งกลิ่นเหม็น)', checked: false },
        { id: 'boa3', label: 'กวาดเศษแป้ง ขยะ บนพื้น และถูพื้นครัวด้วยน้ำยาทำความสะอาดพื้น', checked: false },
        { id: 'boa4', label: 'รวบรวมขยะเปียกและขยะแห้งทั้งหมดในครัว มัดปากถุงให้สนิท และนำไปทิ้งที่จุดทิ้งขยะด้านนอก (ห้ามมีขยะค้างคืนในครัวเด็ดขาด ป้องกันหนูและแมลงสาบ)', checked: false }
      ]
    },
    {
      id: 'bo_security',
      title: '5. ความปลอดภัยก่อนออกจากครัว (Safety Check)',
      icon: <CreditCard size={20} />,
      items: [
        { id: 'boe1', label: 'ตรวจสอบว่า ปิดสวิตช์เตาอบ, เครื่องผสม, ตู้พรูฟ และถอดปลั๊กเครื่องใช้ไฟฟ้าขนาดเล็ก เรียบร้อยแล้ว (ยกเว้นตู้เย็น/ตู้แช่แข็ง)', checked: false },
        { id: 'boe2', label: 'เช็คว่าปิดวาล์วแก๊ส (ถ้ามีเตาแก๊ส) และก็อกน้ำทุกจุดสนิทดี', checked: false },
        { id: 'boe3', label: 'ผลักประตูตู้เย็นและตู้แช่แข็งให้แน่ใจว่าปิดสนิท ยางขอบประตูดูดติดแน่น ไม่มีรอยเผยอ', checked: false },
        { id: 'boe4', label: 'ปิดไฟและพัดลมดูดอากาศในครัวเป็นลำดับสุดท้าย', checked: false }
      ]
    }
  ];

  const [checkInCategories, setCheckInCategories] = useState<ChecklistCategory[]>(initialCheckIn);
  const [checkOutCategories, setCheckOutCategories] = useState<ChecklistCategory[]>(initialCheckOut);

  const categories = type === 'Check-in' ? checkInCategories : checkOutCategories;

  const toggleItem = (categoryId: string, itemId: string) => {
    const setter = type === 'Check-in' ? setCheckInCategories : setCheckOutCategories;
    setter(prev => prev.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          items: cat.items.map(item => 
            item.id === itemId ? { ...item, checked: !item.checked } : item
          )
        };
      }
      return cat;
    }));
  };

  const isAllChecked = categories.every(cat => cat.items.every(item => item.checked));
  const totalItems = categories.reduce((acc, cat) => acc + cat.items.length, 0);
  const checkedItems = categories.reduce((acc, cat) => acc + cat.items.filter(i => i.checked).length, 0);
  const progress = (checkedItems / totalItems) * 100;

  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const summaryData = [
      ['รายงาน', `Bakery ${type}`],
      ['วันที่', format(new Date(reportDate), 'dd/MM/yyyy')],
      ['ผู้ทำรายงาน', reporterName],
      ['ความคืบหน้า', `${checkedItems} / ${totalItems}`],
      [],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    const checklistData = [
      ['หมวดหมู่', 'รายการ', 'สถานะ']
    ];

    categories.forEach(cat => {
      cat.items.forEach(item => {
        checklistData.push([cat.title, item.label, item.checked ? 'ผ่าน / เรียบร้อย' : 'ยังไม่เรียบร้อย']);
      });
    });

    const wsChecklist = XLSX.utils.aoa_to_sheet(checklistData);
    XLSX.utils.book_append_sheet(wb, wsChecklist, 'Checklist');

    XLSX.writeFile(wb, `Bakery_${type}_${format(new Date(reportDate), 'yyyyMMdd')}.xlsx`);
  };

  React.useEffect(() => {
    const handleClickOutside = () => {
      if (isExportDropdownOpen) setIsExportDropdownOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isExportDropdownOpen]);

  const handleSubmit = () => {
    setShowConfirm(true);
  };

  const confirmSubmit = () => {
    setShowConfirm(false);
    
    onSave(type, {
      timestamp: new Date().toISOString(),
      reportDate,
      reporterName,
      department: 'Bakery',
      categories: categories.map(cat => ({
        title: cat.title,
        items: cat.items.map(i => ({ label: i.label, checked: i.checked }))
      }))
    });
  };

  const exportPDF = async () => {
    const element = document.getElementById('checklist-report');
    if (!element) return;

    try {
      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');

      const imgData = await toPng(element, {
        backgroundColor: '#f8fafc',
        pixelRatio: 2,
        filter: (node) => {
          if (node instanceof HTMLElement && node.classList?.contains('print:hidden')) {
            return false;
          }
          return true;
        }
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Bakery_${type}_${format(new Date(reportDate), 'yyyyMMdd')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF โปรดลองอีกครั้ง');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300" id="checklist-report">
      {/* Header Card */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200">
        <div className="bg-amber-500 p-8 text-white relative rounded-t-3xl">
          <div className="absolute inset-0 overflow-hidden rounded-t-3xl pointer-events-none">
            <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
              <ClipboardList size={120} />
            </div>
          </div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-400 rounded-xl">
                  <ChefHat size={24} />
                </div>
                <h2 className="text-2xl font-bold">Kitchen Check-in & Check-out</h2>
              </div>
              <p className="text-amber-50 text-sm max-w-xl">
                {type === 'Check-in' 
                  ? 'การเตรียมตัวก่อนเปิดครัวในช่วงเช้าเป็นขั้นตอนที่สำคัญมาก เพื่อเตรียมความพร้อมสำหรับการทำขนมและเบเกอรี่ตลอดทั้งวัน'
                  : 'การทำ Checklist ช่วงปิดครัวที่ดีจะช่วยให้คนมาเปิดครัวในวันถัดไปทำงานได้ง่ายขึ้น และรักษามาตรฐานความสะอาดของส่วนครัว'}
              </p>
            </div>
            
            <div className="relative print:hidden z-20">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExportDropdownOpen(!isExportDropdownOpen);
                }}
                className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 border border-amber-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm"
              >
                <Printer size={16} />
                Export / Print
                <ChevronDown size={14} className={cn("transition-transform", isExportDropdownOpen && "rotate-180")} />
              </button>

              {isExportDropdownOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportExcel();
                      setIsExportDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-[14px] text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors font-medium"
                  >
                    <FileDown size={16} className="text-emerald-600" />
                    Excel (.xlsx)
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportPDF();
                      setIsExportDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-[14px] text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors font-medium"
                  >
                    <Printer size={16} className="text-blue-600" />
                    PDF / Print
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Calendar size={14} />
                วันที่รายงาน
              </label>
              <div className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm flex items-center">
                {format(new Date(reportDate), 'dd/MM/yyyy')}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <User size={14} />
                ผู้ทำรายงาน
              </label>
              <div className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm flex items-center">
                {reporterName}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                onClick={() => setType('Check-in')}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                  type === 'Check-in' ? "bg-white text-amber-600 shadow-md" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Clock size={18} />
                Check-in (เช้า)
              </button>
              <button
                onClick={() => setType('Check-out')}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                  type === 'Check-out' ? "bg-white text-amber-600 shadow-md" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <LogOut size={18} />
                Check-out (เย็น)
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">ความคืบหน้า</div>
                <div className="text-lg font-black text-slate-800">{checkedItems} / {totalItems}</div>
              </div>
              <div className="w-32 h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-amber-500"
                />
              </div>
            </div>
          </div>

          <div className={cn("space-y-8", isReadOnly && "pointer-events-none opacity-80")}>
            {categories.map((category) => (
              <div key={category.id} className="space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                    {category.icon}
                  </div>
                  <h3 className="font-bold text-slate-800">{category.title}</h3>
                </div>
                <div className="grid gap-3">
                  {category.items.map((item) => (
                    <div key={item.id} className="space-y-2">
                      <button
                        onClick={() => toggleItem(category.id, item.id)}
                        className={cn(
                          "w-full flex items-start gap-4 p-4 rounded-2xl border transition-all text-left group",
                          item.checked 
                            ? "bg-amber-50 border-amber-200 text-amber-900" 
                            : "bg-white border-slate-200 text-slate-600 hover:border-amber-200 hover:bg-slate-50"
                        )}
                      >
                        <div className={cn(
                          "mt-0.5 shrink-0 transition-colors",
                          item.checked ? "text-amber-600" : "text-slate-300 group-hover:text-amber-400"
                        )}>
                          {item.checked ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                        </div>
                        <span className="text-[14px] leading-relaxed font-medium">{item.label}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex justify-end print:hidden">
            {!isReadOnly && (
              <button
                onClick={handleSubmit}
                disabled={!isAllChecked}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md shadow-amber-500/20"
              >
                <Save size={20} />
                บันทึก Checklist
              </button>
            )}
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm print:hidden">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-6 rounded-3xl max-w-sm w-full border border-slate-200 shadow-xl"
          >
            <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-center text-slate-800 mb-2">ยืนยันการบันทึก</h3>
            <p className="text-slate-500 text-center mb-6 text-sm">
              คุณต้องการบันทึก {type} Checklist ของครัวใช่หรือไม่? <br/> ข้อมูลจะถูกบันทึกและไม่สามารถย้อนกลับได้
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmSubmit}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-600 transition-colors shadow-md shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                <Save size={18} />
                บันทึก
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
