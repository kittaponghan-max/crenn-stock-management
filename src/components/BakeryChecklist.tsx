import React, { useState, useMemo } from 'react';
import { CheckCircle2, Circle, ClipboardList, Save, Send, Clock, MapPin, Coffee, Package, CreditCard, Sparkles, AlertCircle, Calendar, User, Printer, LogOut, ChevronDown, FileDown, ChefHat, Check, Download } from 'lucide-react';
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

function highlightKeywords(label: string) {
  const keywords = ['เช็ค', 'ตรวจสอบ', 'ตั้งค่า', 'ทำความสะอาด'];
  const regex = new RegExp(`(${keywords.join('|')})`, 'g');
  const parts = label.split(regex);
  return parts.map((part, i) =>
    keywords.includes(part) ? (
      <span key={i} className="text-[#5A8A88] font-bold">{part}</span>
    ) : (
      part
    )
  );
}

export function BakeryChecklist({ onSave, user, checklistRecords = [], isReadOnly = false }: BakeryChecklistProps) {
  const [type, setType] = useState<'Check-in' | 'Check-out'>('Check-in');
  const reportDate = format(new Date(), 'yyyy-MM-dd');
  const reporterName = user.name;

  const branch = (user as any)?.branch || (() => {
    try {
      const savedUser = localStorage.getItem('cafe-user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed.branch) return parsed.branch;
      }
    } catch (e) {}
    return 'Rayong';
  })();

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
      console.warn('Error generating PDF:', error);
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF โปรดลองอีกครั้ง');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300" id="checklist-report">
      {/* Header Card */}
      <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(90,138,136,0.08)] border border-[#D4E4E3] overflow-hidden">
        <div className="bg-white p-5 sm:p-6 border-b border-[#D4E4E3]">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-[#E8F3F2] rounded-xl shrink-0 flex items-center justify-center text-[#5A8A88]">
                <ChefHat size={22} className="text-[#5A8A88]" />
              </div>
              <div>
                <h2 className="text-[16px] sm:text-[17px] font-bold text-[#2D4A49]">Kitchen Check-in & Check-out</h2>
                <p className="text-[#6B8F8E] text-[11px] max-w-[500px] leading-[1.5] mt-0.5">
                  {type === 'Check-in' 
                    ? 'การเตรียมตัวก่อนเปิดครัวในช่วงเช้าเป็นขั้นตอนที่สำคัญมาก เพื่อเตรียมความพร้อมสำหรับการทำขนมและเบเกอรี่ตลอดทั้งวัน'
                    : 'การทำ Checklist ช่วงปิดครัวที่ดีจะช่วยให้คนมาเปิดครัวในวันถัดไปทำงานได้ง่ายขึ้น และรักษามาตรฐานความสะอาดของส่วนครัว'}
                </p>
              </div>
            </div>
            
            <div className="relative print:hidden z-20 self-start md:self-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExportDropdownOpen(!isExportDropdownOpen);
                }}
                className="flex items-center gap-1 bg-white border border-[#D4E4E3] hover:bg-[#F0F5F4] text-[#2D4A49] text-[11px] font-[500] rounded-[8px] px-2.5 py-[6px] h-[32px] transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
                title="ส่งออกข้อมูล (Excel, PDF)"
              >
                <Download size={13} className="text-[#5A8A88]" />
                <span>ส่งออก</span>
                <ChevronDown size={11} className={cn("text-[#5A8A88] transition-transform duration-150", isExportDropdownOpen && "rotate-180")} />
              </button>

              {isExportDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-36 bg-white rounded-xl shadow-lg border border-[#D4E4E3] py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      exportExcel();
                      setIsExportDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-[11px] font-medium text-[#2D4A49] hover:bg-[#E8F3F2] flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Download size={13} className="text-[#5A8A88]" />
                    <span>Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      exportPDF();
                      setIsExportDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-[11px] font-medium text-[#2D4A49] hover:bg-[#E8F3F2] flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Printer size={13} className="text-[#5A8A88]" />
                    <span>PDF / พิมพ์</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Segmented Toggle Control */}
          <div className="mt-4 p-1 bg-[#F0F5F4] border border-[#D4E4E3] rounded-xl flex items-center gap-1">
            <button
              type="button"
              onClick={() => setType('Check-in')}
              className={cn(
                "flex-1 py-1.5 px-2.5 rounded-lg text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                type === 'Check-in'
                  ? "bg-[#5A8A88] text-white font-bold shadow-sm"
                  : "bg-transparent text-[#6B8F8E] font-medium hover:text-[#2D4A49] hover:bg-white/50"
              )}
            >
              <span>☀️</span>
              <span>เช็คลิสต์เปิดครัว (Check-in)</span>
            </button>
            <button
              type="button"
              onClick={() => setType('Check-out')}
              className={cn(
                "flex-1 py-1.5 px-2.5 rounded-lg text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                type === 'Check-out'
                  ? "bg-[#5A8A88] text-white font-bold shadow-sm"
                  : "bg-transparent text-[#6B8F8E] font-medium hover:text-[#2D4A49] hover:bg-white/50"
              )}
            >
              <span>🌙</span>
              <span>เช็คลิสต์ปิดครัว (Check-out)</span>
            </button>
          </div>

          {/* Meta Info Row */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F0F5F4] border border-[#D4E4E3] rounded-lg text-[11px] font-medium text-[#2D4A49]">
              <Calendar size={13} className="text-[#5A8A88]" />
              <span>วันที่: {format(new Date(reportDate), 'dd/MM/yyyy')}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F0F5F4] border border-[#D4E4E3] rounded-lg text-[11px] font-medium text-[#2D4A49]">
              <MapPin size={13} className="text-[#5A8A88]" />
              <span>สาขา: {branch}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F0F5F4] border border-[#D4E4E3] rounded-lg text-[11px] font-medium text-[#2D4A49]">
              <User size={13} className="text-[#5A8A88]" />
              <span>ผู้บันทึก: {reporterName}</span>
            </div>
            
            <div className="ml-auto flex items-center gap-2.5">
              <span className="text-[10px] sm:text-[11px] font-medium text-[#6B8F8E]">
                ความคืบหน้า <strong className="text-[#2D4A49]">{checkedItems}/{totalItems}</strong>
              </span>
              <div className="w-20 sm:w-28 h-1.5 bg-[#D4E4E3] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#5A8A88] transition-all duration-300 rounded-full" 
                  style={{ width: `${progress}%` }} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Checklist Content */}
        <div className="p-4 sm:p-5 bg-[#F8FAF9]/50 space-y-5">
          <div className={cn("space-y-5", isReadOnly && "pointer-events-none opacity-80")}>
            {categories.map((category) => {
              const catChecked = category.items.filter(i => i.checked).length;
              const catTotal = category.items.length;

              return (
                <div 
                  key={category.id} 
                  className="bg-white rounded-xl border border-[#D4E4E3] shadow-[0_1px_3px_rgba(90,138,136,0.05)] overflow-hidden"
                >
                  {/* Section Header */}
                  <div className="p-3 sm:px-4 sm:py-2.5 bg-white border-b border-[#E2EAE9] flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#E8F3F2] flex items-center justify-center shrink-0 text-[#5A8A88]">
                        {category.icon}
                      </div>
                      <h3 className="text-[12px] sm:text-[13px] font-bold text-[#2D4A49]">{category.title}</h3>
                    </div>
                    
                    <div className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold flex items-center gap-1 shrink-0",
                      catChecked === catTotal && catTotal > 0
                        ? "bg-[#E8F3F2] text-[#5A8A88]"
                        : "bg-[#F0F5F4] text-[#6B8F8E]"
                    )}>
                      <span>{catChecked}/{catTotal} สำเร็จ</span>
                    </div>
                  </div>

                  {/* Section Items */}
                  <div className="p-2.5 sm:p-3 space-y-1.5">
                    {category.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleItem(category.id, item.id)}
                        className={cn(
                          "w-full p-2 sm:px-3 sm:py-2 rounded-lg border text-left transition-all flex items-start gap-2.5 cursor-pointer group",
                          item.checked
                            ? "bg-[#F8FAF9] border-[#D4E4E3]"
                            : "bg-white border-[#E2EAE9] hover:border-[#B8D4D2] hover:bg-[#F8FAF9]"
                        )}
                      >
                        <div className="mt-0.5 shrink-0 transition-colors">
                          {item.checked ? (
                            <div className="w-4 h-4 rounded-md bg-[#5A8A88] flex items-center justify-center text-white shadow-xs">
                              <Check size={11} strokeWidth={3} />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-md border-2 border-[#B8D4D2] bg-white group-hover:border-[#5A8A88] transition-colors" />
                          )}
                        </div>
                        <span className={cn(
                          "text-[11px] leading-relaxed select-none",
                          item.checked ? "line-through text-[#6B8F8E]" : "text-[#2D4A49] font-medium"
                        )}>
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submit Action Button */}
          <div className="mt-8 pt-6 border-t border-[#E2EAE9] flex justify-end print:hidden">
            {!isReadOnly && (
              <button
                type="button"
                onClick={handleSubmit}
                className="w-full h-12 bg-[#5A8A88] hover:bg-[#4A7A78] text-white rounded-xl text-[14px] font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <CheckCircle2 size={18} />
                <span>บันทึกรายการตรวจสอบ ({type})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-[#D4E4E3]"
          >
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-[#E8F3F2] text-[#5A8A88] rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="text-[16px] font-bold text-[#2D4A49] mb-1.5">ยืนยันการบันทึกรายการ?</h3>
              <p className="text-[12px] text-[#6B8F8E] mb-5">
                คุณต้องการบันทึก {type} Checklist ของครัวใช่หรือไม่? ข้อมูลจะถูกบันทึกและไม่สามารถย้อนกลับได้
              </p>
              
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-2.5 bg-[#F0F5F4] text-[#6B8F8E] hover:text-[#2D4A49] rounded-xl text-[12px] font-semibold hover:bg-[#E2EAE9] transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={confirmSubmit}
                  className="px-4 py-2.5 bg-[#5A8A88] text-white rounded-xl text-[12px] font-semibold hover:bg-[#4A7A78] transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Save size={16} />
                  บันทึก
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
