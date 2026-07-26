import React, { useState, useEffect } from 'react';
import { ChevronLeft, Calendar as CalendarIcon, History } from 'lucide-react';
import { BakeryPlan } from './BakeryPlan';

export function BakeryPlanHistory({ onBack }: { onBack: () => void }) {
  const [history, setHistory] = useState<any[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('bakeryPlanHistory');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  if (selectedRecord) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedRecord(null)}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <ChevronLeft size={24} className="text-slate-600" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                ประวัติแผนงาน {selectedRecord.weekLabel}
              </h2>
              <p className="text-sm text-slate-500">บันทึกเมื่อ: {new Date(selectedRecord.savedAt).toLocaleString('th-TH')}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 rounded-2xl p-2 border border-slate-200 shadow-sm">
           <BakeryPlan 
             isReadOnly={true} 
             historyData={selectedRecord.data} 
             historyWeek={new Date(selectedRecord.weekKey)} 
           />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors"
        >
          <ChevronLeft size={24} className="text-slate-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <History className="text-amber-500" />
            ประวัติแผนงาน Bakery
          </h2>
          <p className="text-slate-500">ตรวจสอบประวัติแผนงานย้อนหลัง (เก็บสูงสุด 24 สัปดาห์)</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {history.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {history.map((record, index) => (
              <div
                key={record.weekKey || index}
                onClick={() => setSelectedRecord(record)}
                className="p-4 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
                    <CalendarIcon size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">สัปดาห์ที่ {record.weekLabel}</h3>
                    <p className="text-sm text-slate-500">บันทึกเมื่อ: {new Date(record.savedAt).toLocaleString('th-TH')}</p>
                  </div>
                </div>
                <ChevronLeft className="text-slate-300 rotate-180" />
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-slate-500">
            ไม่มีข้อมูลประวัติย้อนหลัง
          </div>
        )}
      </div>
    </div>
  );
}
