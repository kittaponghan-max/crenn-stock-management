import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Crosshair,
  Radio,
  Shield,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  ArrowRight,
} from 'lucide-react';
import { BranchGeofenceConfig } from '../../types/hellocrenn';
import { PageHeaderBanner, SaveButton, useSaveState } from '../ui';

interface GeofenceSettingsProps {
  config: BranchGeofenceConfig;
  canEdit: boolean;
  onSaveConfig: (nextConfig: BranchGeofenceConfig) => Promise<void>;
  onOpenShiftSettings?: () => void;
}

export const GeofenceSettings: React.FC<GeofenceSettingsProps> = ({
  config,
  canEdit,
  onSaveConfig,
  onOpenShiftSettings,
}) => {
  const [draft, setDraft] = useState<BranchGeofenceConfig>(config);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);

  const { isDirty, setIsDirty, isSaving, justSaved, markDirty, runSave } = useSaveState({
    enableUnloadGuard: canEdit,
  });

  useEffect(() => {
    setDraft(config);
    setIsDirty(false);
  }, [config, setIsDirty]);

  const updateField = <K extends keyof BranchGeofenceConfig>(
    key: K,
    value: BranchGeofenceConfig[K]
  ) => {
    if (!canEdit) return;
    setDraft((prev) => ({ ...prev, [key]: value }));
    markDirty();
  };

  const handleUseCurrentGps = () => {
    if (!canEdit) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationNotice('เบราว์เซอร์นี้ไม่รองรับการดึงพิกัด GPS');
      return;
    }
    setIsLocating(true);
    setLocationNotice(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDraft((prev) => ({
          ...prev,
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          isConfigured: true,
        }));
        markDirty();
        setIsLocating(false);
        setLocationNotice(
          `ดึงพิกัดปัจจุบันสำเร็จ (ความคลาดเคลื่อน ±${Math.round(pos.coords.accuracy)} ม.) กดบันทึกข้อมูลเพื่อใช้งาน`
        );
      },
      (err) => {
        setIsLocating(false);
        setLocationNotice(`ไม่สามารถดึงพิกัดได้: ${err.message || 'กรุณาเปิดสิทธิ์ Location'}`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleSave = async () => {
    if (!canEdit || !isDirty) return;
    await runSave(async () => {
      await onSaveConfig({
        ...config,
        ...draft,
        isConfigured: true,
        updatedAt: new Date().toISOString(),
      });
    });
  };

  return (
    <div className="space-y-4">
      <PageHeaderBanner
        variant="sub"
        icon={<MapPin size={18} />}
        title="ตั้งค่าพิกัดสาขา (Geofence Settings)"
        branchLabel={draft.branchLabel}
        subtitle="กำหนดพิกัด GPS จุดเช็กอินของสาขา รัศมีอนุญาต ความแม่นยำสัญญาณ และเงื่อนไขการลงเวลาอัตโนมัติ (Auto GPS)"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {onOpenShiftSettings && (
              <button
                type="button"
                onClick={onOpenShiftSettings}
                className="h-[32px] px-3 rounded-[8px] bg-white hover:bg-[#F0F5F4] border border-[#D4E4E3] text-[#2D4A49] text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <CalendarClock size={13} className="text-[#5A8A88]" />
                <span>ตั้งค่ากะงาน & โอที</span>
                <ArrowRight size={11} className="text-[#6B8F8E]" />
              </button>
            )}
            {canEdit ? (
              <SaveButton
                isSaving={isSaving}
                isDirty={isDirty}
                justSaved={justSaved}
                onClick={handleSave}
                disabled={!isDirty}
                label="บันทึกพิกัดสาขา"
              />
            ) : (
              <div className="h-[32px] px-3 rounded-[8px] bg-[#F0F5F4] border border-[#D4E4E3] text-[#6B8F8E] text-[11px] font-semibold flex items-center gap-1.5">
                <Shield size={13} />
                <span>โหมดดูอย่างเดียว (เฉพาะ Admin / ผู้จัดการสาขา)</span>
              </div>
            )}
          </div>
        }
      />

      {locationNotice && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#E8F3F2] border border-[#D4E4E3] text-[#2D4A49] text-xs font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-[#5A8A88] shrink-0" />
            <span>{locationNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setLocationNotice(null)}
            className="text-[11px] underline cursor-pointer"
          >
            ปิด
          </button>
        </div>
      )}

      {/* Card 1: GPS Geofence Anchor */}
      <section className="bg-white rounded-2xl border border-[#D4E4E3] p-5 shadow-[0_2px_8px_rgba(90,138,136,0.06)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8F3F2] pb-3">
          <div>
            <h2 className="text-[14px] font-bold text-[#2D4A49]">พิกัด GPS สาขา (Geofence Anchor)</h2>
            <p className="text-[11px] text-[#6B8F8E] mt-0.5">
              ใช้เทียบระยะห่างจากตำแหน่งพนักงานด้วยสูตร Haversine
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={handleUseCurrentGps}
              disabled={isLocating}
              className="h-[32px] px-3 rounded-[8px] bg-[#E8F3F2] hover:bg-[#D8EAE8] border border-[#5A8A88] text-[#2D4A49] text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Crosshair size={13} className={isLocating ? 'animate-spin text-[#5A8A88]' : 'text-[#5A8A88]'} />
              <span>{isLocating ? 'กำลังดึงพิกัด...' : 'ใช้พิกัดปัจจุบันของฉัน'}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
              ละติจูด (Latitude)
            </label>
            <input
              type="number"
              step="0.000001"
              disabled={!canEdit}
              value={draft.latitude}
              onChange={(e) => updateField('latitude', parseFloat(e.target.value) || 0)}
              className="w-full h-[36px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-xs font-mono tabular-nums outline-none focus:border-[#5A8A88] disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
              ลองจิจูด (Longitude)
            </label>
            <input
              type="number"
              step="0.000001"
              disabled={!canEdit}
              value={draft.longitude}
              onChange={(e) => updateField('longitude', parseFloat(e.target.value) || 0)}
              className="w-full h-[36px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-xs font-mono tabular-nums outline-none focus:border-[#5A8A88] disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
              รัศมีอนุญาตให้สแกน (เมตร)
            </label>
            <input
              type="number"
              min={10}
              max={2000}
              step={10}
              disabled={!canEdit}
              value={draft.radiusMeters}
              onChange={(e) => updateField('radiusMeters', Math.max(10, parseInt(e.target.value, 10) || 100))}
              className="w-full h-[36px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-xs font-mono tabular-nums outline-none focus:border-[#5A8A88] disabled:opacity-60"
            />
            <p className="text-[10px] text-[#6B8F8E] mt-1">แนะนำ 50 – 150 เมตรสำหรับคาเฟ่ในเมือง</p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
              ความคลาดเคลื่อน GPS สูงสุดที่ยอมรับ (เมตร)
            </label>
            <input
              type="number"
              min={20}
              max={1000}
              step={10}
              disabled={!canEdit}
              value={draft.maxAccuracyMeters}
              onChange={(e) => updateField('maxAccuracyMeters', Math.max(20, parseInt(e.target.value, 10) || 200))}
              className="w-full h-[36px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-xs font-mono tabular-nums outline-none focus:border-[#5A8A88] disabled:opacity-60"
            />
            <p className="text-[10px] text-[#6B8F8E] mt-1">ป้องกันการสแกนเมื่อสัญญาณ GPS ยังไม่นิ่ง</p>
          </div>
        </div>

        {!draft.isConfigured && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <span>
              พิกัดนี้เป็นค่าเริ่มต้นของระบบ กรุณาเปิดหน้านี้ขณะที่อยู่ที่หน้าร้าน แล้วกด &quot;ใช้พิกัดปัจจุบันของฉัน&quot; เพื่อบันทึกตำแหน่งจริงของสาขา
            </span>
          </div>
        )}
      </section>

      {/* Card 2: Auto GPS Rules */}
      <section className="bg-white rounded-2xl border border-[#D4E4E3] p-5 shadow-[0_2px_8px_rgba(90,138,136,0.06)] space-y-4">
        <div className="flex items-center justify-between border-b border-[#E8F3F2] pb-3">
          <div>
            <h2 className="text-[14px] font-bold text-[#2D4A49]">เงื่อนไขการลงเวลาอัตโนมัติ (Auto GPS Rules)</h2>
            <p className="text-[11px] text-[#6B8F8E] mt-0.5">
              ตั้งค่าการเช็กอิน / เช็กเอาท์อัตโนมัติเมื่ออุปกรณ์ของพนักงานอยู่ในรัศมีที่กำหนด
            </p>
          </div>
          <Radio size={18} className="text-[#5A8A88]" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <label className={`flex items-start gap-2.5 p-3.5 rounded-xl border border-[#D4E4E3] bg-[#F8FCFC] ${canEdit ? 'cursor-pointer hover:bg-[#F0F5F4]' : 'opacity-70'}`}>
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={draft.autoCheckinEnabled}
              onChange={(e) => updateField('autoCheckinEnabled', e.target.checked)}
              className="mt-0.5 rounded w-4 h-4 accent-[#5A8A88]"
            />
            <div>
              <div className="text-xs font-bold text-[#2D4A49]">
                เปิดใช้งาน Auto Check-in ทันทีเมื่อเข้าพื้นที่สาขา
              </div>
              <div className="text-[10.5px] text-[#6B8F8E] mt-0.5 leading-relaxed">
                เมื่อพนักงานเปิดแอป Hello, Crenn และพิกัดอยู่ในรัศมีที่กำหนด ระบบจะลงเวลาเข้างานให้อัตโนมัติ (วันละ 1 ครั้ง)
              </div>
            </div>
          </label>

          <label className={`flex items-start gap-2.5 p-3.5 rounded-xl border border-[#D4E4E3] bg-[#F8FCFC] ${canEdit ? 'cursor-pointer hover:bg-[#F0F5F4]' : 'opacity-70'}`}>
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={draft.autoCheckoutEnabled}
              onChange={(e) => updateField('autoCheckoutEnabled', e.target.checked)}
              className="mt-0.5 rounded w-4 h-4 accent-[#5A8A88]"
            />
            <div>
              <div className="text-xs font-bold text-[#2D4A49]">
                เปิดใช้งาน Auto Check-out หลังถึงเวลาเลิกงาน
              </div>
              <div className="text-[10.5px] text-[#6B8F8E] mt-0.5 leading-relaxed">
                หากพนักงานเปิดหน้าแอปหลังเวลาเลิกงานตามกะของตนเอง และยังอยู่ในพื้นที่สาขา ระบบจะสแกนออกงานให้อัตโนมัติ
              </div>
            </div>
          </label>
        </div>
      </section>
    </div>
  );
};

export default GeofenceSettings;
