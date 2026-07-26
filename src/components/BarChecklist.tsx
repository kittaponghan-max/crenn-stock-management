import React, { useState, useMemo } from 'react';
import { CheckCircle2, Circle, ClipboardList, Save, Send, Clock, MapPin, Coffee, Package, CreditCard, Sparkles, AlertCircle, Calendar, User, Printer, LogOut, ChevronDown, FileDown } from 'lucide-react';
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

interface BarChecklistProps {
  ingredients: Ingredient[];
  onSave: (type: 'Check-in' | 'Check-out', data: any) => void;
  user: { name: string; role: string };
  checklistRecords?: any[];
  isReadOnly?: boolean;
}

export function BarChecklist({ ingredients, onSave, user, checklistRecords = [], isReadOnly = false }: BarChecklistProps) {
  const [type, setType] = useState<'Check-in' | 'Check-out'>('Check-in');
  const reportDate = format(new Date(), 'yyyy-MM-dd');
  const reporterName = user.name;
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [coffeeWeights, setCoffeeWeights] = useState<Record<string, string>>({});
  const [coffeeDialIn, setCoffeeDialIn] = useState<Record<string, { dose: string; yield: string; time: string }>>({});
  const [cashInDrawer, setCashInDrawer] = useState<string>('');
  const [cupCounts, setCupCounts] = useState<{ 
    '16oz': { sleeves: string; loose: string }; 
    '12oz': { sleeves: string; loose: string }; 
    '8oz': { sleeves: string; loose: string } 
  }>({ 
    '16oz': { sleeves: '', loose: '' }, 
    '12oz': { sleeves: '', loose: '' }, 
    '8oz': { sleeves: '', loose: '' } 
  });
  
  const [cupUsage, setCupUsage] = useState<{
    '16oz': { added: string; remainingSleeves: string; remainingLoose: string };
    '12oz': { added: string; remainingSleeves: string; remainingLoose: string };
    '8oz': { added: string; remainingSleeves: string; remainingLoose: string };
  }>({
    '16oz': { added: '', remainingSleeves: '', remainingLoose: '' },
    '12oz': { added: '', remainingSleeves: '', remainingLoose: '' },
    '8oz': { added: '', remainingSleeves: '', remainingLoose: '' }
  });
  
  // Sales summary state for Check-out
  const [salesSummary, setSalesSummary] = useState({
    total: '',
    totalCashInDrawer: '',
    cash: '',
    transfer: '',
    notes: ''
  });

  const [machineStatus, setMachineStatus] = useState({ steamBoiler: '', pumpPressure: '', temp: '' });
  const [waterQuality, setWaterQuality] = useState('');
  const [fridgeStatus, setFridgeStatus] = useState({
    chillerTemp: '',
    chillerStatus: '',
    freezerTemp: '',
    freezerStatus: ''
  });

  const coffeeIngredients = ingredients.filter(ing => ing.category === 'Coffee');

  const initialCheckIn: ChecklistCategory[] = [
    {
      id: 'ambiance',
      title: '1. การเตรียมความพร้อมของสถานที่ (Ambiance & Cleanliness)',
      icon: <Sparkles size={20} />,
      items: [
        { id: 'a1', label: 'ความสะอาดภายนอกและภายใน: ปัดกวาดเช็ดถูทางเดินหน้าร้าน กระจก พื้น โต๊ะ และที่นั่งให้พร้อมใช้งาน', checked: false },
        { id: 'a2', label: 'ระบบไฟและอากาศ: เปิดไฟในร้านและป้ายไฟหน้าร้าน เช็คระบบเครื่องปรับอากาศหรือพัดลมให้ทำงานปกติ', checked: false },
        { id: 'a3', label: 'ห้องน้ำ: ตรวจเช็คความสะอาด เติมกระดาษชำระ สบู่ล้างมือ และเช็คความเรียบร้อยของชักโครก', checked: false },
        { id: 'a4', label: 'เสียงเพลง: เปิดเพลงสร้างบรรยากาศที่เหมาะสมกับสไตล์ร้าน', checked: false },
      ]
    },
    {
      id: 'equipment',
      title: '2. สถานีชงเครื่องดื่มและอุปกรณ์ (Coffee Bar & Equipment)',
      icon: <Coffee size={20} />,
      items: [
        { id: 'e1', label: 'เครื่องชงและเครื่องบดกาแฟ: เปิดเครื่องล่วงหน้าเพื่อให้เครื่องร้อนพร้อมใช้งาน ตรวจสอบความสะอาดของด้ามชง (Portafilter) และหัวกรุ๊ป', checked: false },
        { id: 'e_machine_ready', label: 'ทำการตรวจความพร้อมเครื่องชง โดยกรอกข้อมูล ค่าแรงดัน Steam Boiler, Pump และอุณหภูมิ', checked: false },
        { id: 'e_water_quality', label: 'ทำการตรวจวัดค่าน้ำ และกรอกข้อมูล (ppm)', checked: false },
        { id: 'e_coffee_weigh', label: 'ชั่งน้ำหนักเมล็ดกาแฟทุกชนิดที่มีในสต็อก (กรอกน้ำหนักก่อนใช้งาน)', checked: false },
        { id: 'e2', label: 'การตั้งค่ารสชาติ (Dial-in Coffee): ชิมรสชาติเอสเพรสโซ่ช็อตแรกของวันเพื่อปรับค่าบดเมล็ดกาแฟให้ได้มาตรฐาน', checked: false },
        { id: 'e3', label: 'อุปกรณ์เบ็ดเตล็ด: เช็คความพร้อมของเครื่องตีฟองนม เครื่องปั่น เครื่องชั่งน้ำหนัก และช้อนตวงต่างๆ', checked: false },
        { id: 'e4', label: 'น้ำแข็ง: ตรวจดูปริมาณน้ำแข็งในถังหรือความเรียบร้อยของเครื่องทำน้ำแข็ง', checked: false },
        { id: 'e_fridge_temp', label: 'ทำการตรวจอุณหภูมิของตู้แช่เย็น และตู้แช่แข็ง และกรอกข้อมูล', checked: false },
      ]
    },
    {
      id: 'inventory',
      title: '3. วัตถุดิบและสต็อกสินค้า (Inventory & Stock)',
      icon: <Package size={20} />,
      items: [
        { id: 'i1', label: 'เมล็ดกาแฟและผงเครื่องดื่ม: เติมเมล็ดกาแฟในโถบด และเตรียมผงโกโก้ ชา หรือส่วนผสมอื่นๆ ให้เต็ม', checked: false },
        { id: 'i2', label: 'นมและของสด: ตรวจสอบวันหมดอายุของนม วิปปิ้งครีม และจัดเรียงในตู้เย็นให้หยิบง่าย และชิมรสชาติ ของส่วนผสมที่เตรียมไว้ หรือน้ำผลไม้สด ต่างๆ เช่น น้ำส้ม น้ำมะพร้าว น้ำเสาวรส นมสดที่เปิดขวดแล้ว ว่ายังมีรสชาติปกติ ไม่บูด ไม่เน่าเสีย', checked: false },
        { id: 'i3', label: 'เบเกอรี่และอาหาร: จัดวางขนมในตู้โชว์ให้สวยงาม พร้อมติดป้ายชื่อและราคาให้ชัดเจน', checked: false },
        { id: 'i4', label: 'บรรจุภัณฑ์: เติมแก้ว ฝา หลอด กระดาษทิชชู และถุงหิ้วที่เคาน์เตอร์', checked: false },
      ]
    },
    {
      id: 'pos',
      title: '4. ระบบการเงินและพนักงาน (POS & Staff)',
      icon: <CreditCard size={20} />,
      items: [
        { id: 'p1', label: 'เงินทอน: ตรวจสอบเงินสดในลิ้นชักและจัดเตรียมเงินทอนให้เพียงพอ', checked: false },
        { id: 'p2', label: 'ระบบ POS: เปิดระบบเครื่องคิดเงิน เช็คการเชื่อมต่ออินเทอร์เน็ต และเครื่องพิมพ์ใบเสร็จ', checked: false },
        { id: 'p3', label: 'ความพร้อมของพนักงาน: เช็คการลงเวลาทำงาน ความเรียบร้อยของเครื่องแบบ และ Brief เมนูพิเศษหรือโปรโมชั่นประจำวัน', checked: false },
      ]
    }
  ];

  const initialCheckOut: ChecklistCategory[] = [
    {
      id: 'equipment_out',
      title: '1. เครื่องชงกาแฟและอุปกรณ์บาร์ (The Heart of Bar)',
      icon: <Coffee size={20} />,
      items: [
        { id: 'eo1', label: 'Backflush เครื่องชง: ล้างหัวกรุ๊ปด้วยผงล้างเครื่องชงกาแฟและแปรงขัดให้สะอาด', checked: false },
        { id: 'e_coffee_weigh', label: 'ชั่งน้ำหนักเมล็ดกาแฟทุกชนิดที่มีในสต็อก (กรอกน้ำหนักหลังปิดร้าน)', checked: false },
        { id: 'eo2', label: 'ทำความสะอาดเครื่องบด: ปิดวาล์วโถเมล็ดกาแฟ (Hopper) นำเมล็ดที่ค้างออก และปัดกวาดผงกาแฟที่ตกค้าง', checked: false },
        { id: 'eo3', label: 'ล้างอุปกรณ์ใช้งาน: ล้างก้านชง (Portafilter), ตะแกรง (Basket), เหยือกสตรีมนม (Pitcher) และช้อนตวง ตากให้แห้ง', checked: false },
        { id: 'eo4', label: 'ทำความสะอาดท่อสตรีมนม: ไล่ไอน้ำและเช็ดคราบนมที่ก้านสตรีมให้สะอาดหมดจด', checked: false },
        { id: 'eo5', label: 'ล้างถังเคาะกากกาแฟ (Knock Box): ทิ้งกากกาแฟและล้างทำความสะอาด', checked: false },
      ]
    },
    {
      id: 'inventory_out',
      title: '2. สต็อกและวัตถุดิบ (Inventory & Food Safety)',
      icon: <Package size={20} />,
      items: [
        { id: 'io1', label: 'เช็คของสด: ตรวจสอบวันหมดอายุของนม วิปปิ้งครีม และน้ำผลไม้ (ใช้วิธี FIFO)', checked: false },
        { id: 'io2', label: 'จัดเก็บเบเกอรี่: เก็บขนมที่ไม่ใช้แล้วเข้าตู้เย็นหรือภาชนะปิดมิดชิดตามความเหมาะสม', checked: false },
        { id: 'io3', label: 'เช็คสต็อกเตรียมสั่ง: จดรายการวัตถุดิบที่ใกล้หมดเพื่อสั่งของในรอบถัดไป', checked: false },
        { id: 'io4', label: 'ทำความสะอาดตู้แช่: เช็ดคราบน้ำหรือเศษอาหารในตู้เย็นและตู้โชว์ขนม', checked: false },
        { id: 'io5', label: 'บรรจุภัณฑ์: ตรวจนับแก้ว (16oz, 12oz, 8oz) เพื่อตรวจสอบการใช้งาน', checked: false },
      ]
    },
    {
      id: 'cleanliness_out',
      title: '3. ความสะอาดและสถานที่ (Front & Back of House)',
      icon: <Sparkles size={20} />,
      items: [
        { id: 'co1', label: 'ทำความสะอาดเตาอบ/ไมโครเวฟ: เช็ดเศษขนมหรือคราบไหม้ในเตาอบ (รอให้เครื่องเย็นลงก่อน)', checked: false },
        { id: 'co2', label: 'เช็ดตู้โชว์ขนม: ล้างถาดวางขนมและเช็ดคราบละอองน้ำหรือเศษขนมในตู้ดิสเพลย์', checked: false },
        { id: 'co3', label: 'ล้างเคาน์เตอร์และซิงค์: เช็ดโต๊ะบาร์และล้างอ่างล้างจานให้แห้งเพื่อป้องกันแมลงสาบและมด เปลี่ยน ตาข่ายกรองเศษอาหาร ที่ซิงค์ ต้องไม่มีการล้างเศษอาหารใดๆ อีกหลังปิดร้าน', checked: false },
        { id: 'co4', label: 'ล้างระบบระบายน้ำ: ตรวจเช็คตะแกรงดักไขมัน (Grease Trap) เฉพาะวันเสาร์', checked: false },
        { id: 'co6', label: 'ทำความสะอาดพื้น: กวาดและถูพื้นร้าน รวมถึงเช็ดคราบสกปรกบนโต๊ะ-เก้าอี้ลูกค้า', checked: false },
        { id: 'co7', label: 'เช็คห้องน้ำ: ทำความสะอาดและเติมของใช้ (ทิชชู/สบู่) ให้พร้อมสำหรับเช้าวันรุ่งขึ้น', checked: false },
        { id: 'co5', label: 'จัดการขยะ: รวบรวมขยะทุกจุดไปทิ้งนอกร้าน และเปลี่ยนถุงขยะใหม่ ถังขยะหลังเปลี่ยนถุงขยะใหม่ ต้องไม่มีการทิ้งเศษอาหารใดๆ อีกหลังปิดร้าน', checked: false },
      ]
    },
    {
      id: 'security_out',
      title: '4. ระบบไฟและความปลอดภัย (Security & Utilities)',
      icon: <CreditCard size={20} />,
      items: [
        { id: 'so1', label: 'ปิดระบบไฟและเครื่องใช้ไฟฟ้า: ปิดไฟ ป้ายไฟ แอร์', checked: false },
        { id: 'so2', label: 'ดึงปลั๊กเครื่องใช้ไฟฟ้า: เตาอบ, ไมโครเวฟ, กาต้มน้ำไฟฟ้า (ยกเว้นตู้เย็น/ตู้แช่)', checked: false },
        { id: 'so_sales', label: 'สรุปยอดขาย: ปิดกะในระบบ POS ตรวจสอบเงินสดในลิ้นชัก และลงบันทึกยอดขายประจำวัน', checked: false },
        { id: 'so3', label: 'ตรวจเช็คประตู-หน้าต่าง: ตรวจดูการล็อกประตูหน้าและหลังร้านให้เรียบร้อย', checked: false },
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

  const todayCheckIn = useMemo(() => {
    return checklistRecords.find(r => r.type === 'Check-in' && r.reportDate === reportDate);
  }, [checklistRecords, reportDate]);

  const getBroughtForward = (size: '16oz' | '12oz' | '8oz') => {
    if (!todayCheckIn || !todayCheckIn.cupCounts || !todayCheckIn.cupCounts[size]) return 0;
    const count = todayCheckIn.cupCounts[size];
    if (typeof count === 'string') return parseInt(count) || 0;
    return ((parseInt(count.sleeves) || 0) * 50) + (parseInt(count.loose) || 0);
  };

  const checkInCash = parseFloat(todayCheckIn?.cashInDrawer || '0');

  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
      ['รายงาน', `Bar ${type}`],
      ['วันที่', format(new Date(reportDate), 'dd/MM/yyyy')],
      ['ผู้ทำรายงาน', reporterName],
      ['ความคืบหน้า', `${checkedItems} / ${totalItems}`],
      [],
    ];

    if (type === 'Check-in' && cashInDrawer) {
      summaryData.push(['เงินสดเริ่มต้น (บาท)', cashInDrawer]);
      summaryData.push([]);
    }

    if (type === 'Check-in' && (machineStatus.steamBoiler || machineStatus.pumpPressure || machineStatus.temp)) {
      summaryData.push(['ตรวจความพร้อมเครื่องชง', '']);
      summaryData.push(['Steam Boiler (bar)', machineStatus.steamBoiler || '-']);
      summaryData.push(['Pump Pressure (bar)', machineStatus.pumpPressure || '-']);
      summaryData.push(['อุณหภูมิ (°C)', machineStatus.temp || '-']);
      summaryData.push([]);
    }

    if (type === 'Check-in' && waterQuality) {
      summaryData.push(['ค่าน้ำ (ppm)', waterQuality]);
      summaryData.push([]);
    }

    if (type === 'Check-in' && (fridgeStatus.chillerTemp || fridgeStatus.freezerTemp || fridgeStatus.chillerStatus || fridgeStatus.freezerStatus)) {
      summaryData.push(['อุณหภูมิตู้แช่เย็น', '']);
      summaryData.push(['สถานะ', fridgeStatus.chillerStatus || '-']);
      summaryData.push(['อุณหภูมิ (°C)', fridgeStatus.chillerTemp || '-']);
      summaryData.push(['อุณหภูมิตู้แช่แข็ง', '']);
      summaryData.push(['สถานะ', fridgeStatus.freezerStatus || '-']);
      summaryData.push(['อุณหภูมิ (°C)', fridgeStatus.freezerTemp || '-']);
      summaryData.push([]);
    }

    if (type === 'Check-out' && salesSummary.total) {
      summaryData.push(['สรุปยอดขาย', '']);
      summaryData.push(['ยอดขายทั้งหมด', salesSummary.total || '0']);
      summaryData.push(['เงินสดภายในลิ้นชักทั้งหมด', salesSummary.totalCashInDrawer || '0']);
      summaryData.push(['เงินสด (Cash)', salesSummary.cash || '0']);
      summaryData.push(['เงินโอน (Transfer)', salesSummary.transfer || '0']);
      summaryData.push(['หมายเหตุ', salesSummary.notes || '-']);
      summaryData.push([]);
    }

    // specific data handling
    const hasCoffeeWeights = Object.keys(coffeeWeights).length > 0;
    if (hasCoffeeWeights) {
      summaryData.push(['น้ำหนักเมล็ดกาแฟ', 'ปริมาณ (กรัม)']);
      coffeeIngredients.forEach(ing => {
        if (coffeeWeights[ing.id]) {
          summaryData.push([ing.name, coffeeWeights[ing.id]]);
        }
      });
      summaryData.push([]);
    }

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Checklist Sheet
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

    XLSX.writeFile(wb, `Bar_${type}_${format(new Date(reportDate), 'yyyyMMdd')}.xlsx`);
  };

  React.useEffect(() => {
    const handleClickOutside = () => {
      if (isExportDropdownOpen) setIsExportDropdownOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isExportDropdownOpen]);

  React.useEffect(() => {
    if (type === 'Check-out') {
      const totalSales = parseFloat(salesSummary.total || '0');
      const currentDrawer = parseFloat(salesSummary.totalCashInDrawer || '0');
      
      const cashSales = Math.max(0, currentDrawer - checkInCash);
      const transferSales = Math.max(0, totalSales - cashSales);

      setSalesSummary(prev => {
        const newCash = cashSales > 0 ? cashSales.toString() : '';
        const newTransfer = transferSales > 0 ? transferSales.toString() : '';
        if (prev.cash !== newCash || prev.transfer !== newTransfer) {
          return { ...prev, cash: newCash, transfer: newTransfer };
        }
        return prev;
      });
    }
  }, [salesSummary.total, salesSummary.totalCashInDrawer, checkInCash, type]);

  const handleSubmit = () => {
    setShowConfirm(true);
  };

  const confirmSubmit = () => {
    setShowConfirm(false);
    
    // Check if coffee weights are filled if the item is checked
    const weighItem = categories.find(c => c.id === 'equipment' || c.id === 'equipment_out')?.items.find(i => i.id === 'e_coffee_weigh');
    if (weighItem?.checked) {
      const unfilled = coffeeIngredients.some(ing => !coffeeWeights[ing.id]);
      if (unfilled) {
        if (!window.confirm('คุณยังกรอกน้ำหนักเมล็ดกาแฟไม่ครบ ต้องการบันทึกใช่หรือไม่?')) return;
      }
    }

    onSave(type, {
      timestamp: new Date().toISOString(),
      reportDate,
      reporterName,
      coffeeWeights,
      coffeeDialIn: type === 'Check-in' ? coffeeDialIn : undefined,
      machineStatus: type === 'Check-in' ? machineStatus : undefined,
      waterQuality: type === 'Check-in' ? waterQuality : undefined,
      fridgeStatus: type === 'Check-in' ? fridgeStatus : undefined,
      cashInDrawer: type === 'Check-in' ? cashInDrawer : undefined,
      cupCounts: type === 'Check-in' ? cupCounts : undefined,
      cupUsage: type === 'Check-out' ? cupUsage : undefined,
      salesSummary: type === 'Check-out' ? salesSummary : undefined,
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
        backgroundColor: '#f8fafc', // slate-50
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

      pdf.save(`Bar_${type}_${format(new Date(reportDate), 'yyyyMMdd')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF โปรดลองอีกครั้ง');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300" id="checklist-report">
      {/* Header Card */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200">
        <div className="bg-slate-800 p-8 text-white relative rounded-t-3xl">
          <div className="absolute inset-0 overflow-hidden rounded-t-3xl pointer-events-none">
            <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
              <ClipboardList size={120} />
            </div>
          </div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-500 rounded-xl">
                  <Clock size={24} />
                </div>
                <h2 className="text-2xl font-bold">Bar Check-in & Check-out</h2>
              </div>
              <p className="text-slate-400 text-sm max-w-xl">
                {type === 'Check-in' 
                  ? 'การเตรียมตัวก่อนเปิดร้านคาเฟ่ในช่วงเช้าเป็นขั้นตอนที่สำคัญมาก เพื่อให้การทำงานตลอดทั้งวันราบรื่นและลดข้อผิดพลาดหน้างาน'
                  : 'การทำ Checklist ช่วงปิดร้านที่ดีจะช่วยให้คนเปิดร้านตอนเช้าทำงานง่ายขึ้น และช่วยรักษามาตรฐานความสะอาดรวมถึงอายุการใช้งานของอุปกรณ์'}
              </p>
            </div>
            
            <div className="relative print:hidden z-20">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExportDropdownOpen(!isExportDropdownOpen);
                }}
                className="flex items-center justify-center gap-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
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
                    className="w-full flex items-center gap-3 px-4 py-2 text-[14px] text-slate-700 hover:bg-slate-50 transition-colors font-medium"
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
                    className="w-full flex items-center gap-3 px-4 py-2 text-[14px] text-slate-700 hover:bg-slate-50 transition-colors font-medium"
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
          {/* Report Info Section */}
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
                  type === 'Check-in' ? "bg-white text-blue-600 shadow-md" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Clock size={18} />
                Check-in (เช้า)
              </button>
              <button
                onClick={() => setType('Check-out')}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                  type === 'Check-out' ? "bg-white text-blue-600 shadow-md" : "text-slate-500 hover:text-slate-700"
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
                  className="h-full bg-blue-500"
                />
              </div>
            </div>
          </div>

          <div className={cn("space-y-8", isReadOnly && "pointer-events-none opacity-80")}>
            {categories.map((category) => (
              <div key={category.id} className="space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
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
                            ? "bg-blue-50 border-blue-200 text-blue-900" 
                            : "bg-white border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-slate-50"
                        )}
                      >
                        <div className={cn(
                          "mt-0.5 shrink-0 transition-colors",
                          item.checked ? "text-blue-600" : "text-slate-300 group-hover:text-blue-400"
                        )}>
                          {item.checked ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                        </div>
                        <span className="text-[14px] leading-relaxed font-medium">{item.label}</span>
                      </button>
                      
                      {item.id === 'e_machine_ready' && item.checked && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="bg-slate-50 rounded-2xl p-4 border border-slate-200 ml-10 space-y-3"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-2">
                              <label className="text-xs font-bold text-slate-500">Steam Boiler</label>
                              <div className="flex items-center gap-2">
                                <input type="number" placeholder="0.0" value={machineStatus.steamBoiler} onChange={e => setMachineStatus(p => ({...p, steamBoiler: e.target.value}))} className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                                <span className="text-xs font-bold text-slate-400">bar</span>
                              </div>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-2">
                              <label className="text-xs font-bold text-slate-500">Pump Pressure</label>
                              <div className="flex items-center gap-2">
                                <input type="number" placeholder="0.0" value={machineStatus.pumpPressure} onChange={e => setMachineStatus(p => ({...p, pumpPressure: e.target.value}))} className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                                <span className="text-xs font-bold text-slate-400">bar</span>
                              </div>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-2">
                              <label className="text-xs font-bold text-slate-500">อุณหภูมิ (Temp)</label>
                              <div className="flex items-center gap-2">
                                <input type="number" placeholder="0.0" value={machineStatus.temp} onChange={e => setMachineStatus(p => ({...p, temp: e.target.value}))} className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                                <span className="text-xs font-bold text-slate-400">°C</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {item.id === 'e_water_quality' && item.checked && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="bg-slate-50 rounded-2xl p-4 border border-slate-200 ml-10 flex items-center justify-between"
                        >
                          <span className="text-sm font-bold text-slate-700">ค่าน้ำ</span>
                          <div className="flex items-center gap-2">
                            <input type="number" placeholder="80" value={waterQuality} onChange={e => setWaterQuality(e.target.value)} className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-right text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                            <span className="text-xs font-bold text-slate-400">ppm</span>
                          </div>
                        </motion.div>
                      )}

                      {item.id === 'e_fridge_temp' && item.checked && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="bg-slate-50 rounded-2xl p-4 border border-slate-200 ml-10 space-y-4"
                        >
                          {/* Chiller */}
                          <div className="flex flex-col gap-2">
                            <span className="text-sm font-bold text-slate-700">อุณหภูมิตู้แช่เย็น</span>
                            <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="chillerStatus" value="ปกติ" checked={fridgeStatus.chillerStatus === 'ปกติ'} onChange={e => setFridgeStatus(p => ({...p, chillerStatus: e.target.value}))} className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300" />
                                <span className="text-sm font-medium text-slate-600">ปกติ</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="chillerStatus" value="ไม่ปกติ" checked={fridgeStatus.chillerStatus === 'ไม่ปกติ'} onChange={e => setFridgeStatus(p => ({...p, chillerStatus: e.target.value}))} className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-slate-300" />
                                <span className="text-sm font-medium text-slate-600">ไม่ปกติ</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="chillerStatus" value="ไม่มีตู้" checked={fridgeStatus.chillerStatus === 'ไม่มีตู้'} onChange={e => setFridgeStatus(p => ({...p, chillerStatus: e.target.value}))} className="w-4 h-4 text-slate-600 focus:ring-slate-500 border-slate-300" />
                                <span className="text-sm font-medium text-slate-600">ไม่มีตู้</span>
                              </label>
                              
                              <div className="flex items-center gap-2 ml-auto">
                                <input type="number" placeholder="2-6" value={fridgeStatus.chillerTemp} onChange={e => setFridgeStatus(p => ({...p, chillerTemp: e.target.value}))} disabled={fridgeStatus.chillerStatus === 'ไม่มีตู้'} className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-right text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50" />
                                <span className="text-xs font-bold text-slate-400">°C</span>
                              </div>
                            </div>
                          </div>

                          {/* Freezer */}
                          <div className="flex flex-col gap-2">
                            <span className="text-sm font-bold text-slate-700">อุณหภูมิตู้แช่แข็ง</span>
                            <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="freezerStatus" value="ปกติ" checked={fridgeStatus.freezerStatus === 'ปกติ'} onChange={e => setFridgeStatus(p => ({...p, freezerStatus: e.target.value}))} className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300" />
                                <span className="text-sm font-medium text-slate-600">ปกติ</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="freezerStatus" value="ไม่ปกติ" checked={fridgeStatus.freezerStatus === 'ไม่ปกติ'} onChange={e => setFridgeStatus(p => ({...p, freezerStatus: e.target.value}))} className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-slate-300" />
                                <span className="text-sm font-medium text-slate-600">ไม่ปกติ</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="freezerStatus" value="ไม่มีตู้" checked={fridgeStatus.freezerStatus === 'ไม่มีตู้'} onChange={e => setFridgeStatus(p => ({...p, freezerStatus: e.target.value}))} className="w-4 h-4 text-slate-600 focus:ring-slate-500 border-slate-300" />
                                <span className="text-sm font-medium text-slate-600">ไม่มีตู้</span>
                              </label>
                              
                              <div className="flex items-center gap-2 ml-auto">
                                <input type="number" placeholder="-18" value={fridgeStatus.freezerTemp} onChange={e => setFridgeStatus(p => ({...p, freezerTemp: e.target.value}))} disabled={fridgeStatus.freezerStatus === 'ไม่มีตู้'} className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-right text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50" />
                                <span className="text-xs font-bold text-slate-400">°C</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {item.id === 'e_coffee_weigh' && item.checked && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="bg-slate-50 rounded-2xl p-4 border border-slate-200 ml-10 space-y-3"
                        >
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            กรอกน้ำหนักเมล็ดกาแฟ ({type === 'Check-in' ? 'ก่อนเปิดร้าน' : 'หลังปิดร้าน'})
                          </div>
                          <div className="grid gap-3">
                            {coffeeIngredients.map(ing => (
                              <div key={ing.id} className="flex items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-3">
                                  <img src={ing.image} alt={ing.name} className="w-8 h-8 rounded-lg object-cover" referrerPolicy="no-referrer" />
                                  <span className="text-sm font-bold text-slate-700">{ing.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    placeholder="0.00"
                                    value={coffeeWeights[ing.id] || ''}
                                    onChange={(e) => setCoffeeWeights(prev => ({ ...prev, [ing.id]: e.target.value }))}
                                    className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-right text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                  />
                                  <span className="text-xs font-bold text-slate-400">กรัม</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {item.id === 'e2' && item.checked && type === 'Check-in' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="bg-slate-50 rounded-2xl p-4 border border-slate-200 ml-10 space-y-3"
                        >
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            บันทึกการตั้งค่ารสชาติ (Dial-in)
                          </div>
                          <div className="grid gap-3">
                            {coffeeIngredients.map(ing => (
                              <div key={ing.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
                                <div className="flex items-center gap-3 pb-2 border-b border-slate-50">
                                  <img src={ing.image} alt={ing.name} className="w-8 h-8 rounded-lg object-cover" referrerPolicy="no-referrer" />
                                  <span className="text-sm font-bold text-slate-700">{ing.name}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Dose (g)</label>
                                    <input
                                      type="number"
                                      placeholder="0.0"
                                      value={coffeeDialIn[ing.id]?.dose || ''}
                                      onChange={(e) => setCoffeeDialIn(prev => ({ 
                                        ...prev, 
                                        [ing.id]: { ...(prev[ing.id] || { dose: '', yield: '', time: '' }), dose: e.target.value } 
                                      }))}
                                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Yield (ml)</label>
                                    <input
                                      type="number"
                                      placeholder="0"
                                      value={coffeeDialIn[ing.id]?.yield || ''}
                                      onChange={(e) => setCoffeeDialIn(prev => ({ 
                                        ...prev, 
                                        [ing.id]: { ...(prev[ing.id] || { dose: '', yield: '', time: '' }), yield: e.target.value } 
                                      }))}
                                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Time (s)</label>
                                    <input
                                      type="number"
                                      placeholder="0"
                                      value={coffeeDialIn[ing.id]?.time || ''}
                                      onChange={(e) => setCoffeeDialIn(prev => ({ 
                                        ...prev, 
                                        [ing.id]: { ...(prev[ing.id] || { dose: '', yield: '', time: '' }), time: e.target.value } 
                                      }))}
                                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {item.id === 'p1' && item.checked && type === 'Check-in' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="bg-slate-50 rounded-2xl p-4 border border-slate-200 ml-10 space-y-3"
                        >
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            ระบุจำนวนเงินทอนในลิ้นชัก
                          </div>
                          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                                <CreditCard size={18} />
                              </div>
                              <span className="text-sm font-bold text-slate-700">จำนวนเงินสดเริ่มต้น</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                placeholder="0.00"
                                value={cashInDrawer}
                                onChange={(e) => setCashInDrawer(e.target.value)}
                                className="w-32 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-right text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                              <span className="text-xs font-bold text-slate-400">บาท</span>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {item.id === 'i4' && item.checked && type === 'Check-in' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="bg-slate-50 rounded-2xl p-4 border border-slate-200 ml-10 space-y-3"
                        >
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            ระบุจำนวนแก้วที่มีอยู่ (ก่อนเปิดร้าน) - 1 แถว = 50 ใบ
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-2">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">แก้ว 16 Oz.</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  placeholder="0"
                                  value={cupCounts['16oz'].sleeves}
                                  onChange={(e) => setCupCounts(prev => ({ ...prev, '16oz': { ...prev['16oz'], sleeves: e.target.value } }))}
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <span className="text-xs font-bold text-slate-400">แถว</span>
                                <input
                                  type="number"
                                  placeholder="0"
                                  value={cupCounts['16oz'].loose}
                                  onChange={(e) => setCupCounts(prev => ({ ...prev, '16oz': { ...prev['16oz'], loose: e.target.value } }))}
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <span className="text-xs font-bold text-slate-400">ใบ</span>
                              </div>
                              <div className="mt-1 pt-2 border-t border-slate-100 flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400">รวมทั้งหมด</span>
                                <span className="text-sm font-black text-blue-600">
                                  {((parseInt(cupCounts['16oz'].sleeves) || 0) * 50) + (parseInt(cupCounts['16oz'].loose) || 0)} ใบ
                                </span>
                              </div>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-2">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">แก้ว 12 Oz.</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  placeholder="0"
                                  value={cupCounts['12oz'].sleeves}
                                  onChange={(e) => setCupCounts(prev => ({ ...prev, '12oz': { ...prev['12oz'], sleeves: e.target.value } }))}
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <span className="text-xs font-bold text-slate-400">แถว</span>
                                <input
                                  type="number"
                                  placeholder="0"
                                  value={cupCounts['12oz'].loose}
                                  onChange={(e) => setCupCounts(prev => ({ ...prev, '12oz': { ...prev['12oz'], loose: e.target.value } }))}
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <span className="text-xs font-bold text-slate-400">ใบ</span>
                              </div>
                              <div className="mt-1 pt-2 border-t border-slate-100 flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400">รวมทั้งหมด</span>
                                <span className="text-sm font-black text-blue-600">
                                  {((parseInt(cupCounts['12oz'].sleeves) || 0) * 50) + (parseInt(cupCounts['12oz'].loose) || 0)} ใบ
                                </span>
                              </div>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-2">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">แก้ว 8 Oz.</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  placeholder="0"
                                  value={cupCounts['8oz'].sleeves}
                                  onChange={(e) => setCupCounts(prev => ({ ...prev, '8oz': { ...prev['8oz'], sleeves: e.target.value } }))}
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <span className="text-xs font-bold text-slate-400">แถว</span>
                                <input
                                  type="number"
                                  placeholder="0"
                                  value={cupCounts['8oz'].loose}
                                  onChange={(e) => setCupCounts(prev => ({ ...prev, '8oz': { ...prev['8oz'], loose: e.target.value } }))}
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <span className="text-xs font-bold text-slate-400">ใบ</span>
                              </div>
                              <div className="mt-1 pt-2 border-t border-slate-100 flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400">รวมทั้งหมด</span>
                                <span className="text-sm font-black text-blue-600">
                                  {((parseInt(cupCounts['8oz'].sleeves) || 0) * 50) + (parseInt(cupCounts['8oz'].loose) || 0)} ใบ
                                </span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {item.id === 'io5' && item.checked && type === 'Check-out' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="bg-slate-50 rounded-2xl p-4 border border-slate-200 ml-10 space-y-3"
                        >
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            สรุปการใช้งานแก้วประจำวัน (1 แถว = 50 ใบ)
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {(['16oz', '12oz', '8oz'] as const).map((size) => {
                              const broughtForward = getBroughtForward(size);
                              const added = parseInt(cupUsage[size].added) || 0;
                              const remainingSleeves = parseInt(cupUsage[size].remainingSleeves) || 0;
                              const remainingLoose = parseInt(cupUsage[size].remainingLoose) || 0;
                              const remainingTotal = (remainingSleeves * 50) + remainingLoose;
                              const actualUsage = broughtForward + added - remainingTotal;

                              return (
                                <div key={size} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-3">
                                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                    <label className="text-xs font-bold text-slate-700 uppercase">แก้ว {size.replace('oz', ' Oz.')}</label>
                                    <div className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                                      ยอดยกมา: {broughtForward} ใบ
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[10px] font-bold text-slate-400">เบิกเพิ่ม (ใบ)</span>
                                      <input
                                        type="number"
                                        placeholder="0"
                                        value={cupUsage[size].added}
                                        onChange={(e) => setCupUsage(prev => ({ ...prev, [size]: { ...prev[size], added: e.target.value } }))}
                                        className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-center text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                      />
                                    </div>
                                    
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[10px] font-bold text-slate-400">คงเหลือตอนปิดร้าน</span>
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="number"
                                          placeholder="0"
                                          value={cupUsage[size].remainingSleeves}
                                          onChange={(e) => setCupUsage(prev => ({ ...prev, [size]: { ...prev[size], remainingSleeves: e.target.value } }))}
                                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-center text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                        <span className="text-[10px] font-bold text-slate-400">แถว</span>
                                        <input
                                          type="number"
                                          placeholder="0"
                                          value={cupUsage[size].remainingLoose}
                                          onChange={(e) => setCupUsage(prev => ({ ...prev, [size]: { ...prev[size], remainingLoose: e.target.value } }))}
                                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-center text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                        <span className="text-[10px] font-bold text-slate-400">ใบ</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-1 pt-2 border-t border-slate-100 flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-500">ยอดใช้งานจริง</span>
                                    <span className={cn("text-sm font-black", actualUsage < 0 ? "text-red-500" : "text-emerald-600")}>
                                      {actualUsage} ใบ
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}

                      {item.id === 'so_sales' && item.checked && type === 'Check-out' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="bg-slate-50 rounded-2xl p-6 border border-slate-200 ml-10 space-y-4"
                        >
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex justify-between items-center">
                            <span>สรุปยอดขายประจำวัน</span>
                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-[10px]">เงินทอนยกมา: {checkInCash.toLocaleString()} บาท</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">ยอดขายทั้งหมด</label>
                              <input
                                type="number"
                                placeholder="0.00"
                                value={salesSummary.total}
                                onChange={(e) => setSalesSummary(prev => ({ ...prev, total: e.target.value }))}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-right text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">เงินสดภายในลิ้นชักทั้งหมด</label>
                              <input
                                type="number"
                                placeholder="0.00"
                                value={salesSummary.totalCashInDrawer}
                                onChange={(e) => setSalesSummary(prev => ({ ...prev, totalCashInDrawer: e.target.value }))}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-right text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">เงินสด (Cash)</label>
                              <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-right text-sm font-bold text-slate-600 shadow-sm">
                                {salesSummary.cash || '0'}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">เงินโอน (Transfer)</label>
                              <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-right text-sm font-bold text-slate-600 shadow-sm">
                                {salesSummary.transfer || '0'}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">หมายเหตุ (กรณีเงินสดไม่ครบถ้วน)</label>
                            <textarea
                              placeholder="ระบุสาเหตุ..."
                              value={salesSummary.notes}
                              onChange={(e) => setSalesSummary(prev => ({ ...prev, notes: e.target.value }))}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm min-h-[80px]"
                            />
                          </div>
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 pt-6 border-t border-slate-100 flex justify-end print:hidden">
            {!isReadOnly && (
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-2xl text-lg font-bold hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/20 transform hover:scale-105 active:scale-95"
              >
                <Send size={20} />
                บันทึกรายการตรวจสอบ
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
          >
            <div className="p-6 text-center">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={40} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">ยืนยันการบันทึกรายการ?</h3>
              <p className="text-slate-500 mb-6">
                {isAllChecked 
                  ? 'คุณได้ตรวจสอบครบทุกรายการแล้ว ต้องการบันทึกข้อมูลใช่หรือไม่?' 
                  : `คุณยังตรวจสอบไม่ครบ (ตรวจสอบแล้ว ${checkedItems}/${totalItems} รายการ) ต้องการบันทึกข้อมูลใช่หรือไม่?`}
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={confirmSubmit}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
                >
                  ยืนยันบันทึก
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}