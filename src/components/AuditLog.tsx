import React from 'react';
import { LogEntry, Ingredient, ReceivingRecord } from '../types';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { History, User, Clock, FileText, Search, ClipboardList, ChevronLeft, ChevronRight, CheckCircle2, Circle, Coffee, Calendar, Sparkles, Package, Printer, ChevronDown, FileDown, Trash2 } from 'lucide-react';

interface AuditLogProps {
  logs: LogEntry[];
  checklistRecords: any[];
  receivingRecords?: ReceivingRecord[];
  ingredients?: Ingredient[];
  initialTab?: 'logs' | 'checklist' | 'receiving' | 'stockSubmit';
  onDeleteReceivingRecord?: (id: string) => void;
  isReadOnly?: boolean;
}

export function AuditLog({ logs, checklistRecords, receivingRecords = [], ingredients = [], initialTab = 'logs', onDeleteReceivingRecord, isReadOnly = false }: AuditLogProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'logs' | 'checklist' | 'receiving' | 'stockSubmit'>(initialTab);
  const [expandedLogIds, setExpandedLogIds] = React.useState<Record<string, boolean>>({});
  const [selectedRecord, setSelectedRecord] = React.useState<any | null>(null);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = React.useState(false);

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

      const dateStr = format(new Date(selectedRecord.reportDate || selectedRecord.timestamp), 'yyyyMMdd');
      pdf.save(`Audit_${selectedRecord.type}_${dateStr}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF โปรดลองอีกครั้ง');
    }
  };

  const stockSubmitLogs = logs.filter(log => log.action.includes('ส่งรายงานตรวจนับสต็อก'));

  const filteredLogs = logs.filter(log => 
    !log.action.includes('ส่งรายงานตรวจนับสต็อก') && (
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const filteredStockSubmit = stockSubmitLogs.filter(log =>
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.userEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredChecklist = checklistRecords.filter(record => 
    record.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.timestamp.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const filteredReceiving = receivingRecords.filter(record => {
    const ingName = getIngredientName(record.ingredientId);
    return ingName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           record.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (record.userName && record.userName.toLowerCase().includes(searchTerm.toLowerCase()));
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (selectedRecord) {
    return (
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col h-full max-h-[calc(100vh-200px)] animate-in fade-in zoom-in-95 duration-300" id="audit-report">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedRecord(null)}
              className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 hover:text-slate-600 border border-transparent hover:border-slate-200"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  selectedRecord.type === 'Check-in' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {selectedRecord.type}
                </span>
                <h2 className="text-xl font-bold text-slate-800">รายละเอียดรายงานตรวจสอบ</h2>
              </div>
              <div className="flex items-center gap-4 mt-1">
                <p className="text-slate-500 text-sm flex items-center gap-1">
                  <Clock size={14} />
                  บันทึกเมื่อ {format(new Date(selectedRecord.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                </p>
                {selectedRecord.reportDate && (
                  <p className="text-blue-600 text-sm font-bold flex items-center gap-1">
                    <Calendar size={14} />
                    วันที่รายงาน: {format(new Date(selectedRecord.reportDate), 'dd/MM/yyyy')}
                  </p>
                )}
              </div>
            </div>
          </div>
            <div className="flex flex-col items-end gap-2 text-right">
              <div className="relative print:hidden z-20">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExportDropdownOpen(!isExportDropdownOpen);
                  }}
                  className="flex items-center gap-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                >
                  <Printer size={14} />
                  Export / Print
                  <ChevronDown size={14} className={cn("transition-transform", isExportDropdownOpen && "rotate-180")} />
                </button>

                {isExportDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200 text-left">
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
              <div className="text-right">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">ผู้ทำรายงาน / ผู้ส่งบันทึก</div>
                <div className="text-sm font-bold text-slate-700">
                  {selectedRecord.reporterName || selectedRecord.userEmail || 'ไม่ทราบชื่อ'}
                </div>
                {selectedRecord.reporterName && selectedRecord.userEmail && (
                  <div className="text-[10px] text-slate-400 font-medium">(ส่งโดย: {selectedRecord.userEmail})</div>
                )}
              </div>
            </div>
        </div>

        <div className="overflow-auto flex-1 p-6 space-y-8">
          {/* Special Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedRecord.cashInDrawer && (
              <div className="bg-green-50 border border-green-100 p-4 rounded-2xl">
                <div className="text-[10px] font-bold text-green-600 uppercase mb-1">เงินสดเริ่มต้น</div>
                <div className="text-2xl font-black text-green-800">{selectedRecord.cashInDrawer} <span className="text-sm font-bold">บาท</span></div>
              </div>
            )}
            {selectedRecord.salesSummary && (
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl col-span-full grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-[10px] font-bold text-blue-600 uppercase mb-1">ยอดขายทั้งหมด</div>
                  <div className="text-xl font-black text-blue-800">{selectedRecord.salesSummary.total}</div>
                </div>
                {selectedRecord.salesSummary.totalCashInDrawer && (
                  <div>
                    <div className="text-[10px] font-bold text-blue-600 uppercase mb-1">เงินสดในลิ้นชักทั้งหมด</div>
                    <div className="text-xl font-black text-blue-800">{selectedRecord.salesSummary.totalCashInDrawer}</div>
                  </div>
                )}
                <div>
                  <div className="text-[10px] font-bold text-blue-600 uppercase mb-1">เงินสด (Cash)</div>
                  <div className="text-xl font-black text-blue-800">{selectedRecord.salesSummary.cash}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-blue-600 uppercase mb-1">เงินโอน (Transfer)</div>
                  <div className="text-xl font-black text-blue-800">{selectedRecord.salesSummary.transfer}</div>
                </div>
                {selectedRecord.salesSummary.notes && (
                  <div className="col-span-full pt-2 border-t border-blue-100 mt-2">
                    <div className="text-[10px] font-bold text-blue-400 uppercase mb-1">หมายเหตุ</div>
                    <div className="text-sm text-blue-700">{selectedRecord.salesSummary.notes}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Machine Status */}
          {selectedRecord.machineStatus && (selectedRecord.machineStatus.steamBoiler || selectedRecord.machineStatus.pumpPressure || selectedRecord.machineStatus.temp) && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Coffee size={14} />
                ตรวจความพร้อมเครื่องชง
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Steam Boiler</div>
                  <div className="text-lg font-black text-slate-700">{selectedRecord.machineStatus.steamBoiler || '-'} <span className="text-[10px] font-bold">bar</span></div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Pump Pressure</div>
                  <div className="text-lg font-black text-slate-700">{selectedRecord.machineStatus.pumpPressure || '-'} <span className="text-[10px] font-bold">bar</span></div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">อุณหภูมิ</div>
                  <div className="text-lg font-black text-slate-700">{selectedRecord.machineStatus.temp || '-'} <span className="text-[10px] font-bold">°C</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Water Quality & Fridge Temp */}
          {(selectedRecord.waterQuality || selectedRecord.fridgeStatus) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {selectedRecord.waterQuality && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles size={14} />
                    ค่าน้ำ
                  </h3>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                    <div className="text-lg font-black text-slate-700">{selectedRecord.waterQuality} <span className="text-[10px] font-bold">ppm</span></div>
                  </div>
                </div>
              )}
              {selectedRecord.fridgeStatus && (
                <div className="space-y-3 col-span-1 sm:col-span-2">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Package size={14} />
                    การตรวจเช็คอุณหภูมิตู้แช่
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">ตู้แช่เย็น</div>
                      <div className="flex justify-between items-center">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                          selectedRecord.fridgeStatus.chillerStatus === 'ปกติ' ? 'bg-green-100 text-green-700' :
                          selectedRecord.fridgeStatus.chillerStatus === 'ไม่ปกติ' ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-200 text-slate-600'
                        }`}>
                          {selectedRecord.fridgeStatus.chillerStatus || '-'}
                        </span>
                        <div className="text-lg font-black text-slate-700">
                          {selectedRecord.fridgeStatus.chillerTemp || '-'} <span className="text-[10px] font-bold">°C</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">ตู้แช่แข็ง</div>
                      <div className="flex justify-between items-center">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                          selectedRecord.fridgeStatus.freezerStatus === 'ปกติ' ? 'bg-green-100 text-green-700' :
                          selectedRecord.fridgeStatus.freezerStatus === 'ไม่ปกติ' ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-200 text-slate-600'
                        }`}>
                          {selectedRecord.fridgeStatus.freezerStatus || '-'}
                        </span>
                        <div className="text-lg font-black text-slate-700">
                          {selectedRecord.fridgeStatus.freezerTemp || '-'} <span className="text-[10px] font-bold">°C</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Coffee Weights */}
          {selectedRecord.coffeeWeights && Object.keys(selectedRecord.coffeeWeights).length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Coffee size={14} />
                น้ำหนักเมล็ดกาแฟ
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(selectedRecord.coffeeWeights).map(([id, weight]: [string, any]) => {
                  const ing = ingredients.find(i => i.id === id);
                  return (
                    <div key={id} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1 truncate">
                        {ing ? ing.name : `ID: ${id}`}
                      </div>
                      <div className="text-lg font-black text-slate-700">{weight} <span className="text-[10px] font-bold">กรัม</span></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Coffee Dial-in */}
          {selectedRecord.coffeeDialIn && Object.keys(selectedRecord.coffeeDialIn).length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={14} className="text-blue-500" />
                การตั้งค่ารสชาติ (Dial-in Coffee)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(selectedRecord.coffeeDialIn).map(([id, dial]: [string, any]) => {
                  const ing = ingredients.find(i => i.id === id);
                  return (
                    <div key={id} className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex flex-col gap-3">
                      <div className="flex items-center gap-2 border-b border-blue-100/50 pb-2">
                        <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                          <Coffee size={14} />
                        </div>
                        <span className="text-sm font-bold text-blue-900 truncate">
                          {ing ? ing.name : `ID: ${id}`}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-[10px] font-bold text-blue-400 uppercase mb-1">Dose</div>
                          <div className="text-lg font-black text-blue-800">{dial.dose || '-'} <span className="text-[10px] font-bold">g</span></div>
                        </div>
                        <div className="text-center border-x border-blue-100">
                          <div className="text-[10px] font-bold text-blue-400 uppercase mb-1">Yield</div>
                          <div className="text-lg font-black text-blue-800">{dial.yield || '-'} <span className="text-[10px] font-bold">g</span></div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] font-bold text-blue-400 uppercase mb-1">Time</div>
                          <div className="text-lg font-black text-blue-800">{dial.time || '-'} <span className="text-[10px] font-bold">s</span></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cup Counts */}
          {selectedRecord.cupCounts && (selectedRecord.cupCounts['16oz'] || selectedRecord.cupCounts['12oz'] || selectedRecord.cupCounts['8oz']) && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Package size={14} />
                จำนวนแก้วก่อนเปิดร้าน
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {['16oz', '12oz', '8oz'].map((size) => {
                  const count = selectedRecord.cupCounts[size];
                  let display = <div className="text-lg font-black text-slate-700">0 <span className="text-[10px] font-bold">ใบ</span></div>;
                  
                  if (count) {
                    if (typeof count === 'string') {
                      display = <div className="text-lg font-black text-slate-700">{count} <span className="text-[10px] font-bold">ใบ</span></div>;
                    } else {
                      const sleeves = parseInt(count.sleeves || '0');
                      const loose = parseInt(count.loose || '0');
                      const total = (sleeves * 50) + loose;
                      
                      display = (
                        <div className="flex flex-col items-center">
                          <div className="text-lg font-black text-slate-700 leading-tight">
                            {sleeves > 0 && <span>{sleeves} <span className="text-[10px] font-bold mr-1">แถว</span></span>}
                            {loose > 0 && <span>{loose} <span className="text-[10px] font-bold">ใบ</span></span>}
                            {sleeves === 0 && loose === 0 && <span>0 <span className="text-[10px] font-bold">ใบ</span></span>}
                          </div>
                          {(sleeves > 0 || loose > 0) && <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full mt-1">รวม {total} ใบ</div>}
                        </div>
                      );
                    }
                  }

                  return (
                    <div key={size} className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center flex flex-col justify-center">
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">แก้ว {size.replace('oz', ' Oz.')}</div>
                      {display}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cup Usage */}
          {selectedRecord.cupUsage && (selectedRecord.cupUsage['16oz'] || selectedRecord.cupUsage['12oz'] || selectedRecord.cupUsage['8oz']) && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Package size={14} />
                สรุปการใช้งานแก้วประจำวัน
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {['16oz', '12oz', '8oz'].map((size) => {
                  const usage = selectedRecord.cupUsage[size];
                  if (!usage) return null;
                  
                  const added = parseInt(usage.added || '0');
                  const remainingSleeves = parseInt(usage.remainingSleeves || '0');
                  const remainingLoose = parseInt(usage.remainingLoose || '0');
                  const remainingTotal = (remainingSleeves * 50) + remainingLoose;

                  // Find Check-in record for the same day to get brought forward
                  const checkInRecord = checklistRecords.find(r => r.type === 'Check-in' && r.reportDate === selectedRecord.reportDate);
                  let broughtForward = 0;
                  if (checkInRecord && checkInRecord.cupCounts && checkInRecord.cupCounts[size]) {
                    const count = checkInRecord.cupCounts[size];
                    if (typeof count === 'string') {
                      broughtForward = parseInt(count) || 0;
                    } else {
                      broughtForward = ((parseInt(count.sleeves) || 0) * 50) + (parseInt(count.loose) || 0);
                    }
                  }

                  const actualUsage = broughtForward + added - remainingTotal;

                  return (
                    <div key={size} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col gap-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-200 pb-1">แก้ว {size.replace('oz', ' Oz.')}</div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">ยอดยกมา</span>
                        <span className="text-sm font-bold text-slate-700">{broughtForward} ใบ</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">เบิกเพิ่ม</span>
                        <span className="text-sm font-bold text-slate-700">{added} ใบ</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">คงเหลือ</span>
                        <span className="text-sm font-bold text-slate-700">{remainingTotal} ใบ</span>
                      </div>
                      <div className="text-[10px] text-slate-400 text-right">
                        ({remainingSleeves} แถว {remainingLoose} ใบ)
                      </div>
                      <div className="mt-1 pt-2 border-t border-slate-200 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-500">ยอดใช้งานจริง</span>
                        <span className={`text-sm font-black ${actualUsage < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                          {actualUsage} ใบ
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Checklist Items */}
          <div className="space-y-6">
            {selectedRecord.categories?.map((cat: any, idx: number) => (
              <div key={idx} className="space-y-3">
                <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-2">{cat.title}</h3>
                <div className="grid gap-2">
                  {cat.items.map((item: any, iidx: number) => (
                    <div key={iidx} className={`flex items-center gap-3 p-3 rounded-xl border ${
                      item.checked ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100 opacity-50'
                    }`}>
                      {item.checked ? <CheckCircle2 size={16} className="text-blue-600" /> : <Circle size={16} className="text-slate-300" />}
                      <span className={`text-sm ${item.checked ? 'text-blue-900 font-medium' : 'text-slate-500'}`}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col h-full max-h-[calc(100vh-200px)]">
      <div className="p-6 border-bottom border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
              <History size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">ประวัติย้อนหลัง</h2>
              <p className="text-slate-500 text-sm">แสดงรายการล่าสุดสูงสุด 120 รายการ</p>
            </div>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder={activeTab === 'logs' ? "ค้นหาประวัติการแก้ไข..." : activeTab === 'receiving' ? "ค้นหาประวัติการรับวัตถุดิบ..." : activeTab === 'stockSubmit' ? "ค้นหาประวัติส่งนับสต็อก..." : "ค้นหาประวัติ Check-in/out..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
        </div>

        <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit overflow-x-auto">
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-xl text-sm font-bold min-w-max transition-all ${
              activeTab === 'logs' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            ประวัติการแก้ไขข้อมูล
          </button>
          <button
            onClick={() => setActiveTab('stockSubmit')}
            className={`px-4 py-2 rounded-xl text-sm font-bold min-w-max transition-all ${
              activeTab === 'stockSubmit' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            ประวัติส่งนับสต็อก
          </button>
          <button
            onClick={() => setActiveTab('checklist')}
            className={`px-4 py-2 rounded-xl text-sm font-bold min-w-max transition-all ${
              activeTab === 'checklist' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            ประวัติ Check-in & Check-out
          </button>
          <button
            onClick={() => setActiveTab('receiving')}
            className={`px-4 py-2 rounded-xl text-sm font-bold min-w-max transition-all ${
              activeTab === 'receiving' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            ประวัติการรับวัตถุดิบ
          </button>
        </div>
      </div>

      <div className="overflow-auto flex-1">
        {activeTab === 'logs' ? (
          filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <History size={48} strokeWidth={1} className="mb-4 opacity-20" />
              <p>ไม่พบประวัติการแก้ไข</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 p-2 bg-slate-100 text-slate-500 rounded-lg shrink-0">
                      <Clock size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-slate-800 text-sm">{log.action}</span>
                        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                          {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                        </span>
                      </div>
                      {log.action === 'System Backup' ? (
                        <p className="text-slate-600 text-sm mb-2 leading-relaxed italic">
                          [ข้อมูลสำรองระบบอัตโนมัติซ่อนอยู่เพื่อความสวยงาม]
                        </p>
                      ) : (
                        <p className="text-slate-600 text-sm mb-2 leading-relaxed">{log.details}</p>
                      )}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <User size={12} />
                          <span className="font-medium text-slate-500">{log.userEmail}</span>
                          <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] uppercase tracking-wider">
                            {log.userRole}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : activeTab === 'stockSubmit' ? (
          filteredStockSubmit.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <ClipboardList size={48} strokeWidth={1} className="mb-4 opacity-20" />
              <p>ไม่พบประวัติการส่งรายงานตรวจนับสต็อก</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredStockSubmit.map((log) => {
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
                } catch(e) {}

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
                      "p-4 transition-all duration-200 border-b border-slate-100 cursor-pointer hover:bg-slate-50/60 active:bg-blue-50/30",
                      isExpanded && "bg-blue-50/20"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "mt-1 p-2 rounded-xl shrink-0 transition-colors",
                        isExpanded ? "bg-blue-100 text-blue-600" : "bg-slate-50 text-slate-400"
                      )}>
                        <ClipboardList size={18} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                            <span className="font-bold text-slate-800 text-sm md:text-base leading-tight">{log.action}</span>
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-semibold border border-blue-100">
                              {hasChanges ? `มีรายการเปลี่ยนแปลง (${changesList.length})` : 'ระบบบันทึกแบบย่อ'}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400 font-medium whitespace-nowrap pt-0.5 shrink-0">
                            {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                          </span>
                        </div>
                        
                        <p className={cn(
                          "text-slate-600 text-sm leading-relaxed",
                          isExpanded ? "font-medium" : "text-slate-500"
                        )}>
                          {summaryText}
                        </p>

                        {/* Collapsible Details Content */}
                        {isExpanded && (
                          <div 
                            className="mt-3 pl-4 border-l-2 border-blue-200 space-y-2 pb-1 animate-fadeIn"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {hasChanges ? (
                              <>
                                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                  รายการวัตถุดิบที่มีการเปลี่ยนแปลง
                                </span>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {changesList.map((ch, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-xl shadow-xs text-slate-700 text-xs md:text-sm">
                                      <span className="font-semibold text-slate-800 truncate max-w-[130px] md:max-w-xs">{ch.ingredientName}</span>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-slate-400 text-[10px] line-through opacity-75 sm:inline hidden">({ch.oldVal})</span>
                                        <span className="text-slate-300 text-xs sm:inline hidden">➜</span>
                                        <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded-md font-bold text-xs">
                                          {ch.newVal} {ch.unit}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </>
                            ) : (
                              <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl text-xs md:text-sm text-slate-600 font-medium leading-relaxed">
                                ⚠️ เนื่องจากรายงานฉบับนี้ถูกส่งก่อนการอัปเดตระบบฐานข้อมูล Supabase เวอร์ชันล่าสุด ระบบจึงบันทึกเฉพาะหัวข้อแบบย่อ และไม่ได้เก็บบันทึกรายละเอียดของความต่างรายชิ้นเค้กหรือวัตถุดิบไว้
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-4 mt-3 pt-3 border-t border-slate-100/60">
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <User size={12} />
                            <span className="font-medium text-slate-500">{log.userEmail}</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] uppercase tracking-wider">
                              {log.userRole}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1 text-xs font-bold text-blue-600">
                            <span>{isExpanded ? "ย่อข้อมูล" : "ขยายข้อมูล"}</span>
                            <ChevronDown size={14} className={cn("transition-transform duration-200", isExpanded && "rotate-180")} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )})}
            </div>
          )
        ) : activeTab === 'checklist' ? (
          filteredChecklist.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <ClipboardList size={48} strokeWidth={1} className="mb-4 opacity-20" />
              <p>ไม่พบประวัติ Check-in & Check-out</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredChecklist.map((record, idx) => (
                <button 
                  key={idx} 
                  onClick={() => setSelectedRecord(record)}
                  className="w-full p-4 hover:bg-slate-50 transition-colors text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className={`mt-1 p-2 rounded-lg shrink-0 ${
                      record.type === 'Check-in' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                    }`}>
                      <FileText size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            record.type === 'Check-in' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {record.type}
                          </span>
                          <span className="font-bold text-slate-800 text-sm">รายการตรวจสอบบาร์ประจำวัน</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 font-medium">
                            {format(new Date(record.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                          </span>
                          <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <User size={12} />
                          <span className="text-slate-500">
                            {record.reporterName ? (
                              <>ผู้ทำรายงาน: <span className="font-bold text-slate-700">{record.reporterName}</span></>
                            ) : (
                              <>ผู้ส่งบันทึก: <span className="font-bold">{record.userEmail || 'ไม่ทราบชื่อ'}</span></>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Clock size={12} />
                          <span className="text-slate-500">เวลา: <span className="font-bold">{format(new Date(record.timestamp), 'HH:mm')} น.</span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-[12px] text-slate-600">
                  <th className="p-3 font-semibold">วันที่รับ</th>
                  <th className="p-3 font-semibold">รายการวัตถุดิบ</th>
                  <th className="p-3 font-semibold">ผู้จัดจำหน่าย</th>
                  <th className="p-3 font-semibold text-right">จำนวน</th>
                  <th className="p-3 font-semibold">วันหมดอายุ</th>
                  <th className="p-3 font-semibold text-center">ผู้ทำรายการ</th>
                  <th className="p-3 font-semibold text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceiving.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 text-[13px]">
                      ยังไม่มีประวัติการรับวัตถุดิบ
                    </td>
                  </tr>
                ) : (
                  filteredReceiving.map(record => (
                    <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-[13px]">
                      <td className="p-3 text-slate-800">{format(new Date(record.date), 'dd/MM/yyyy')}</td>
                      <td className="p-3 font-medium text-slate-800">{getIngredientName(record.ingredientId)}</td>
                      <td className="p-3 text-slate-600">{record.supplier}</td>
                      <td className="p-3 text-right font-mono text-blue-600 font-medium">
                        {record.quantity} <span className="text-slate-500 text-[11px]">{getIngredientUnit(record.ingredientId)}</span>
                      </td>
                      <td className="p-3 text-slate-600">{record.expiryDate ? format(new Date(record.expiryDate), 'dd/MM/yyyy') : '-'}</td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-1 bg-slate-100 text-slate-600 text-[11px] font-medium rounded-full border border-slate-200">
                          {record.userName || '-'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {!isReadOnly && (
                          <button
                            onClick={() => {
                              if (window.confirm('คุณแน่ใจหรือไม่ที่จะลบรายการรับวัตถุดิบนี้?')) {
                                onDeleteReceivingRecord?.(record.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="ลบรายการ"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
