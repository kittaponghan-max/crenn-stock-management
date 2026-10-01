import React from 'react';
import { LogEntry, Ingredient, ReceivingRecord } from '../types';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { 
  History, 
  User, 
  Clock, 
  FileText, 
  Search, 
  ClipboardList, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Circle, 
  Coffee, 
  Calendar, 
  Sparkles, 
  Package, 
  Printer, 
  ChevronDown, 
  FileDown, 
  Trash2, 
  RefreshCw, 
  AlertCircle,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuditLogProps {
  logs: LogEntry[];
  checklistRecords: any[];
  receivingRecords?: ReceivingRecord[];
  ingredients?: Ingredient[];
  initialTab?: 'logs' | 'checklist' | 'receiving' | 'stockSubmit';
  onDeleteReceivingRecord?: (id: string) => void;
  isReadOnly?: boolean;
}

export function AuditLog({ 
  logs, 
  checklistRecords, 
  receivingRecords = [], 
  ingredients = [], 
  initialTab = 'logs', 
  onDeleteReceivingRecord, 
  isReadOnly = false 
}: AuditLogProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'logs' | 'checklist' | 'receiving' | 'stockSubmit'>(initialTab);
  const [expandedLogIds, setExpandedLogIds] = React.useState<Record<string, boolean>>({});
  const [selectedRecord, setSelectedRecord] = React.useState<any | null>(null);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = React.useState(false);

  // Reliable data fetching state & real-time sync
  const [liveLogs, setLiveLogs] = React.useState<LogEntry[]>([]);
  const [liveChecklists, setLiveChecklists] = React.useState<any[]>([]);
  const [liveReceiving, setLiveReceiving] = React.useState<ReceivingRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [lastFetch, setLastFetch] = React.useState<Date>(new Date());

  const fetchData = React.useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      let branch = 'Rayong';
      try {
        const raw = localStorage.getItem('cafe-user');
        if (raw) {
          const u = JSON.parse(raw);
          if (u.branch) branch = u.branch;
        }
      } catch (e) {}

      const [
        { data: logsData },
        { data: checkData },
        { data: recData }
      ] = await Promise.all([
        supabase.from('audit_logs').select('*').eq('branch', branch).order('timestamp', { ascending: false }).limit(150),
        supabase.from('checklist_records').select('*').eq('branch', branch).order('timestamp', { ascending: false }).limit(150),
        supabase.from('receiving_records').select('*').eq('branch', branch).order('receive_date', { ascending: false }).limit(200)
      ]);

      if (logsData) {
        setLiveLogs(logsData.map((l: any) => ({
          id: l.id,
          timestamp: l.timestamp,
          userEmail: l.user_email,
          userRole: l.user_role,
          action: l.action,
          details: l.details
        })));
      }

      if (checkData) {
        setLiveChecklists(checkData.map((c: any) => ({
          id: c.id,
          timestamp: c.timestamp,
          type: c.type,
          reportDate: c.report_date,
          reporterName: c.reporter_name,
          ...c.data
        })));
      }

      if (recData) {
        setLiveReceiving(recData.map((r: any) => ({
          id: r.id,
          date: r.receive_date,
          ingredientId: r.ingredient_id,
          supplier: r.supplier,
          quantity: r.quantity,
          expiryDate: r.expiry_date,
          userName: r.user_name || '-'
        })));
      }
    } catch (err: any) {
      console.error('Fetch exception in AuditLog:', err);
    } finally {
      setLoading(false);
      setLastFetch(new Date());
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time Supabase subscriptions
  React.useEffect(() => {
    if (!supabase) return;

    const channel1 = supabase
      .channel(`audit-logs-rt-${Math.random().toString(36).substring(2, 7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, () => fetchData())
      .subscribe();

    const channel2 = supabase
      .channel(`checklist-rt-${Math.random().toString(36).substring(2, 7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_records' }, () => fetchData())
      .subscribe();

    const channel3 = supabase
      .channel(`receiving-rt-${Math.random().toString(36).substring(2, 7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'receiving_records' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel1);
      supabase.removeChannel(channel2);
      supabase.removeChannel(channel3);
    };
  }, [fetchData]);

  React.useEffect(() => {
    const handleVis = () => {
      if (document.visibilityState === 'visible') fetchData();
    };
    const handleFoc = () => fetchData();
    document.addEventListener('visibilitychange', handleVis);
    window.addEventListener('focus', handleFoc);
    return () => {
      document.removeEventListener('visibilitychange', handleVis);
      window.removeEventListener('focus', handleFoc);
    };
  }, [fetchData]);

  const effectiveLogs = liveLogs.length > 0 ? liveLogs : logs;
  const effectiveChecklists = liveChecklists.length > 0 ? liveChecklists : checklistRecords;
  const effectiveReceiving = liveReceiving.length > 0 ? liveReceiving : receivingRecords;

  // Reset active tab when initialTab changes
  React.useEffect(() => {
    setActiveTab(initialTab);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [initialTab]);

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeTab]);

  const getIngredientName = (id: string) => {
    const ingredient = ingredients.find(i => i.id === id);
    return ingredient ? ingredient.name : 'ไม่ทราบชื่อ';
  };

  const getIngredientUnit = (id: string) => {
    const ingredient = ingredients.find(i => i.id === id);
    return ingredient ? ingredient.unit : '';
  };

  React.useEffect(() => {
    const handleClickOutside = () => {
      if (isExportDropdownOpen) setIsExportDropdownOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isExportDropdownOpen]);

  const exportExcel = async () => {
    if (!selectedRecord) return;
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
      ['รายงาน', `Bar ${selectedRecord.type}`],
      ['วันที่', format(new Date(selectedRecord.reportDate || selectedRecord.timestamp), 'dd/MM/yyyy')],
      ['ผู้ทำรายงาน', selectedRecord.reporterName || selectedRecord.userEmail || '-'],
      [],
    ];

    if (selectedRecord.type === 'Check-in' && selectedRecord.cashInDrawer) {
      summaryData.push(['เงินสดเริ่มต้น (บาท)', selectedRecord.cashInDrawer]);
      summaryData.push([]);
    }

    if (selectedRecord.type === 'Check-in' && selectedRecord.machineStatus && (selectedRecord.machineStatus.steamBoiler || selectedRecord.machineStatus.pumpPressure || selectedRecord.machineStatus.temp)) {
      summaryData.push(['ตรวจความพร้อมเครื่องชง', '']);
      summaryData.push(['Steam Boiler (bar)', selectedRecord.machineStatus.steamBoiler || '-']);
      summaryData.push(['Pump Pressure (bar)', selectedRecord.machineStatus.pumpPressure || '-']);
      summaryData.push(['อุณหภูมิ (°C)', selectedRecord.machineStatus.temp || '-']);
      summaryData.push([]);
    }

    if (selectedRecord.type === 'Check-in' && selectedRecord.waterQuality) {
      summaryData.push(['ค่าน้ำ (ppm)', selectedRecord.waterQuality]);
      summaryData.push([]);
    }

    if (selectedRecord.type === 'Check-in' && selectedRecord.fridgeStatus && (selectedRecord.fridgeStatus.chillerStatus || selectedRecord.fridgeStatus.freezerStatus)) {
      summaryData.push(['อุณหภูมิตู้แช่เย็น', '']);
      summaryData.push(['สถานะ', selectedRecord.fridgeStatus.chillerStatus || '-']);
      summaryData.push(['อุณหภูมิ (°C)', selectedRecord.fridgeStatus.chillerTemp || '-']);
      summaryData.push(['อุณหภูมิตู้แช่แข็ง', '']);
      summaryData.push(['สถานะ', selectedRecord.fridgeStatus.freezerStatus || '-']);
      summaryData.push(['อุณหภูมิ (°C)', selectedRecord.fridgeStatus.freezerTemp || '-']);
      summaryData.push([]);
    }

    if (selectedRecord.type === 'Check-out' && selectedRecord.salesSummary?.total) {
      summaryData.push(['สรุปยอดขาย', '']);
      summaryData.push(['ยอดขายทั้งหมด', selectedRecord.salesSummary.total || '0']);
      summaryData.push(['เงินสดภายในลิ้นชักทั้งหมด', selectedRecord.salesSummary.totalCashInDrawer || '0']);
      summaryData.push(['เงินสด (Cash)', selectedRecord.salesSummary.cash || '0']);
      summaryData.push(['เงินโอน (Transfer)', selectedRecord.salesSummary.transfer || '0']);
      summaryData.push(['หมายเหตุ', selectedRecord.salesSummary.notes || '-']);
      summaryData.push([]);
    }

    if (selectedRecord.coffeeWeights && Object.keys(selectedRecord.coffeeWeights).length > 0) {
      summaryData.push(['น้ำหนักเมล็ดกาแฟ', 'ปริมาณ (กรัม)']);
      Object.entries(selectedRecord.coffeeWeights).forEach(([id, weight]) => {
        const ing = ingredients.find(i => i.id === id);
        if (ing) {
          summaryData.push([ing.name, String(weight)]);
        }
      });
      summaryData.push([]);
    }

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Checklist Sheet
    if (selectedRecord.categories && selectedRecord.categories.length > 0) {
      const checklistData = [
        ['หมวดหมู่', 'รายการ', 'สถานะ']
      ];

      selectedRecord.categories.forEach((cat: any) => {
        cat.items.forEach((item: any) => {
          checklistData.push([cat.title, item.label, item.checked ? 'ผ่าน / เรียบร้อย' : 'ยังไม่เรียบร้อย']);
        });
      });

      const wsChecklist = XLSX.utils.aoa_to_sheet(checklistData);
      XLSX.utils.book_append_sheet(wb, wsChecklist, 'Checklist');
    }

    const dateStr = format(new Date(selectedRecord.reportDate || selectedRecord.timestamp), 'yyyyMMdd');
    XLSX.writeFile(wb, `Audit_${selectedRecord.type}_${dateStr}.xlsx`);
  };

  const exportPDF = async () => {
    if (!selectedRecord) return;
    const element = document.getElementById('audit-report');
    if (!element) return;

    try {
      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');

      const imgData = await toPng(element, {
        backgroundColor: '#FFFFFF',
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

      const dateStr = format(new Date(selectedRecord.reportDate || selectedRecord.timestamp), 'yyyyMMdd');
      pdf.save(`Audit_${selectedRecord.type}_${dateStr}.pdf`);
    } catch (error) {
      console.warn('Error generating PDF:', error);
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF โปรดลองอีกครั้ง');
    }
  };

  const stockSubmitLogs = effectiveLogs.filter(log => log.action.includes('ส่งรายงาน'));

  const filteredLogs = effectiveLogs.filter(log => 
    !log.action.includes('ส่งรายงาน') && (
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const filteredStockSubmit = stockSubmitLogs.filter(log =>
    (log.action && log.action.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (log.userEmail && log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredChecklist = effectiveChecklists.filter(record => 
    (record.type && record.type.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (record.timestamp && record.timestamp.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (record.reporterName && record.reporterName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (record.userEmail && record.userEmail.toLowerCase().includes(searchTerm.toLowerCase()))
  ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const filteredReceiving = effectiveReceiving.filter(record => {
    const ingName = getIngredientName(record.ingredientId);
    return ingName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           record.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (record.userName && record.userName.toLowerCase().includes(searchTerm.toLowerCase()));
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Render Check-in / Check-out Detailed View
  if (selectedRecord) {
    return (
      <div className="w-full bg-white rounded-2xl shadow-[0_2px_8px_rgba(90,138,136,0.08)] border border-[#D4E4E3] overflow-hidden flex flex-col animate-in fade-in duration-200" id="audit-report">
        <div className="p-4 sm:p-5 border-b border-[#D4E4E3] bg-[#F0F5F4]/60 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSelectedRecord(null)}
              className="p-1.5 hover:bg-[#E8F3F2] rounded-lg transition-colors text-[#5A8A88] border border-[#D4E4E3] bg-white cursor-pointer"
              title="ย้อนกลับ"
            >
              <ChevronLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${
                  selectedRecord.type === 'Check-in' 
                    ? 'bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]' 
                    : 'bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]'
                }`}>
                  {selectedRecord.type}
                </span>
                <h2 className="text-[15px] font-bold text-[#2D4A49]">รายละเอียดรายงานตรวจสอบ</h2>
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <p className="text-[#6B8F8E] text-[11px] flex items-center gap-1">
                  <Clock size={12} className="text-[#5A8A88]" />
                  บันทึกเมื่อ {format(new Date(selectedRecord.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                </p>
                {selectedRecord.reportDate && (
                  <p className="text-[#5A8A88] text-[11px] font-semibold flex items-center gap-1">
                    <Calendar size={12} />
                    วันที่รายงาน: {format(new Date(selectedRecord.reportDate), 'dd/MM/yyyy')}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden z-20">
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExportDropdownOpen(!isExportDropdownOpen);
                }}
                className="flex items-center gap-1.5 bg-[#5A8A88] hover:bg-[#4A7A78] text-white px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all shadow-xs cursor-pointer"
              >
                <Printer size={13} />
                <span>Export / Print</span>
                <ChevronDown size={12} className={cn("transition-transform", isExportDropdownOpen && "rotate-180")} />
              </button>

              {isExportDropdownOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-[#D4E4E3] py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-left">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportExcel();
                      setIsExportDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[11px] text-[#2D4A49] hover:bg-[#F0F5F4] transition-colors font-medium"
                  >
                    <FileDown size={14} className="text-[#5A8A88]" />
                    Excel (.xlsx)
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportPDF();
                      setIsExportDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[11px] text-[#2D4A49] hover:bg-[#F0F5F4] transition-colors font-medium"
                  >
                    <Printer size={14} className="text-[#7A9E9C]" />
                    PDF / Print
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal / Report Body Content */}
        <div className="p-5 space-y-6 overflow-y-auto max-h-[72vh]">
          {/* Coffee Weights */}
          {selectedRecord.coffeeWeights && Object.keys(selectedRecord.coffeeWeights).length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[11px] font-bold text-[#6B8F8E] uppercase tracking-wider flex items-center gap-1.5">
                <Coffee size={13} className="text-[#5A8A88]" />
                น้ำหนักเมล็ดกาแฟก่อนใช้งาน
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {Object.entries(selectedRecord.coffeeWeights).map(([id, weight]: [string, any]) => {
                  const ing = ingredients.find(i => i.id === id);
                  return (
                    <div key={id} className="bg-[#F0F5F4] p-2.5 rounded-lg border border-[#D4E4E3]">
                      <div className="text-[10px] font-medium text-[#6B8F8E] uppercase mb-0.5 truncate">
                        {ing ? ing.name : `ID: ${id}`}
                      </div>
                      <div className="text-[14px] font-bold text-[#2D4A49]">
                        {weight} <span className="text-[10px] font-normal text-[#6B8F8E]">กรัม</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Coffee Dial-in */}
          {selectedRecord.coffeeDialIn && Object.keys(selectedRecord.coffeeDialIn).length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[11px] font-bold text-[#6B8F8E] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} className="text-[#5A8A88]" />
                การตั้งค่ารสชาติ (Dial-in Coffee)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(selectedRecord.coffeeDialIn).map(([id, dial]: [string, any]) => {
                  const ing = ingredients.find(i => i.id === id);
                  return (
                    <div key={id} className="bg-[#E8F3F2]/50 p-3.5 rounded-xl border border-[#D4E4E3] flex flex-col gap-2.5">
                      <div className="flex items-center gap-2 border-b border-[#D4E4E3]/60 pb-1.5">
                        <div className="p-1 bg-[#E8F3F2] text-[#5A8A88] rounded-md">
                          <Coffee size={13} />
                        </div>
                        <span className="text-[12px] font-semibold text-[#2D4A49] truncate">
                          {ing ? ing.name : `ID: ${id}`}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center">
                          <div className="text-[9px] font-semibold text-[#6B8F8E] uppercase">Dose</div>
                          <div className="text-[13px] font-bold text-[#2D4A49]">{dial.dose || '-'} <span className="text-[9px] font-normal">g</span></div>
                        </div>
                        <div className="text-center border-x border-[#D4E4E3]">
                          <div className="text-[9px] font-semibold text-[#6B8F8E] uppercase">Yield</div>
                          <div className="text-[13px] font-bold text-[#2D4A49]">{dial.yield || '-'} <span className="text-[9px] font-normal">g</span></div>
                        </div>
                        <div className="text-center">
                          <div className="text-[9px] font-semibold text-[#6B8F8E] uppercase">Time</div>
                          <div className="text-[13px] font-bold text-[#2D4A49]">{dial.time || '-'} <span className="text-[9px] font-normal">s</span></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Checklist Items */}
          {selectedRecord.categories && selectedRecord.categories.length > 0 && (
            <div className="space-y-4">
              {selectedRecord.categories.map((cat: any, idx: number) => (
                <div key={idx} className="space-y-2">
                  <h4 className="font-semibold text-[12px] text-[#2D4A49] border-b border-[#D4E4E3] pb-1">{cat.title}</h4>
                  <div className="grid gap-1.5">
                    {cat.items?.map((item: any, iidx: number) => (
                      <div key={iidx} className={cn(
                        "flex items-center gap-2.5 p-2 rounded-lg border text-[11px]",
                        item.checked 
                          ? "bg-[#E8F3F2] border-[#D4E4E3] text-[#2D4A49]" 
                          : "bg-[#F0F5F4]/50 border-slate-200 text-[#6B8F8E] opacity-60"
                      )}>
                        {item.checked ? <CheckCircle2 size={14} className="text-[#5A8A88] shrink-0" /> : <Circle size={14} className="text-[#A8BCBB] shrink-0" />}
                        <span className={item.checked ? "font-medium" : ""}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-2xl border border-[#D4E4E3] shadow-[0_2px_8px_rgba(90,138,136,0.08)] p-5">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          CARD HEADER (title + search + refresh)
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-4">
        {/* Left — Title block */}
        <div className="flex flex-col">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-[#E8F3F2] flex items-center justify-center shrink-0">
              <Clock size={18} className="text-[#5A8A88]" />
            </div>
            <h2 className="text-[16px] font-bold text-[#2D4A49] ml-2.5">
              ประวัติย้อนหลัง
            </h2>
          </div>
          <span className="text-[11px] text-[#6B8F8E] mt-0.5 ml-[42px]">
            แสดงรายการล่าสุด 120 รายการ
          </span>
        </div>

        {/* Right — Search + Refresh */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="relative w-full sm:w-[240px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A8BCBB]" />
            <input
              type="text"
              placeholder={
                activeTab === 'logs' 
                  ? "ค้นหาประวัติการแก้ไข..." 
                  : activeTab === 'receiving' 
                    ? "ค้นหาประวัติการรับวัตถุดิบ..." 
                    : activeTab === 'stockSubmit' 
                      ? "ค้นหาประวัติส่งนับสต็อก..." 
                      : "ค้นหาประวัติ Check-in/out..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#F0F5F4] border border-[#D4E4E3] rounded-lg pl-9 pr-3 py-2 text-[11px] text-[#2D4A49] placeholder:text-[#6B8F8E] focus:outline-none focus:border-[#5A8A88] focus:ring-2 focus:ring-[#5A8A88]/15 transition-all"
            />
          </div>
          <button
            type="button"
            onClick={() => fetchData()}
            disabled={loading}
            title="รีเฟรชข้อมูลล่าสุด (Sync with Supabase)"
            className="p-2 bg-white border border-[#D4E4E3] rounded-lg text-[#5A8A88] hover:bg-[#E8F3F2] transition-colors disabled:opacity-50 cursor-pointer shadow-xs shrink-0 ml-2"
          >
            <RefreshCw size={14} className={cn(loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          TAB FILTERS (Teal-themed)
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex gap-2 my-4 flex-wrap border-b border-[#D4E4E3] pb-0">
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={cn(
            "text-[11px] px-3.5 py-2 transition-all cursor-pointer",
            activeTab === 'logs'
              ? "bg-transparent border-b-2 border-[#5A8A88] text-[#5A8A88] font-semibold -mb-[1px]"
              : "bg-transparent border-b-2 border-transparent text-[#6B8F8E] font-normal hover:text-[#2D4A49] hover:border-[#D4E4E3]"
          )}
        >
          ประวัติการแก้ไขข้อมูล
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stockSubmit')}
          className={cn(
            "text-[11px] px-3.5 py-2 transition-all cursor-pointer",
            activeTab === 'stockSubmit'
              ? "bg-transparent border-b-2 border-[#5A8A88] text-[#5A8A88] font-semibold -mb-[1px]"
              : "bg-transparent border-b-2 border-transparent text-[#6B8F8E] font-normal hover:text-[#2D4A49] hover:border-[#D4E4E3]"
          )}
        >
          ประวัติส่งนับสต็อก
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('checklist')}
          className={cn(
            "text-[11px] px-3.5 py-2 transition-all cursor-pointer",
            activeTab === 'checklist'
              ? "bg-transparent border-b-2 border-[#5A8A88] text-[#5A8A88] font-semibold -mb-[1px]"
              : "bg-transparent border-b-2 border-transparent text-[#6B8F8E] font-normal hover:text-[#2D4A49] hover:border-[#D4E4E3]"
          )}
        >
          ประวัติ Check-in & Check-out
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('receiving')}
          className={cn(
            "text-[11px] px-3.5 py-2 transition-all cursor-pointer",
            activeTab === 'receiving'
              ? "bg-transparent border-b-2 border-[#5A8A88] text-[#5A8A88] font-semibold -mb-[1px]"
              : "bg-transparent border-b-2 border-transparent text-[#6B8F8E] font-normal hover:text-[#2D4A49] hover:border-[#D4E4E3]"
          )}
        >
          ประวัติการรับวัตถุดิบ
        </button>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          TAB CONTENT / HISTORY LIST ITEMS
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="divide-y divide-[#F0F5F4] max-h-[600px] overflow-y-auto pr-1">
        {/* TAB 1: ประวัติการแก้ไขข้อมูล */}
        {activeTab === 'logs' && (
          filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#6B8F8E]">
              <History size={40} strokeWidth={1.5} className="mb-2.5 opacity-30 text-[#5A8A88]" />
              <p className="text-[12px]">ไม่พบประวัติการแก้ไข</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              let summaryText = log.action === 'System Backup' ? '[ข้อมูลสำรองระบบอัตโนมัติซ่อนอยู่]' : log.details;
              let changesList: any[] = [];
              let isJsonData = false;
              try {
                const parsed = JSON.parse(log.details);
                if (parsed && typeof parsed === 'object' && parsed.summary) {
                  summaryText = parsed.summary;
                  if (Array.isArray(parsed.changes)) {
                    changesList = parsed.changes;
                    isJsonData = true;
                  }
                }
              } catch (e) {}

              const hasChanges = isJsonData && changesList.length > 0;
              const isExpanded = !!expandedLogIds[log.id];

              return (
                <div 
                  key={log.id} 
                  onClick={() => {
                    if (hasChanges) {
                      setExpandedLogIds(prev => ({
                        ...prev,
                        [log.id]: !prev[log.id]
                      }));
                    }
                  }}
                  className={cn(
                    "flex items-start gap-3 py-3.5 border-b border-[#F0F5F4] last:border-0 hover:bg-[#FAFCFC] rounded-lg hover:px-2 transition-all",
                    hasChanges && "cursor-pointer",
                    isExpanded && "bg-[#FAFCFC]"
                  )}
                >
                  {/* LEFT — Icon circle (ประวัติการแก้ไขข้อมูล: bg #E8F3F2, icon #5A8A88) */}
                  <div className="w-8 h-8 rounded-full bg-[#E8F3F2] flex items-center justify-center shrink-0 mt-0.5">
                    <Clock size={14} className="text-[#5A8A88]" />
                  </div>

                  {/* MIDDLE — Content block */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[12px] font-semibold text-[#2D4A49]">
                        {log.action}
                      </span>
                      {hasChanges && (
                        <span className="text-[9px] font-medium text-[#5A8A88] bg-[#E8F3F2] border border-[#D4E4E3] rounded-full px-2 py-0.2">
                          มีการแก้ไข ({changesList.length} รายการ)
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] font-normal text-[#6B8F8E] leading-[1.4] mb-1.5 break-words">
                      {summaryText}
                    </p>

                    {/* Collapsible Changes List */}
                    {isExpanded && hasChanges && (
                      <div 
                        className="my-2.5 pl-3 border-l-2 border-[#5A8A88] space-y-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {changesList.map((ch, idx) => (
                            <div key={idx} className="p-2 bg-[#F0F5F4] border border-[#D4E4E3] rounded-lg text-[11px] flex flex-col gap-1">
                              <div className="flex items-center justify-between gap-1 flex-wrap">
                                {ch.itemName && (
                                  <span className="font-bold text-[#2D4A49] bg-white px-1.5 py-0.5 rounded border border-[#D4E4E3] text-[10px] truncate max-w-[130px]">
                                    {ch.itemName}
                                  </span>
                                )}
                                {(ch.dayLabel || ch.date) && (
                                  <span className="text-[10px] text-[#5A8A88] font-medium bg-[#E8F3F2] px-1.5 py-0.2 rounded">
                                    {ch.dayLabel || ch.date}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between gap-1.5 mt-0.5">
                                <span className="font-medium text-[#4A6B6A] truncate max-w-[140px]">
                                  {ch.field || ch.ingredientName || 'รายการ'}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[#A8BCBB] line-through text-[10px]">({ch.oldVal})</span>
                                  <span className="text-[#6B8F8E]">➜</span>
                                  <span className="bg-[#E8F3F2] text-[#5A8A88] px-1.5 py-0.5 rounded font-bold text-[10px] border border-[#D4E4E3]">
                                    {ch.newVal} {ch.unit || ''}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <User size={11} className="text-[#A8BCBB]" />
                        <span className="text-[11px] font-medium text-[#5A8A88]">
                          {log.userEmail}
                        </span>
                        <span className="text-[9px] font-semibold text-[#5A8A88] bg-[#E8F3F2] border border-[#D4E4E3] rounded px-1.5 py-0.5 tracking-[0.05em] uppercase">
                          {log.userRole || 'USER'}
                        </span>
                      </div>

                      {hasChanges && (
                        <div className="flex items-center gap-1 text-[10px] font-medium text-[#5A8A88]">
                          <span>{isExpanded ? 'ย่อข้อมูล' : 'ดูรายละเอียดการแก้ไข'}</span>
                          <ChevronDown size={12} className={cn("transition-transform duration-200", isExpanded && "rotate-180")} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT — Timestamp */}
                  <span className="text-[10px] font-normal text-[#A8BCBB] whitespace-nowrap shrink-0 ml-3 self-start mt-0.5">
                    {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                  </span>
                </div>
              );
            })
          )
        )}

        {/* TAB 2: ประวัติส่งนับสต็อก */}
        {activeTab === 'stockSubmit' && (
          filteredStockSubmit.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#6B8F8E]">
              <ClipboardList size={40} strokeWidth={1.5} className="mb-2.5 opacity-30 text-[#F59E0B]" />
              <p className="text-[12px]">ไม่พบประวัติการส่งรายงานตรวจนับสต็อก</p>
            </div>
          ) : (
            filteredStockSubmit.map((log) => {
              let summaryText = log.details;
              let changesList: any[] = [];
              let isJsonData = false;
              try {
                const parsed = JSON.parse(log.details);
                if (parsed && typeof parsed === 'object' && parsed.summary) {
                  summaryText = parsed.summary;
                  if (Array.isArray(parsed.changes)) {
                    changesList = parsed.changes;
                    isJsonData = true;
                  }
                }
              } catch (e) {}

              const hasChanges = isJsonData && changesList.length > 0;
              const isExpanded = !!expandedLogIds[log.id];

              return (
                <div 
                  key={log.id} 
                  onClick={() => {
                    setExpandedLogIds(prev => ({
                      ...prev,
                      [log.id]: !prev[log.id]
                    }));
                  }}
                  className={cn(
                    "flex items-start gap-3 py-3.5 border-b border-[#F0F5F4] last:border-0 hover:bg-[#FAFCFC] rounded-lg hover:px-2 transition-all cursor-pointer",
                    isExpanded && "bg-[#FAFCFC]"
                  )}
                >
                  {/* LEFT — Icon circle (ประวัติส่งนับสต็อก: bg #FEF3C7, icon #F59E0B) */}
                  <div className="w-8 h-8 rounded-full bg-[#FEF3C7] flex items-center justify-center shrink-0 mt-0.5">
                    <Clock size={14} className="text-[#F59E0B]" />
                  </div>

                  {/* MIDDLE — Content block */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[12px] font-semibold text-[#2D4A49]">
                        {log.action}
                      </span>
                      {hasChanges && (
                        <span className="text-[9px] font-medium text-[#5A8A88] bg-[#E8F3F2] border border-[#D4E4E3] rounded-full px-2 py-0.2">
                          มีการเปลี่ยนแปลง ({changesList.length})
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] font-normal text-[#6B8F8E] leading-[1.4] mb-1.5 break-words">
                      {summaryText}
                    </p>

                    {/* Collapsible Changes List */}
                    {isExpanded && (
                      <div 
                        className="my-2.5 pl-3 border-l-2 border-[#5A8A88] space-y-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {hasChanges ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {changesList.map((ch, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 bg-[#F0F5F4] border border-[#D4E4E3] rounded-lg text-[11px]">
                                <span className="font-medium text-[#2D4A49] truncate max-w-[140px]">
                                  {ch.ingredientName}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[#A8BCBB] line-through text-[10px]">({ch.oldVal})</span>
                                  <span className="text-[#6B8F8E]">➜</span>
                                  <span className="bg-[#E8F3F2] text-[#5A8A88] px-1.5 py-0.5 rounded font-bold text-[10px] border border-[#D4E4E3]">
                                    {ch.newVal} {ch.unit}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-2 bg-[#F0F5F4] border border-[#D4E4E3] rounded-lg text-[11px] text-[#6B8F8E]">
                            บันทึกรายงานสต็อกเรียบร้อยแล้ว
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <User size={11} className="text-[#A8BCBB]" />
                        <span className="text-[11px] font-medium text-[#5A8A88]">
                          {log.userEmail}
                        </span>
                        <span className="text-[9px] font-semibold text-[#5A8A88] bg-[#E8F3F2] border border-[#D4E4E3] rounded px-1.5 py-0.5 tracking-[0.05em] uppercase">
                          {log.userRole || 'USER'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[10px] font-medium text-[#5A8A88]">
                        <span>{isExpanded ? 'ย่อข้อมูล' : 'ดูรายละเอียด'}</span>
                        <ChevronDown size={12} className={cn("transition-transform duration-200", isExpanded && "rotate-180")} />
                      </div>
                    </div>
                  </div>

                  {/* RIGHT — Timestamp */}
                  <span className="text-[10px] font-normal text-[#A8BCBB] whitespace-nowrap shrink-0 ml-3 self-start mt-0.5">
                    {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                  </span>
                </div>
              );
            })
          )
        )}

        {/* TAB 3: ประวัติ Check-in & Check-out */}
        {activeTab === 'checklist' && (
          filteredChecklist.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#6B8F8E]">
              <FileText size={40} strokeWidth={1.5} className="mb-2.5 opacity-30 text-[#22C55E]" />
              <p className="text-[12px]">ไม่พบประวัติ Check-in & Check-out</p>
            </div>
          ) : (
            filteredChecklist.map((record, idx) => (
              <button 
                key={record.id || idx}
                type="button"
                onClick={() => setSelectedRecord(record)}
                className="w-full flex items-start gap-3 py-3.5 border-b border-[#F0F5F4] last:border-0 hover:bg-[#FAFCFC] rounded-lg hover:px-2 transition-all text-left cursor-pointer group"
              >
                {/* LEFT — Icon circle (ประวัติ Check-in & Check-out: bg #DCFCE7, icon #22C55E) */}
                <div className="w-8 h-8 rounded-full bg-[#DCFCE7] flex items-center justify-center shrink-0 mt-0.5">
                  <Clock size={14} className="text-[#22C55E]" />
                </div>

                {/* MIDDLE — Content block */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[12px] font-semibold text-[#2D4A49]">
                      รายการตรวจสอบบาร์ ({record.type})
                    </span>
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase",
                      record.type === 'Check-in'
                        ? "bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]"
                        : "bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]"
                    )}>
                      {record.type}
                    </span>
                  </div>

                  <p className="text-[11px] font-normal text-[#6B8F8E] leading-[1.4] mb-1.5 truncate">
                    {record.reporterName ? `ผู้ทำรายงาน: ${record.reporterName}` : `ผู้ส่งบันทึก: ${record.userEmail || 'ไม่ทราบชื่อ'}`}
                    {record.reportDate ? ` · วันที่ตรวจ: ${format(new Date(record.reportDate), 'dd/MM/yyyy')}` : ''}
                  </p>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <User size={11} className="text-[#A8BCBB]" />
                      <span className="text-[11px] font-medium text-[#5A8A88]">
                        {record.reporterName || record.userEmail || 'Staff'}
                      </span>
                      <span className="text-[9px] font-semibold text-[#5A8A88] bg-[#E8F3F2] border border-[#D4E4E3] rounded px-1.5 py-0.5 tracking-[0.05em] uppercase">
                        BAR
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-[#5A8A88] font-medium group-hover:underline">
                      <span>เปิดดูรายงาน</span>
                      <ChevronRight size={12} />
                    </div>
                  </div>
                </div>

                {/* RIGHT — Timestamp */}
                <span className="text-[10px] font-normal text-[#A8BCBB] whitespace-nowrap shrink-0 ml-3 self-start mt-0.5">
                  {format(new Date(record.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                </span>
              </button>
            ))
          )
        )}

        {/* TAB 4: ประวัติการรับวัตถุดิบ */}
        {activeTab === 'receiving' && (
          filteredReceiving.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#6B8F8E]">
              <Package size={40} strokeWidth={1.5} className="mb-2.5 opacity-30 text-[#7C3AED]" />
              <p className="text-[12px]">ไม่พบประวัติการรับวัตถุดิบ</p>
            </div>
          ) : (
            filteredReceiving.map((record) => (
              <div 
                key={record.id} 
                className="flex items-start gap-3 py-3.5 border-b border-[#F0F5F4] last:border-0 hover:bg-[#FAFCFC] rounded-lg hover:px-2 transition-all"
              >
                {/* LEFT — Icon circle (ประวัติการรับวัตถุดิบ: bg #EDE9FE, icon #7C3AED) */}
                <div className="w-8 h-8 rounded-full bg-[#EDE9FE] flex items-center justify-center shrink-0 mt-0.5">
                  <Clock size={14} className="text-[#7C3AED]" />
                </div>

                {/* MIDDLE — Content block */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[12px] font-semibold text-[#2D4A49]">
                      {getIngredientName(record.ingredientId)}
                    </span>
                    <span className="text-[11px] font-bold text-[#5A8A88] bg-[#E8F3F2] border border-[#D4E4E3] rounded px-1.5 py-0.5">
                      {record.quantity} {getIngredientUnit(record.ingredientId)}
                    </span>
                  </div>

                  <p className="text-[11px] font-normal text-[#6B8F8E] leading-[1.4] mb-1.5">
                    ผู้จัดจำหน่าย: <span className="text-[#2D4A49] font-medium">{record.supplier}</span>
                    {record.expiryDate ? (
                      <> · วันหมดอายุ: <span className="text-[#2D4A49]">{format(new Date(record.expiryDate), 'dd/MM/yyyy')}</span></>
                    ) : null}
                  </p>

                  <div className="flex items-center gap-2 flex-wrap">
                    <User size={11} className="text-[#A8BCBB]" />
                    <span className="text-[11px] font-medium text-[#5A8A88]">
                      {record.userName || '-'}
                    </span>
                    <span className="text-[9px] font-semibold text-[#5A8A88] bg-[#E8F3F2] border border-[#D4E4E3] rounded px-1.5 py-0.5 tracking-[0.05em] uppercase">
                      RECEIVING
                    </span>
                  </div>
                </div>

                {/* RIGHT — Timestamp & Delete Action */}
                <div className="flex items-center gap-2 shrink-0 ml-3 self-start mt-0.5">
                  <span className="text-[10px] font-normal text-[#A8BCBB] whitespace-nowrap">
                    {format(new Date(record.date), 'dd/MM/yyyy')}
                  </span>
                  {!isReadOnly && onDeleteReceivingRecord && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('คุณแน่ใจหรือไม่ที่จะลบรายการรับวัตถุดิบนี้?')) {
                          onDeleteReceivingRecord(record.id);
                        }
                      }}
                      className="p-1 text-[#A8BCBB] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded transition-colors cursor-pointer"
                      title="ลบรายการ"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
