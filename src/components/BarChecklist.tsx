import React, { useState, useMemo } from 'react';
import { CheckCircle2, Circle, Clock, MapPin, Coffee, Sparkles, AlertCircle, Calendar, User, Printer, LogOut, ChevronDown, FileDown, Check, ShieldCheck, Thermometer, Gauge, Droplets, Download } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { Ingredient } from '../types';
import * as XLSX from 'xlsx';

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
      icon: <Sparkles size={18} />,
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
      icon: <Coffee size={18} />,
      items: [
        { id: 'e1', label: 'เครื่องชงและเครื่องบดกาแฟ: เปิดเครื่องล่วงหน้าเพื่อให้เครื่องร้อนพร้อมใช้งาน ตรวจสอบความสะอาดของด้ามชง (Portafilter) และหัวกรุ๊ป', checked: false },
        { id: 'e_machine_ready', label: 'ทำการตรวจความพร้อมเครื่องชง โดยกรอกข้อมูล ค่าแรงดัน Steam Boiler, Pump และอุณหภูมิ', checked: false },
        { id: 'e_water_quality', label: 'ทำการตรวจวัดค่าน้ำ และกรอกข้อมูล (ppm)', checked: false },
        { id: 'e_coffee_weigh', label: 'ชั่งน้ำหนักเมล็ดกาแฟทุกชนิดที่มีในสต็อก (กรอกน้ำหนักก่อนใช้งาน)', checked: false },
        { id: 'e2', label: 'การตั้งค่ารสชาติ (Dial-in Coffee): ชิมรสชาติเอสเพรสโซ่ช็อตแรกของวันเพื่อปรับค่าบดเมล็ดกาแฟให้ได้มาตรฐาน', checked: false },
        { id: 'e3', label: 'อุปกรณ์เบ็ดเตล็ด: เช็คความพร้อมของเครื่องตีฟองนม เครื่องปั่น เครื่องชั่งน้ำหนัก และช้อนตวงต่างๆ', checked: false },
        { id: 'e_fridge_temp', label: 'ตรวจเช็คอุณหภูมิตู้แช่เย็น / ตู้แช่แข็ง และบันทึกสถานะ', checked: false },
      ]
    },
    {
      id: 'pos',
      title: '3. ระบบแคชเชียร์และการเงิน (POS & Cash Handling)',
      icon: <CheckCircle2 size={18} />,
      items: [
        { id: 'p1', label: 'ระบบ POS และเครื่องพิมพ์ใบเสร็จ: เปิดเครื่อง เช็คสัญญาณอินเทอร์เน็ต และตรวจสอบกระดาษพิมพ์ใบเสร็จ', checked: false },
        { id: 'p2', label: 'เงินทอน (Cash Float): นับเงินทอนในลิ้นชักให้ถูกต้องตรงตามยอดที่กำหนดก่อนเปิดรับออเดอร์', checked: false },
        { id: 'p3', label: 'ป้าย QR Code / เครื่องรูดบัตร: วางในตำแหน่งที่ลูกค้าเห็นชัดเจนและพร้อมรับชำระแบบไร้เงินสด', checked: false },
      ]
    },
    {
      id: 'ingredients',
      title: '4. วัตถุดิบและบรรจุภัณฑ์ (Stock & Mis En Place)',
      icon: <Sparkles size={18} />,
      items: [
        { id: 'i1', label: 'เมล็ดกาแฟ: เติมเมล็ดกาแฟใส่โถบด (Hopper) ให้เพียงพอสำหรับการขายช่วงเช้า', checked: false },
        { id: 'i2', label: 'นมและของสด: เช็คสต็อกนมสด นมทางเลือก ไซรัป ซอส และวัตถุดิบที่ต้องแช่เย็นว่าอยู่ในอุณหภูมิที่เหมาะสมและไม่หมดอายุ', checked: false },
        { id: 'i3', label: 'น้ำแข็ง: ตรวจสอบความสะอาดของถังน้ำแข็งและปริมาณน้ำแข็งให้พร้อมใช้งาน', checked: false },
        { id: 'i4', label: 'บรรจุภัณฑ์: เติมแก้ว ฝา หลอด ทิชชู่ ถุงใส่แก้ว และปลอกสวมแก้วให้เต็มทุกจุดบริการ', checked: false },
      ]
    },
    {
      id: 'staff',
      title: '5. ความพร้อมของพนักงาน (Staff & Team Alignment)',
      icon: <User size={18} />,
      items: [
        { id: 's1', label: 'การแต่งกายและสุขอนามัย: สวมเครื่องแบบสะอาด ผูกผ้ากันเปื้อน สวมหมวก/เน็ตคลุมผม และล้างมือก่อนเริ่มงาน', checked: false },
        { id: 's2', label: 'การสื่อสารในทีม (Morning Brief): พูดคุยเป้าหมายประจำวัน เมนูแนะนำพิเศษ หรือปัญหาที่ต้องระวัง', checked: false },
      ]
    }
  ];

  const initialCheckOut: ChecklistCategory[] = [
    {
      id: 'equipment_out',
      title: '1. การทำความสะอาดอุปกรณ์และเครื่องชง (Equipment Care & Cleaning)',
      icon: <Coffee size={18} />,
      items: [
        { id: 'eo1', label: 'ล้างหัวกรุ๊ปและ Backflush: ทำความสะอาดหัวกรุ๊ปด้วยผงล้างเครื่องชงกาแฟ (Espresso Machine Cleaner) และขัดล้าง Shower Screen', checked: false },
        { id: 'eo2', label: 'ทำความสะอาดก้านสตรีมนม (Steam Wand): แช่และเช็ดคราบน้ำนมออกให้หมด ทำการ purge ไอน้ำทิ้ง', checked: false },
        { id: 'eo3', label: 'เครื่องบดกาแฟ: ปิดสไลด์โถบด นำเมล็ดกาแฟที่เหลือใส่ภาชนะสุญญากาศ ปัดผงกาแฟที่ค้างอยู่ออก และทำความสะอาดถาดรอง', checked: false },
        { id: 'e_coffee_weigh', label: 'ชั่งน้ำหนักเมล็ดกาแฟคงเหลือตอนปิดร้านทุกชนิด (กรอกน้ำหนักหลังปิดร้าน)', checked: false },
        { id: 'eo4', label: 'อุปกรณ์บาร์: ล้างทำความสะอาดด้ามชง (Portafilter), พิชเชอร์ (Pitcher), เครื่องปั่น, ถังเคาะกากกาแฟ (Knock Box) และคว่ำให้แห้ง', checked: false },
        { id: 'eo5', label: 'ปิดสวิตช์เครื่องใช้ไฟฟ้า: ปิดเครื่องชง เครื่องบด เครื่องปั่น และถอดปลั๊กอุปกรณ์ที่ไม่จำเป็น', checked: false },
      ]
    },
    {
      id: 'inventory_out',
      title: '2. การจัดเก็บวัตถุดิบและเคลียร์สต็อก (Inventory & Food Safety)',
      icon: <Sparkles size={18} />,
      items: [
        { id: 'io1', label: 'จัดเก็บของสดและนม: เช็ควันหมดอายุ ปิดฝาให้สนิท และแช่ในตู้เย็นตามอุณหภูมิที่กำหนด (First In, First Out: FIFO)', checked: false },
        { id: 'io2', label: 'เคลียร์ของเสีย (Wastage Log): ตรวจสอบและบันทึกรายการวัตถุดิบหรือขนมที่เสียหาย/หมดอายุลงในระบบ', checked: false },
        { id: 'io3', label: 'เช็คสต็อกวัตถุดิบ: ตรวจดูรายการที่ใกล้หมดและบันทึกรายการที่ต้องสั่งซื้อสำหรับวันถัดไป', checked: false },
        { id: 'io4', label: 'ตู้เย็นและตู้แช่: เช็คว่าประตูปิดสนิท อุณหภูมิปกติ และเช็ดคราบสกปรกภายในตู้', checked: false },
        { id: 'io5', label: 'ตรวจนับแก้วที่ใช้และคงเหลือตอนปิดร้าน', checked: false },
      ]
    },
    {
      id: 'cleaning_out',
      title: '3. ความสะอาดและสุขอนามัยภายในร้าน (Sanitization & Waste)',
      icon: <Sparkles size={18} />,
      items: [
        { id: 'co1', label: 'เคาน์เตอร์บาร์และซิงค์ล้าง: เช็ดทำความสะอาดเคาน์เตอร์ทั้งหมดด้วยน้ำยาฆ่าเชื้อ ล้างซิงค์และเทเศษขยะในตะแกรงดักกลิ่น', checked: false },
        { id: 'co2', label: 'ผ้าเช็ดทำความสะอาด: นำผ้าบาร์ ผ้าเช็ดโต๊ะ และผ้าสตรีมนมที่ใช้แล้วไปซัก ตาก หรือส่งซักให้เรียบร้อย (ไม่ทิ้งผ้าเปียกค้างคืน)', checked: false },
        { id: 'co3', label: 'เคลียร์ขยะ: มัดปากถุงขยะทุกถังในร้าน และนำไปทิ้งที่จุดทิ้งขยะภายนอกร้าน ล้างทำความสะอาดถังขยะ', checked: false },
        { id: 'co4', label: 'พื้นร้านและโต๊ะที่นั่ง: กวาดและถูพื้นทั้งบริเวณเคาน์เตอร์และโซนลูกค้า เช็ดทำความสะอาดโต๊ะ เก้าอี้ และจัดให้เข้าที่', checked: false },
        { id: 'co5', label: 'ห้องน้ำ: ทำความสะอาดชักโครก อ่างล้างหน้า พื้น เติมสบู่/กระดาษ และทิ้งขยะ', checked: false },
      ]
    },
    {
      id: 'sales_out',
      title: '4. สรุปยอดขายและการเงิน (Closing Register & POS)',
      icon: <CheckCircle2 size={18} />,
      items: [
        { id: 'so_sales', label: 'สรุปยอดขายประจำวัน: ตรวจสอบยอดขายรวม เงินสด และเงินโอน', checked: false },
        { id: 'so1', label: 'ปิดรอบการขาย (Z-Report): ดึงรายงานสรุปยอดขายประจำวันจากระบบ POS', checked: false },
        { id: 'so2', label: 'นับเงินสด: นับเงินสดในลิ้นชัก แยกเงินยอดขายออกจากเงินทอน และตรวจเช็คว่ายอดตรงกับระบบหรือไม่', checked: false },
        { id: 'so3', label: 'เก็บเงินสดในที่ปลอดภัย: นำเงินยอดขายใส่ซองและนำไปเก็บในตู้เซฟหรือตามมาตรการความปลอดภัยของร้าน', checked: false },
      ]
    },
    {
      id: 'security_out',
      title: '5. ความปลอดภัยและการปิดร้าน (Store Security & Lock-up)',
      icon: <ShieldCheck size={18} />,
      items: [
        { id: 'sec1', label: 'ปิดระบบน้ำ: ปิดวาล์วน้ำหลักของเครื่องชงกาแฟและจุดจ่ายน้ำ เพื่อป้องกันน้ำรั่วซึมเวลากลางคืน', checked: false },
        { id: 'sec2', label: 'ปิดระบบปรับอากาศและไฟ: ปิดแอร์ พัดลมระบายอากาศ ป้ายไฟหน้าร้าน และไฟทุกดวง (ยกเว้นไฟรักษาความปลอดภัยที่จำเป็น)', checked: false },
        { id: 'sec3', label: 'ตรวจสอบความปลอดภัย: เช็คหน้าต่าง ประตูด้านหลัง และระบบเตือนภัย/กล้องวงจรปิดให้ทำงานปกติ', checked: false },
        { id: 'sec4', label: 'ล็อคประตูร้าน: ตรวจสอบการล็อคประตูด้านหน้าและดึงประตูม้วน/มู่ลี่ลงให้เรียบร้อยก่อนเดินทางกลับ', checked: false },
      ]
    }
  ];

  const [categories, setCategories] = useState<ChecklistCategory[]>(initialCheckIn);

  // Sync categories when type changes
  React.useEffect(() => {
    setCategories(type === 'Check-in' ? initialCheckIn : initialCheckOut);
  }, [type]);

  const toggleItem = (categoryId: string, itemId: string) => {
    if (isReadOnly) return;
    setCategories(prev => prev.map(cat => {
      if (cat.id !== categoryId) return cat;
      return {
        ...cat,
        items: cat.items.map(item => {
          if (item.id !== itemId) return item;
          return { ...item, checked: !item.checked };
        })
      };
    }));
  };

  const totalItems = useMemo(() => {
    return categories.reduce((acc, cat) => acc + cat.items.length, 0);
  }, [categories]);

  const checkedItems = useMemo(() => {
    return categories.reduce((acc, cat) => acc + cat.items.filter(i => i.checked).length, 0);
  }, [categories]);

  const progress = Math.round((checkedItems / (totalItems || 1)) * 100);
  const isAllChecked = checkedItems === totalItems && totalItems > 0;

  // Retrieve today's Check-in cash if available
  const checkInCash = useMemo(() => {
    const todayCheckIn = checklistRecords.find(
      (r: any) => r.type === 'Check-in' && r.reportDate === reportDate && r.cashInDrawer
    );
    return todayCheckIn ? parseFloat(todayCheckIn.cashInDrawer) || 0 : 0;
  }, [checklistRecords, reportDate]);

  // Retrieve today's Check-in cups if available
  const getBroughtForward = (size: '16oz' | '12oz' | '8oz') => {
    const todayCheckIn = checklistRecords.find(
      (r: any) => r.type === 'Check-in' && r.reportDate === reportDate && r.cupCounts
    );
    if (!todayCheckIn || !todayCheckIn.cupCounts || !todayCheckIn.cupCounts[size]) return 0;
    const sleeves = parseInt(todayCheckIn.cupCounts[size].sleeves) || 0;
    const loose = parseInt(todayCheckIn.cupCounts[size].loose) || 0;
    return (sleeves * 50) + loose;
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData: (string | number)[][] = [
      ['รายงาน Bar Checklist', `${type} (${reportDate})`],
      ['ผู้ทำรายงาน', reporterName],
      ['สาขา', branch],
      ['ความคืบหน้า', `${checkedItems} / ${totalItems} (${progress}%)`],
      []
    ];

    if (type === 'Check-in' && (machineStatus.steamBoiler || machineStatus.pumpPressure || machineStatus.temp)) {
      summaryData.push(['การตรวจเช็คเครื่องชง', '']);
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
      branch,
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
        backgroundColor: '#F0F5F4',
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
      console.warn('Error generating PDF:', error);
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF โปรดลองอีกครั้ง');
    }
  };

  // Water quality status indicator helper
  const waterPpm = parseFloat(waterQuality) || 0;
  const getWaterStatus = (ppm: number) => {
    if (!waterQuality) return null;
    if (ppm < 50) return { text: 'น้ำนุ่มเกินไป (Too Soft < 50 ppm)', color: 'text-[#EF4444] bg-[#FEE2E2] border-[#FCA5A5]' };
    if (ppm <= 150) return { text: 'ค่ามาตรฐานเหมาะสม (Optimal 50-150 ppm)', color: 'text-[#22C55E] bg-[#DCFCE7] border-[#86EFAC]' };
    return { text: 'น้ำกระด้างเกินไป (Hard > 150 ppm)', color: 'text-[#F59E0B] bg-[#FEF3C7] border-[#FDE68A]' };
  };
  const waterStatus = getWaterStatus(waterPpm);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300" id="checklist-report">
      {/* Header Card */}
      <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(90,138,136,0.08)] border border-[#D4E4E3] overflow-hidden">
        <div className="bg-white p-5 sm:p-6 border-b border-[#D4E4E3]">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-[#E8F3F2] rounded-xl shrink-0 flex items-center justify-center text-[#5A8A88]">
                <Clock size={22} className="text-[#5A8A88]" />
              </div>
              <div>
                <h2 className="text-[16px] sm:text-[17px] font-bold text-[#2D4A49]">Bar Check-in & Check-out</h2>
                <p className="text-[#6B8F8E] text-[11px] max-w-[500px] leading-[1.5] mt-0.5">
                  {type === 'Check-in' 
                    ? 'การเตรียมตัวก่อนเปิดร้านคาเฟ่ในช่วงเช้าเป็นขั้นตอนที่สำคัญมาก เพื่อให้การทำงานตลอดทั้งวันราบรื่นและลดข้อผิดพลาดหน้างาน'
                    : 'การทำ Checklist ช่วงปิดร้านที่ดีจะช่วยให้คนเปิดร้านตอนเช้าทำงานง่ายขึ้น และช่วยรักษามาตรฐานความสะอาดรวมถึงอายุการใช้งานของอุปกรณ์'}
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
                    <span>Excel (.csv)</span>
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
              <span>เช็คลิสต์เปิดบาร์ (Check-in)</span>
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
              <span>เช็คลิสต์ปิดบาร์ (Check-out)</span>
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
                    <span className="px-2 py-0.5 bg-[#E8F3F2] text-[#5A8A88] rounded-full text-[10px] sm:text-[11px] font-semibold shrink-0">
                      {catChecked}/{catTotal} สำเร็จ
                    </span>
                  </div>

                  {/* Checklist Items */}
                  <div className="p-2.5 sm:p-3 space-y-1.5">
                    {category.items.map((item) => (
                      <div key={item.id} className="space-y-2">
                        <button
                          type="button"
                          onClick={() => toggleItem(category.id, item.id)}
                          className={cn(
                            "w-full flex items-start gap-2.5 p-2 sm:px-3 sm:py-2 rounded-lg border transition-all text-left group cursor-pointer",
                            item.checked 
                              ? "bg-[#E8F3F2] border-[#B8D4D2]" 
                              : "bg-[#F8FAF9] border-[#E2EAE9] hover:bg-white hover:border-[#D4E4E3]"
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
                            "text-[10px] leading-relaxed select-none",
                            item.checked ? "line-through text-[#6B8F8E]" : "text-[#2D4A49] font-medium"
                          )}>
                            {item.label}
                          </span>
                        </button>
                        
                        {/* Machine Status Sub-section */}
                        {item.id === 'e_machine_ready' && item.checked && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-[#F8FAF9] rounded-xl p-4 border border-[#D4E4E3] ml-8 space-y-3"
                          >
                            <div className="flex items-center gap-2 text-[12px] font-bold text-[#2D4A49] border-b border-[#E2EAE9] pb-2">
                              <Gauge size={16} className="text-[#5A8A88]" />
                              <span>บันทึกความพร้อมเครื่องชงกาแฟ</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="bg-white p-3 rounded-lg border border-[#D4E4E3] shadow-xs flex flex-col gap-1.5">
                                <label className="text-[11px] font-semibold text-[#6B8F8E]">Steam Boiler</label>
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="number" 
                                    step="0.1" 
                                    placeholder="1.2" 
                                    value={machineStatus.steamBoiler} 
                                    onChange={e => setMachineStatus(p => ({...p, steamBoiler: e.target.value}))} 
                                    className="w-full px-2.5 py-1.5 bg-[#F8FAF9] border border-[#D4E4E3] rounded-md text-[13px] font-bold text-[#2D4A49] focus:bg-white focus:border-[#5A8A88] outline-none" 
                                  />
                                  <span className="text-[11px] font-bold text-[#6B8F8E]">bar</span>
                                </div>
                              </div>
                              <div className="bg-white p-3 rounded-lg border border-[#D4E4E3] shadow-xs flex flex-col gap-1.5">
                                <label className="text-[11px] font-semibold text-[#6B8F8E]">Pump Pressure</label>
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="number" 
                                    step="0.1" 
                                    placeholder="9.0" 
                                    value={machineStatus.pumpPressure} 
                                    onChange={e => setMachineStatus(p => ({...p, pumpPressure: e.target.value}))} 
                                    className="w-full px-2.5 py-1.5 bg-[#F8FAF9] border border-[#D4E4E3] rounded-md text-[13px] font-bold text-[#2D4A49] focus:bg-white focus:border-[#5A8A88] outline-none" 
                                  />
                                  <span className="text-[11px] font-bold text-[#6B8F8E]">bar</span>
                                </div>
                              </div>
                              <div className="bg-white p-3 rounded-lg border border-[#D4E4E3] shadow-xs flex flex-col gap-1.5">
                                <label className="text-[11px] font-semibold text-[#6B8F8E]">อุณหภูมิ (Temp)</label>
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="number" 
                                    step="0.1" 
                                    placeholder="93.5" 
                                    value={machineStatus.temp} 
                                    onChange={e => setMachineStatus(p => ({...p, temp: e.target.value}))} 
                                    className="w-full px-2.5 py-1.5 bg-[#F8FAF9] border border-[#D4E4E3] rounded-md text-[13px] font-bold text-[#2D4A49] focus:bg-white focus:border-[#5A8A88] outline-none" 
                                  />
                                  <span className="text-[11px] font-bold text-[#6B8F8E]">°C</span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* Water Quality Sub-section */}
                        {item.id === 'e_water_quality' && item.checked && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-[#F8FAF9] rounded-xl p-4 border border-[#D4E4E3] ml-8 space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <Droplets size={16} className="text-[#5A8A88]" />
                                <span className="text-[13px] font-bold text-[#2D4A49]">ตรวจวัดค่าน้ำชงกาแฟ (TDS)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="number" 
                                  placeholder="80" 
                                  value={waterQuality} 
                                  onChange={e => setWaterQuality(e.target.value)} 
                                  className="w-28 px-3 py-1.5 bg-white border border-[#D4E4E3] rounded-lg text-right text-[13px] font-bold text-[#2D4A49] focus:border-[#5A8A88] outline-none" 
                                />
                                <span className="text-[12px] font-bold text-[#6B8F8E]">ppm</span>
                              </div>
                            </div>
                            
                            {/* Water Range Status Indicator */}
                            {waterStatus ? (
                              <div className={cn("px-3 py-1.5 rounded-lg border text-[11px] font-bold flex items-center justify-between", waterStatus.color)}>
                                <span>{waterStatus.text}</span>
                                <span>เกณฑ์มาตรฐาน: 50 - 150 ppm</span>
                              </div>
                            ) : (
                              <div className="text-[11px] text-[#6B8F8E] flex gap-3 flex-wrap">
                                <span>เกณฑ์: &lt;50 (นุ่ม)</span>
                                <span className="text-[#22C55E] font-semibold">50-150 (แนะนำ)</span>
                                <span>&gt;150 (กระด้าง)</span>
                              </div>
                            )}
                          </motion.div>
                        )}

                        {/* Fridge Status Sub-section */}
                        {item.id === 'e_fridge_temp' && item.checked && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-[#F8FAF9] rounded-xl p-4 border border-[#D4E4E3] ml-8 space-y-4"
                          >
                            <div className="flex items-center gap-2 text-[12px] font-bold text-[#2D4A49] border-b border-[#E2EAE9] pb-2">
                              <Thermometer size={16} className="text-[#5A8A88]" />
                              <span>ตรวจเช็คอุณหภูมิตู้แช่</span>
                            </div>

                            {/* Chiller */}
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[12px] font-bold text-[#2D4A49]">อุณหภูมิตู้แช่เย็น (Chiller ปกติ 2 - 6°C)</span>
                              <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border border-[#D4E4E3]">
                                <label className="flex items-center gap-1.5 cursor-pointer text-[12px] font-medium text-[#2D4A49]">
                                  <input type="radio" name="chillerStatus" value="ปกติ" checked={fridgeStatus.chillerStatus === 'ปกติ'} onChange={e => setFridgeStatus(p => ({...p, chillerStatus: e.target.value}))} className="accent-[#5A8A88]" />
                                  <span>ปกติ</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer text-[12px] font-medium text-[#2D4A49]">
                                  <input type="radio" name="chillerStatus" value="ไม่ปกติ" checked={fridgeStatus.chillerStatus === 'ไม่ปกติ'} onChange={e => setFridgeStatus(p => ({...p, chillerStatus: e.target.value}))} className="accent-[#EF4444]" />
                                  <span className="text-[#EF4444]">ไม่ปกติ</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer text-[12px] font-medium text-[#6B8F8E]">
                                  <input type="radio" name="chillerStatus" value="ไม่มีตู้" checked={fridgeStatus.chillerStatus === 'ไม่มีตู้'} onChange={e => setFridgeStatus(p => ({...p, chillerStatus: e.target.value}))} className="accent-[#6B8F8E]" />
                                  <span>ไม่มีตู้</span>
                                </label>
                                
                                <div className="flex items-center gap-2 ml-auto">
                                  <input type="number" placeholder="2-6" value={fridgeStatus.chillerTemp} onChange={e => setFridgeStatus(p => ({...p, chillerTemp: e.target.value}))} disabled={fridgeStatus.chillerStatus === 'ไม่มีตู้'} className="w-24 px-2.5 py-1.5 bg-[#F8FAF9] border border-[#D4E4E3] rounded-md text-right text-[12px] font-bold text-[#2D4A49] focus:bg-white focus:border-[#5A8A88] outline-none disabled:opacity-50" />
                                  <span className="text-[11px] font-bold text-[#6B8F8E]">°C</span>
                                </div>
                              </div>
                            </div>

                            {/* Freezer */}
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[12px] font-bold text-[#2D4A49]">อุณหภูมิตู้แช่แข็ง (Freezer ปกติ -18°C หรือต่ำกว่า)</span>
                              <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border border-[#D4E4E3]">
                                <label className="flex items-center gap-1.5 cursor-pointer text-[12px] font-medium text-[#2D4A49]">
                                  <input type="radio" name="freezerStatus" value="ปกติ" checked={fridgeStatus.freezerStatus === 'ปกติ'} onChange={e => setFridgeStatus(p => ({...p, freezerStatus: e.target.value}))} className="accent-[#5A8A88]" />
                                  <span>ปกติ</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer text-[12px] font-medium text-[#2D4A49]">
                                  <input type="radio" name="freezerStatus" value="ไม่ปกติ" checked={fridgeStatus.freezerStatus === 'ไม่ปกติ'} onChange={e => setFridgeStatus(p => ({...p, freezerStatus: e.target.value}))} className="accent-[#EF4444]" />
                                  <span className="text-[#EF4444]">ไม่ปกติ</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer text-[12px] font-medium text-[#6B8F8E]">
                                  <input type="radio" name="freezerStatus" value="ไม่มีตู้" checked={fridgeStatus.freezerStatus === 'ไม่มีตู้'} onChange={e => setFridgeStatus(p => ({...p, freezerStatus: e.target.value}))} className="accent-[#6B8F8E]" />
                                  <span>ไม่มีตู้</span>
                                </label>
                                
                                <div className="flex items-center gap-2 ml-auto">
                                  <input type="number" placeholder="-18" value={fridgeStatus.freezerTemp} onChange={e => setFridgeStatus(p => ({...p, freezerTemp: e.target.value}))} disabled={fridgeStatus.freezerStatus === 'ไม่มีตู้'} className="w-24 px-2.5 py-1.5 bg-[#F8FAF9] border border-[#D4E4E3] rounded-md text-right text-[12px] font-bold text-[#2D4A49] focus:bg-white focus:border-[#5A8A88] outline-none disabled:opacity-50" />
                                  <span className="text-[11px] font-bold text-[#6B8F8E]">°C</span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* Coffee Weigh Table Sub-section */}
                        {item.id === 'e_coffee_weigh' && item.checked && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-[#F8FAF9] rounded-xl p-4 border border-[#D4E4E3] ml-8 space-y-3"
                          >
                            <div className="flex items-center justify-between text-[12px] font-bold text-[#2D4A49] border-b border-[#E2EAE9] pb-2">
                              <span>ชั่งน้ำหนักเมล็ดกาแฟ ({type === 'Check-in' ? 'ก่อนเปิดร้าน' : 'หลังปิดร้าน'})</span>
                              <span className="text-[11px] text-[#6B8F8E] font-medium">{coffeeIngredients.length} รายการ</span>
                            </div>
                            <div className="overflow-hidden rounded-lg border border-[#D4E4E3]">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-[#E8F3F2] text-[#2D4A49] text-[12px] font-bold border-b border-[#D4E4E3]">
                                    <th className="py-2 px-3">เมล็ดกาแฟ</th>
                                    <th className="py-2 px-3 text-right">น้ำหนักชั่งจริง</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {coffeeIngredients.map(ing => (
                                    <tr key={ing.id} className="bg-white border-b border-[#E2EAE9] last:border-b-0 hover:bg-[#F8FAF9]">
                                      <td className="py-2 px-3">
                                        <div className="flex items-center gap-2">
                                          {ing.image && (
                                            <img src={ing.image} alt={ing.name} className="w-7 h-7 rounded-md object-cover border border-[#D4E4E3]" referrerPolicy="no-referrer" />
                                          )}
                                          <span className="text-[13px] font-semibold text-[#2D4A49]">{ing.name}</span>
                                        </div>
                                      </td>
                                      <td className="py-2 px-3 text-right">
                                        <div className="inline-flex items-center gap-1.5">
                                          <input
                                            type="number"
                                            placeholder="0.00"
                                            value={coffeeWeights[ing.id] || ''}
                                            onChange={(e) => setCoffeeWeights(prev => ({ ...prev, [ing.id]: e.target.value }))}
                                            className="w-24 px-2 py-1 bg-white border border-[#D4E4E3] rounded-md text-right text-[13px] font-bold text-[#2D4A49] focus:border-[#5A8A88] outline-none"
                                          />
                                          <span className="text-[12px] font-medium text-[#6B8F8E]">กรัม</span>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </motion.div>
                        )}

                        {/* Dial-in Coffee Sub-section */}
                        {item.id === 'e2' && item.checked && type === 'Check-in' && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-[#F8FAF9] rounded-xl p-4 border border-[#D4E4E3] ml-8 space-y-3"
                          >
                            <div className="text-[12px] font-bold text-[#2D4A49] border-b border-[#E2EAE9] pb-2">
                              บันทึกการตั้งค่ารสชาติ (Dial-in Coffee)
                            </div>
                            <div className="grid gap-3">
                              {coffeeIngredients.map(ing => (
                                <div key={ing.id} className="bg-white p-3.5 rounded-lg border border-[#D4E4E3] shadow-xs space-y-2.5">
                                  <div className="flex items-center gap-2.5 pb-2 border-b border-[#E2EAE9]">
                                    {ing.image && (
                                      <img src={ing.image} alt={ing.name} className="w-6 h-6 rounded-md object-cover border border-[#D4E4E3]" referrerPolicy="no-referrer" />
                                    )}
                                    <span className="text-[13px] font-bold text-[#2D4A49]">{ing.name}</span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2.5">
                                    <div className="space-y-1">
                                      <label className="text-[11px] font-medium text-[#6B8F8E]">Dose (g)</label>
                                      <input
                                        type="number"
                                        placeholder="18.5"
                                        value={coffeeDialIn[ing.id]?.dose || ''}
                                        onChange={(e) => setCoffeeDialIn(prev => ({ 
                                          ...prev, 
                                          [ing.id]: { ...(prev[ing.id] || { dose: '', yield: '', time: '' }), dose: e.target.value } 
                                        }))}
                                        className="w-full px-2 py-1.5 bg-[#F8FAF9] border border-[#D4E4E3] rounded-md text-center text-[13px] font-bold text-[#2D4A49] focus:bg-white focus:border-[#5A8A88] outline-none"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[11px] font-medium text-[#6B8F8E]">Yield (ml/g)</label>
                                      <input
                                        type="number"
                                        placeholder="38"
                                        value={coffeeDialIn[ing.id]?.yield || ''}
                                        onChange={(e) => setCoffeeDialIn(prev => ({ 
                                          ...prev, 
                                          [ing.id]: { ...(prev[ing.id] || { dose: '', yield: '', time: '' }), yield: e.target.value } 
                                        }))}
                                        className="w-full px-2 py-1.5 bg-[#F8FAF9] border border-[#D4E4E3] rounded-md text-center text-[13px] font-bold text-[#2D4A49] focus:bg-white focus:border-[#5A8A88] outline-none"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[11px] font-medium text-[#6B8F8E]">Time (s)</label>
                                      <input
                                        type="number"
                                        placeholder="28"
                                        value={coffeeDialIn[ing.id]?.time || ''}
                                        onChange={(e) => setCoffeeDialIn(prev => ({ 
                                          ...prev, 
                                          [ing.id]: { ...(prev[ing.id] || { dose: '', yield: '', time: '' }), time: e.target.value } 
                                        }))}
                                        className="w-full px-2 py-1.5 bg-[#F8FAF9] border border-[#D4E4E3] rounded-md text-center text-[13px] font-bold text-[#2D4A49] focus:bg-white focus:border-[#5A8A88] outline-none"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}

                        {/* Cash in Drawer Sub-section */}
                        {item.id === 'p1' && item.checked && type === 'Check-in' && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-[#F8FAF9] rounded-xl p-4 border border-[#D4E4E3] ml-8 space-y-3"
                          >
                            <div className="text-[12px] font-bold text-[#2D4A49] border-b border-[#E2EAE9] pb-2">
                              ระบุจำนวนเงินทอนในเก๊ะ (Cash in Drawer)
                            </div>
                            <div className="bg-white p-3.5 rounded-lg border border-[#D4E4E3] flex items-center justify-between gap-4">
                              <span className="text-[13px] font-bold text-[#2D4A49]">จำนวนเงินสดเริ่มต้น</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[18px] font-bold text-[#5A8A88]">฿</span>
                                <input
                                  type="number"
                                  placeholder="0.00"
                                  value={cashInDrawer}
                                  onChange={(e) => setCashInDrawer(e.target.value)}
                                  className="w-36 px-3 py-1.5 bg-[#F8FAF9] border border-[#D4E4E3] rounded-lg text-right text-[18px] font-bold text-[#2D4A49] focus:bg-white focus:border-[#5A8A88] outline-none"
                                />
                                <span className="text-[12px] font-bold text-[#6B8F8E]">บาท</span>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* Cup Counts Sub-section */}
                        {item.id === 'i4' && item.checked && type === 'Check-in' && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-[#F8FAF9] rounded-xl p-4 border border-[#D4E4E3] ml-8 space-y-3"
                          >
                            <div className="text-[12px] font-bold text-[#2D4A49] border-b border-[#E2EAE9] pb-2">
                              ตรวจนับจำนวนแก้วก่อนเปิดร้าน (1 แถว = 50 ใบ)
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {(['16oz', '12oz', '8oz'] as const).map(size => {
                                const sleeves = parseInt(cupCounts[size].sleeves) || 0;
                                const loose = parseInt(cupCounts[size].loose) || 0;
                                const total = (sleeves * 50) + loose;

                                return (
                                  <div key={size} className="bg-white p-3 rounded-lg border border-[#D4E4E3] flex flex-col gap-2">
                                    <label className="text-[11px] font-bold text-[#6B8F8E] uppercase">แก้ว {size.replace('oz', ' Oz.')}</label>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        placeholder="0"
                                        value={cupCounts[size].sleeves}
                                        onChange={(e) => setCupCounts(prev => ({ ...prev, [size]: { ...prev[size], sleeves: e.target.value } }))}
                                        className="w-full px-2 py-1.5 bg-[#F8FAF9] border border-[#D4E4E3] rounded-md text-center text-[13px] font-bold text-[#2D4A49] focus:bg-white focus:border-[#5A8A88] outline-none"
                                      />
                                      <span className="text-[11px] font-medium text-[#6B8F8E]">แถว</span>
                                      <input
                                        type="number"
                                        placeholder="0"
                                        value={cupCounts[size].loose}
                                        onChange={(e) => setCupCounts(prev => ({ ...prev, [size]: { ...prev[size], loose: e.target.value } }))}
                                        className="w-full px-2 py-1.5 bg-[#F8FAF9] border border-[#D4E4E3] rounded-md text-center text-[13px] font-bold text-[#2D4A49] focus:bg-white focus:border-[#5A8A88] outline-none"
                                      />
                                      <span className="text-[11px] font-medium text-[#6B8F8E]">ใบ</span>
                                    </div>
                                    <div className="mt-1 pt-1.5 border-t border-[#E2EAE9] flex justify-between items-center text-[11px]">
                                      <span className="text-[#6B8F8E]">รวมทั้งหมด</span>
                                      <span className="font-bold text-[#5A8A88]">{total} ใบ</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}

                        {/* Cup Usage Sub-section (Check-out) */}
                        {item.id === 'io5' && item.checked && type === 'Check-out' && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-[#F8FAF9] rounded-xl p-4 border border-[#D4E4E3] ml-8 space-y-3"
                          >
                            <div className="text-[12px] font-bold text-[#2D4A49] border-b border-[#E2EAE9] pb-2">
                              สรุปการใช้งานแก้วประจำวัน (1 แถว = 50 ใบ)
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {(['16oz', '12oz', '8oz'] as const).map((size) => {
                                const broughtForward = getBroughtForward(size);
                                const added = parseInt(cupUsage[size].added) || 0;
                                const remainingSleeves = parseInt(cupUsage[size].remainingSleeves) || 0;
                                const remainingLoose = parseInt(cupUsage[size].remainingLoose) || 0;
                                const remainingTotal = (remainingSleeves * 50) + remainingLoose;
                                const actualUsage = broughtForward + added - remainingTotal;

                                return (
                                  <div key={size} className="bg-white p-3 rounded-lg border border-[#D4E4E3] flex flex-col gap-2.5">
                                    <div className="flex justify-between items-center border-b border-[#E2EAE9] pb-1.5">
                                      <label className="text-[12px] font-bold text-[#2D4A49] uppercase">แก้ว {size.replace('oz', ' Oz.')}</label>
                                      <span className="text-[10px] font-semibold text-[#5A8A88] bg-[#E8F3F2] px-2 py-0.5 rounded">
                                        ยกมา: {broughtForward}
                                      </span>
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] text-[#6B8F8E]">เบิกเพิ่ม (ใบ)</span>
                                        <input
                                          type="number"
                                          placeholder="0"
                                          value={cupUsage[size].added}
                                          onChange={(e) => setCupUsage(prev => ({ ...prev, [size]: { ...prev[size], added: e.target.value } }))}
                                          className="w-20 px-2 py-1 bg-[#F8FAF9] border border-[#D4E4E3] rounded text-center text-[12px] font-bold text-[#2D4A49] focus:bg-white focus:border-[#5A8A88] outline-none"
                                        />
                                      </div>
                                      
                                      <div className="flex flex-col gap-1">
                                        <span className="text-[11px] text-[#6B8F8E]">คงเหลือตอนปิดร้าน</span>
                                        <div className="flex items-center gap-1.5">
                                          <input
                                            type="number"
                                            placeholder="0"
                                            value={cupUsage[size].remainingSleeves}
                                            onChange={(e) => setCupUsage(prev => ({ ...prev, [size]: { ...prev[size], remainingSleeves: e.target.value } }))}
                                            className="w-full px-2 py-1 bg-[#F8FAF9] border border-[#D4E4E3] rounded text-center text-[12px] font-bold text-[#2D4A49] focus:bg-white focus:border-[#5A8A88] outline-none"
                                          />
                                          <span className="text-[10px] text-[#6B8F8E]">แถว</span>
                                          <input
                                            type="number"
                                            placeholder="0"
                                            value={cupUsage[size].remainingLoose}
                                            onChange={(e) => setCupUsage(prev => ({ ...prev, [size]: { ...prev[size], remainingLoose: e.target.value } }))}
                                            className="w-full px-2 py-1 bg-[#F8FAF9] border border-[#D4E4E3] rounded text-center text-[12px] font-bold text-[#2D4A49] focus:bg-white focus:border-[#5A8A88] outline-none"
                                          />
                                          <span className="text-[10px] text-[#6B8F8E]">ใบ</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="mt-1 pt-1.5 border-t border-[#E2EAE9] flex justify-between items-center text-[11px]">
                                      <span className="text-[#6B8F8E]">ยอดใช้งานจริง</span>
                                      <span className={cn("font-bold text-[13px]", actualUsage < 0 ? "text-[#EF4444]" : "text-[#5A8A88]")}>
                                        {actualUsage} ใบ
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}

                        {/* Sales Summary Sub-section (Check-out) */}
                        {item.id === 'so_sales' && item.checked && type === 'Check-out' && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-[#F8FAF9] rounded-xl p-4 sm:p-5 border border-[#D4E4E3] ml-8 space-y-4"
                          >
                            <div className="flex justify-between items-center border-b border-[#E2EAE9] pb-2">
                              <span className="text-[13px] font-bold text-[#2D4A49]">สรุปยอดขายประจำวัน</span>
                              <span className="bg-[#E8F3F2] text-[#5A8A88] px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                                เงินทอนยกมา: {checkInCash.toLocaleString()} บาท
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                              <div className="space-y-1">
                                <label className="text-[11px] font-medium text-[#6B8F8E]">ยอดขายทั้งหมด</label>
                                <input
                                  type="number"
                                  placeholder="0.00"
                                  value={salesSummary.total}
                                  onChange={(e) => setSalesSummary(prev => ({ ...prev, total: e.target.value }))}
                                  className="w-full px-3 py-2 bg-white border border-[#D4E4E3] rounded-lg text-right text-[14px] font-bold text-[#2D4A49] focus:border-[#5A8A88] outline-none shadow-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-medium text-[#6B8F8E]">เงินสดภายในลิ้นชักทั้งหมด</label>
                                <input
                                  type="number"
                                  placeholder="0.00"
                                  value={salesSummary.totalCashInDrawer}
                                  onChange={(e) => setSalesSummary(prev => ({ ...prev, totalCashInDrawer: e.target.value }))}
                                  className="w-full px-3 py-2 bg-white border border-[#D4E4E3] rounded-lg text-right text-[14px] font-bold text-[#2D4A49] focus:border-[#5A8A88] outline-none shadow-xs"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2 border-t border-[#E2EAE9]">
                              <div className="space-y-1">
                                <label className="text-[11px] font-medium text-[#6B8F8E]">เงินสด (Cash)</label>
                                <div className="w-full px-3 py-2 bg-[#F0F5F4] border border-[#D4E4E3] rounded-lg text-right text-[13px] font-bold text-[#2D4A49]">
                                  {salesSummary.cash || '0'} บาท
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-medium text-[#6B8F8E]">เงินโอน (Transfer)</label>
                                <div className="w-full px-3 py-2 bg-[#F0F5F4] border border-[#D4E4E3] rounded-lg text-right text-[13px] font-bold text-[#2D4A49]">
                                  {salesSummary.transfer || '0'} บาท
                                </div>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-medium text-[#6B8F8E]">หมายเหตุ (กรณีเงินสดไม่ครบถ้วน)</label>
                              <textarea
                                placeholder="ระบุสาเหตุ..."
                                value={salesSummary.notes}
                                onChange={(e) => setSalesSummary(prev => ({ ...prev, notes: e.target.value }))}
                                className="w-full px-3 py-2 bg-white border border-[#D4E4E3] rounded-lg text-[13px] text-[#2D4A49] focus:border-[#5A8A88] outline-none shadow-xs min-h-[70px]"
                              />
                            </div>
                          </motion.div>
                        )}
                      </div>
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
                <AlertCircle size={28} />
              </div>
              <h3 className="text-[16px] font-bold text-[#2D4A49] mb-1.5">ยืนยันการบันทึกรายการ?</h3>
              <p className="text-[12px] text-[#6B8F8E] mb-5">
                {isAllChecked 
                  ? 'คุณได้ตรวจสอบครบทุกรายการแล้ว ต้องการบันทึกข้อมูลใช่หรือไม่?' 
                  : `คุณยังตรวจสอบไม่ครบ (ตรวจสอบแล้ว ${checkedItems}/${totalItems} รายการ) ต้องการบันทึกข้อมูลใช่หรือไม่?`}
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
                  className="px-4 py-2.5 bg-[#5A8A88] text-white rounded-xl text-[12px] font-semibold hover:bg-[#4A7A78] transition-colors shadow-xs cursor-pointer"
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
