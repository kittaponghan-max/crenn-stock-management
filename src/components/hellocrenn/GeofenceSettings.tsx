import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  Crosshair,
  Clock,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Users,
  Search,
  RotateCcw,
  Plus,
  Trash2,
  CopyCheck,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BranchGeofenceConfig, EmployeeShiftConfig } from '../../types/hellocrenn';
import {
  PageHeaderBanner,
  SaveButton,
  useSaveState,
  StandardTableCard,
  StandardTable,
  StandardThead,
  StandardHeaderRow,
  StandardTh,
  StandardTbody,
  StandardTr,
  StandardTd,
  StandardTableEmpty,
} from '../ui';

interface BranchStaffMember {
  id?: string;
  name: string;
  role: string;
  isManual?: boolean;
}

interface GeofenceSettingsProps {
  config: BranchGeofenceConfig;
  canEdit: boolean;
  onSaveConfig: (nextConfig: BranchGeofenceConfig) => Promise<void>;
}

export const GeofenceSettings: React.FC<GeofenceSettingsProps> = ({
  config,
  canEdit,
  onSaveConfig,
}) => {
  const [draft, setDraft] = useState<BranchGeofenceConfig>(config);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [staffMembers, setStaffMembers] = useState<BranchStaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [newStaffName, setNewStaffName] = useState<string>('');
  const [newStaffRole, setNewStaffRole] = useState<string>('Staff');
  const [showAddStaff, setShowAddStaff] = useState<boolean>(false);

  const { isDirty, setIsDirty, isSaving, justSaved, markDirty, runSave } = useSaveState({
    enableUnloadGuard: canEdit,
  });

  useEffect(() => {
    setDraft(config);
    setIsDirty(false);
  }, [config, setIsDirty]);

  // Load branch employees from Supabase app_users + LocalStorage fallback
  useEffect(() => {
    let isMounted = true;
    const branch = config.branch || 'Rayong';

    const loadBranchStaff = async () => {
      setLoadingStaff(true);
      const foundMap = new Map<string, BranchStaffMember>();

      const registerUser = (u: any) => {
        if (!u || !u.name) return;
        const name = String(u.name).trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (!foundMap.has(key)) {
          foundMap.set(key, {
            id: u.id ? String(u.id) : undefined,
            name,
            role: u.role ? String(u.role) : 'Staff',
          });
        }
      };

      // 1. Supabase app_users for this branch
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('app_users')
            .select('id, name, role, branch')
            .eq('branch', branch);
          if (!error && Array.isArray(data)) {
            data.forEach(registerUser);
          }
        } catch (err) {
          console.warn('Hello, Crenn load staff error:', err);
        }
      }

      // 2. LocalStorage fallback
      if (typeof window !== 'undefined') {
        const storageKeys = [`cafe-app-users-${branch}`, 'cafe-app-users', 'app_users'];
        storageKeys.forEach((sk) => {
          try {
            const raw = localStorage.getItem(sk);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed
                .filter((u: any) => !u.branch || u.branch === branch)
                .forEach(registerUser);
            }
          } catch {}
        });
      }

      if (isMounted) {
        setStaffMembers(Array.from(foundMap.values()));
        setLoadingStaff(false);
      }
    };

    loadBranchStaff();
    return () => {
      isMounted = false;
    };
  }, [config.branch]);

  const updateField = <K extends keyof BranchGeofenceConfig>(
    key: K,
    value: BranchGeofenceConfig[K]
  ) => {
    if (!canEdit) return;
    setDraft((prev) => ({ ...prev, [key]: value }));
    markDirty();
  };

  // Combine loaded branch staff + any extra employees already saved in employeeShifts
  const combinedEmployees = useMemo<BranchStaffMember[]>(() => {
    const map = new Map<string, BranchStaffMember>();
    staffMembers.forEach((m) => {
      map.set(m.name.trim().toLowerCase(), m);
    });
    const shiftEntries = Object.values(draft.employeeShifts ?? {}) as EmployeeShiftConfig[];
    shiftEntries.forEach((s) => {
      if (!s || !s.userName) return;
      const key = s.userName.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: s.userId,
          name: s.userName,
          role: s.userRole || 'Staff',
          isManual: true,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [staffMembers, draft.employeeShifts]);

  const filteredEmployees = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return combinedEmployees;
    return combinedEmployees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(q) || emp.role.toLowerCase().includes(q)
    );
  }, [combinedEmployees, searchTerm]);

  const getRowShift = (emp: BranchStaffMember): EmployeeShiftConfig => {
    const shiftEntries = Object.values(draft.employeeShifts ?? {}) as EmployeeShiftConfig[];
    const existing =
      draft.employeeShifts?.[emp.name] ||
      shiftEntries.find(
        (s) => s && s.userName && s.userName.trim().toLowerCase() === emp.name.trim().toLowerCase()
      );
    if (existing) return existing;
    return {
      userId: emp.id,
      userName: emp.name,
      userRole: emp.role,
      shiftStartTime: draft.shiftStartTime,
      shiftEndTime: draft.shiftEndTime,
      graceMinutes: draft.graceMinutes,
      otStepMinutes: draft.otStepMinutes ?? 30,
    };
  };

  const isRowCustomized = (row: EmployeeShiftConfig): boolean => {
    return (
      row.shiftStartTime !== draft.shiftStartTime ||
      row.shiftEndTime !== draft.shiftEndTime ||
      Number(row.graceMinutes) !== Number(draft.graceMinutes) ||
      Number(row.otStepMinutes) !== Number(draft.otStepMinutes ?? 30)
    );
  };

  const updateEmployeeShiftField = <K extends keyof EmployeeShiftConfig>(
    emp: BranchStaffMember,
    field: K,
    value: EmployeeShiftConfig[K]
  ) => {
    if (!canEdit) return;
    setDraft((prev) => {
      const prevMap = { ...(prev.employeeShifts || {}) };
      const existingKey = Object.keys(prevMap).find(
        (k) => k.trim().toLowerCase() === emp.name.trim().toLowerCase()
      );
      const currentEntry: EmployeeShiftConfig =
        (existingKey ? prevMap[existingKey] : undefined) || {
          userId: emp.id,
          userName: emp.name,
          userRole: emp.role,
          shiftStartTime: prev.shiftStartTime,
          shiftEndTime: prev.shiftEndTime,
          graceMinutes: prev.graceMinutes,
          otStepMinutes: prev.otStepMinutes ?? 30,
        };

      prevMap[existingKey || emp.name] = {
        ...currentEntry,
        userId: emp.id ?? currentEntry.userId,
        userRole: emp.role || currentEntry.userRole,
        [field]: value,
      };
      return {
        ...prev,
        employeeShifts: prevMap,
      };
    });
    markDirty();
  };

  const resetEmployeeToBranchDefault = (emp: BranchStaffMember) => {
    if (!canEdit) return;
    setDraft((prev) => {
      const prevMap = { ...(prev.employeeShifts || {}) };
      const existingKey = Object.keys(prevMap).find(
        (k) => k.trim().toLowerCase() === emp.name.trim().toLowerCase()
      );
      if (emp.isManual && existingKey) {
        prevMap[existingKey] = {
          ...prevMap[existingKey],
          shiftStartTime: prev.shiftStartTime,
          shiftEndTime: prev.shiftEndTime,
          graceMinutes: prev.graceMinutes,
          otStepMinutes: prev.otStepMinutes ?? 30,
        };
      } else if (existingKey) {
        delete prevMap[existingKey];
      }
      return {
        ...prev,
        employeeShifts: prevMap,
      };
    });
    markDirty();
  };

  const removeManualEmployee = (emp: BranchStaffMember) => {
    if (!canEdit || !emp.isManual) return;
    setDraft((prev) => {
      const prevMap = { ...(prev.employeeShifts || {}) };
      Object.keys(prevMap).forEach((k) => {
        if (k.trim().toLowerCase() === emp.name.trim().toLowerCase()) {
          delete prevMap[k];
        }
      });
      return {
        ...prev,
        employeeShifts: prevMap,
      };
    });
    markDirty();
  };

  const applyBranchDefaultsToAllEmployees = () => {
    if (!canEdit) return;
    setDraft((prev) => {
      const nextMap: Record<string, EmployeeShiftConfig> = {};
      combinedEmployees.forEach((emp) => {
        nextMap[emp.name] = {
          userId: emp.id,
          userName: emp.name,
          userRole: emp.role,
          shiftStartTime: prev.shiftStartTime,
          shiftEndTime: prev.shiftEndTime,
          graceMinutes: prev.graceMinutes,
          otStepMinutes: prev.otStepMinutes ?? 30,
        };
      });
      return {
        ...prev,
        employeeShifts: nextMap,
      };
    });
    markDirty();
  };

  const handleAddManualEmployee = () => {
    if (!canEdit) return;
    const trimmed = newStaffName.trim();
    if (!trimmed) return;
    const alreadyExists = combinedEmployees.some(
      (e) => e.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (alreadyExists) {
      setLocationNotice(`มีรายชื่อพนักงาน "${trimmed}" อยู่ในรายการแล้ว`);
      return;
    }

    setDraft((prev) => ({
      ...prev,
      employeeShifts: {
        ...(prev.employeeShifts || {}),
        [trimmed]: {
          userName: trimmed,
          userRole: newStaffRole.trim() || 'Staff',
          shiftStartTime: prev.shiftStartTime,
          shiftEndTime: prev.shiftEndTime,
          graceMinutes: prev.graceMinutes,
          otStepMinutes: prev.otStepMinutes ?? 30,
        },
      },
    }));
    setNewStaffName('');
    setNewStaffRole('Staff');
    setShowAddStaff(false);
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
      // Ensure every employee shown has an explicit persisted shift entry if customized,
      // while keeping all manual staff entries intact
      const cleanedMap: Record<string, EmployeeShiftConfig> = {};
      combinedEmployees.forEach((emp) => {
        const row = getRowShift(emp);
        if (emp.isManual || isRowCustomized(row) || draft.employeeShifts?.[emp.name]) {
          cleanedMap[emp.name] = {
            ...row,
            userId: emp.id ?? row.userId,
            userName: emp.name,
            userRole: emp.role || row.userRole,
          };
        }
      });

      await onSaveConfig({
        ...draft,
        employeeShifts: cleanedMap,
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
        title="ตั้งค่าพิกัดสาขาและเวลากะงาน (Geofence & Shift Config)"
        branchLabel={draft.branchLabel}
        subtitle="กำหนดพิกัด GPS จุดเช็กอินของสาขา รัศมีอนุญาต เวลากะงาน เกณฑ์โอทีรายบุคคล และเงื่อนไข Auto Check-in"
        actions={
          canEdit ? (
            <SaveButton
              isSaving={isSaving}
              isDirty={isDirty}
              justSaved={justSaved}
              onClick={handleSave}
              disabled={!isDirty}
              label="บันทึกการตั้งค่า"
            />
          ) : (
            <div className="h-[32px] px-3 rounded-[8px] bg-[#F0F5F4] border border-[#D4E4E3] text-[#6B8F8E] text-[11px] font-semibold flex items-center gap-1.5">
              <Shield size={13} />
              <span>โหมดดูอย่างเดียว (เฉพาะ Admin / ผู้จัดการสาขา)</span>
            </div>
          )
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

      {/* Card 2: Shift Hours, Auto Trigger Rules & Per-Employee Shift/OT Settings */}
      <section className="bg-white rounded-2xl border border-[#D4E4E3] p-5 shadow-[0_2px_8px_rgba(90,138,136,0.06)] space-y-5">
        <div className="flex items-center justify-between border-b border-[#E8F3F2] pb-3">
          <div>
            <h2 className="text-[14px] font-bold text-[#2D4A49]">เวลากะงานและกฎ Auto GPS</h2>
            <p className="text-[11px] text-[#6B8F8E] mt-0.5">
              กำหนดค่ามาตรฐานสาขา เกณฑ์คิดโอที กฎ Auto GPS และปรับเวลาเข้า-ออกงานแยกตามพนักงานรายคนได้
            </p>
          </div>
          <Clock size={18} className="text-[#5A8A88]" />
        </div>

        {/* Branch-wide default shift & OT parameters */}
        <div>
          <p className="text-[11px] font-bold text-[#5A8A88] mb-2">
            ค่าเริ่มต้นมาตรฐานของสาขา (ใช้เป็นค่าหลักสำหรับพนักงานที่ไม่ได้กำหนดแยก)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                เวลาเข้างานมาตรฐาน
              </label>
              <input
                type="time"
                disabled={!canEdit}
                value={draft.shiftStartTime}
                onChange={(e) => updateField('shiftStartTime', e.target.value)}
                className="w-full h-[36px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-xs font-mono tabular-nums outline-none focus:border-[#5A8A88] disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                เวลาเลิกงานมาตรฐาน
              </label>
              <input
                type="time"
                disabled={!canEdit}
                value={draft.shiftEndTime}
                onChange={(e) => updateField('shiftEndTime', e.target.value)}
                className="w-full h-[36px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-xs font-mono tabular-nums outline-none focus:border-[#5A8A88] disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                อนุโลมสายได้ (นาที)
              </label>
              <input
                type="number"
                min={0}
                max={120}
                disabled={!canEdit}
                value={draft.graceMinutes}
                onChange={(e) => updateField('graceMinutes', Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full h-[36px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-xs font-mono tabular-nums outline-none focus:border-[#5A8A88] disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                คิดโอที ทุกๆ กี่นาที
              </label>
              <input
                type="number"
                min={0}
                max={240}
                step={5}
                disabled={!canEdit}
                value={draft.otStepMinutes ?? 30}
                onChange={(e) => updateField('otStepMinutes', Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full h-[36px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-xs font-mono tabular-nums outline-none focus:border-[#5A8A88] disabled:opacity-60"
              />
              <p className="text-[10px] text-[#6B8F8E] mt-1">
                เช่น 30 หรือ 60 นาที (ใส่ 0 = ไม่คิดโอที)
              </p>
            </div>
          </div>
        </div>

        {/* Auto Check-in / Check-out Checkboxes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 pt-3 border-t border-[#E8F3F2]">
          <label className={`flex items-start gap-2.5 p-3 rounded-xl border border-[#D4E4E3] bg-[#F8FCFC] ${canEdit ? 'cursor-pointer hover:bg-[#F0F5F4]' : 'opacity-70'}`}>
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
              <div className="text-[10.5px] text-[#6B8F8E] mt-0.5">
                เมื่อพนักงานเปิดแอป Hello, Crenn และพิกัดอยู่ในรัศมีที่กำหนด ระบบจะลงเวลาเข้างานให้อัตโนมัติ (วันละ 1 ครั้ง)
              </div>
            </div>
          </label>

          <label className={`flex items-start gap-2.5 p-3 rounded-xl border border-[#D4E4E3] bg-[#F8FCFC] ${canEdit ? 'cursor-pointer hover:bg-[#F0F5F4]' : 'opacity-70'}`}>
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
              <div className="text-[10.5px] text-[#6B8F8E] mt-0.5">
                หากพนักงานเปิดหน้าแอปหลังเวลาเลิกงานของตนเอง และยังอยู่ในพื้นที่สาขา ระบบจะสแกนออกงานให้อัตโนมัติ
              </div>
            </div>
          </label>
        </div>

        {/* Per-Employee Individual Shift & OT Configuration Table */}
        <div className="pt-4 border-t border-[#E8F3F2] space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
            <div>
              <h3 className="text-[13px] font-bold text-[#2D4A49] flex items-center gap-1.5">
                <Users size={15} className="text-[#5A8A88]" />
                <span>กำหนดเวลากะงานและเกณฑ์โอทีรายบุคคล ({combinedEmployees.length} คน)</span>
              </h3>
              <p className="text-[11px] text-[#6B8F8E] mt-0.5">
                กำหนดเวลาเข้า-ออกงาน, อนุโลมสาย และรอบคิดโอทีของพนักงานแต่ละคนใน {draft.branchLabel}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[180px]">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B8F8E] pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ค้นหาชื่อพนักงาน / ตำแหน่ง..."
                  className="w-full h-[32px] pl-8 pr-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-[11px] outline-none focus:border-[#5A8A88]"
                />
              </div>

              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={applyBranchDefaultsToAllEmployees}
                    className="h-[32px] px-2.5 rounded-[8px] bg-white hover:bg-[#F0F5F4] border border-[#D4E4E3] text-[#2D4A49] text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    title="นำเวลาเข้า-ออก อนุโลมสาย และค่าโอทีมาตรฐานสาขาไปใช้กับพนักงานทุกคน"
                  >
                    <CopyCheck size={13} className="text-[#5A8A88]" />
                    <span>ใช้ค่าสาขาทั้งหมด</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAddStaff((prev) => !prev)}
                    className="h-[32px] px-2.5 rounded-[8px] bg-[#E8F3F2] hover:bg-[#D8EAE8] border border-[#5A8A88] text-[#2D4A49] text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Plus size={13} className="text-[#5A8A88]" />
                    <span>เพิ่มพนักงาน</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {canEdit && showAddStaff && (
            <div className="flex flex-wrap items-end gap-2.5 p-3 rounded-xl bg-[#F8FCFC] border border-[#D4E4E3]">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-[10.5px] font-semibold text-[#2D4A49] mb-1">
                  ชื่อพนักงาน (ต้องตรงกับชื่อผู้ใช้เข้าระบบ)
                </label>
                <input
                  type="text"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="เช่น Mint, Somchai..."
                  className="w-full h-[32px] px-2.5 rounded-[8px] bg-white border border-[#D4E4E3] text-[#2D4A49] text-[11px] outline-none focus:border-[#5A8A88]"
                />
              </div>
              <div className="w-40">
                <label className="block text-[10.5px] font-semibold text-[#2D4A49] mb-1">
                  ตำแหน่ง
                </label>
                <input
                  type="text"
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value)}
                  placeholder="เช่น Barista, Baker"
                  className="w-full h-[32px] px-2.5 rounded-[8px] bg-white border border-[#D4E4E3] text-[#2D4A49] text-[11px] outline-none focus:border-[#5A8A88]"
                />
              </div>
              <button
                type="button"
                onClick={handleAddManualEmployee}
                disabled={!newStaffName.trim()}
                className="h-[32px] px-3 rounded-[8px] bg-[#2D4A49] hover:bg-[#203635] text-white text-[11px] font-semibold cursor-pointer disabled:opacity-45 whitespace-nowrap"
              >
                เพิ่มเข้ารายการ
              </button>
              <button
                type="button"
                onClick={() => setShowAddStaff(false)}
                className="h-[32px] px-2.5 rounded-[8px] bg-white border border-[#D4E4E3] text-[#6B8F8E] text-[11px] font-medium cursor-pointer"
              >
                ยกเลิก
              </button>
            </div>
          )}

          <StandardTableCard>
            <StandardTable>
              <StandardThead>
                <StandardHeaderRow>
                  <StandardTh className="w-10 text-center">#</StandardTh>
                  <StandardTh>รายชื่อพนักงาน / ตำแหน่ง</StandardTh>
                  <StandardTh>เวลาเข้างานมาตรฐาน</StandardTh>
                  <StandardTh>เวลาเลิกงานมาตรฐาน</StandardTh>
                  <StandardTh>อนุโลมสายได้ (นาที)</StandardTh>
                  <StandardTh>คิดโอที ทุกๆ (นาที)</StandardTh>
                  {canEdit && <StandardTh align="right">จัดการ</StandardTh>}
                </StandardHeaderRow>
              </StandardThead>
              <StandardTbody>
                {loadingStaff ? (
                  <StandardTr>
                    <StandardTd colSpan={canEdit ? 7 : 6} className="text-center py-6 text-[#6B8F8E]">
                      กำลังโหลดรายชื่อพนักงานในสาขา...
                    </StandardTd>
                  </StandardTr>
                ) : filteredEmployees.length === 0 ? (
                  <StandardTableEmpty
                    colSpan={canEdit ? 7 : 6}
                    icon={<Users size={20} />}
                    title="ไม่พบรายชื่อพนักงาน"
                    description="ตรวจสอบคำค้นหา หรือกดปุ่มเพิ่มพนักงานเพื่อกำหนดกะงานรายบุคคล"
                  />
                ) : (
                  filteredEmployees.map((emp, idx) => {
                    const row = getRowShift(emp);
                    const customized = isRowCustomized(row);

                    return (
                      <StandardTr key={`${emp.name}-${idx}`}>
                        <StandardTd className="text-center text-[#6B8F8E] tabular-nums">
                          {idx + 1}
                        </StandardTd>
                        <StandardTd>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[#2D4A49]">{emp.name}</span>
                            {customized && (
                              <span className="text-[10px] font-semibold text-[#5A8A88]">
                                · กำหนดเฉพาะคน
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-[#6B8F8E]">{emp.role}</div>
                        </StandardTd>
                        <StandardTd>
                          <input
                            type="time"
                            disabled={!canEdit}
                            value={row.shiftStartTime}
                            onChange={(e) =>
                              updateEmployeeShiftField(emp, 'shiftStartTime', e.target.value)
                            }
                            aria-label={`เวลาเข้างานมาตรฐานของ ${emp.name}`}
                            className="h-[30px] w-[112px] px-2 rounded-[7px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-[11px] font-mono tabular-nums outline-none focus:border-[#5A8A88] disabled:opacity-60"
                          />
                        </StandardTd>
                        <StandardTd>
                          <input
                            type="time"
                            disabled={!canEdit}
                            value={row.shiftEndTime}
                            onChange={(e) =>
                              updateEmployeeShiftField(emp, 'shiftEndTime', e.target.value)
                            }
                            aria-label={`เวลาเลิกงานมาตรฐานของ ${emp.name}`}
                            className="h-[30px] w-[112px] px-2 rounded-[7px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-[11px] font-mono tabular-nums outline-none focus:border-[#5A8A88] disabled:opacity-60"
                          />
                        </StandardTd>
                        <StandardTd>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              max={120}
                              disabled={!canEdit}
                              value={row.graceMinutes}
                              onChange={(e) =>
                                updateEmployeeShiftField(
                                  emp,
                                  'graceMinutes',
                                  Math.max(0, parseInt(e.target.value, 10) || 0)
                                )
                              }
                              aria-label={`อนุโลมสายของ ${emp.name}`}
                              className="h-[30px] w-[72px] px-2 rounded-[7px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-[11px] font-mono tabular-nums outline-none focus:border-[#5A8A88] disabled:opacity-60"
                            />
                            <span className="text-[10.5px] text-[#6B8F8E] whitespace-nowrap">นาที</span>
                          </div>
                        </StandardTd>
                        <StandardTd>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              max={240}
                              step={5}
                              disabled={!canEdit}
                              value={row.otStepMinutes}
                              onChange={(e) =>
                                updateEmployeeShiftField(
                                  emp,
                                  'otStepMinutes',
                                  Math.max(0, parseInt(e.target.value, 10) || 0)
                                )
                              }
                              aria-label={`คิดโอทีทุกๆ กี่นาทีของ ${emp.name}`}
                              className="h-[30px] w-[72px] px-2 rounded-[7px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-[11px] font-mono tabular-nums outline-none focus:border-[#5A8A88] disabled:opacity-60"
                            />
                            <span className="text-[10.5px] text-[#6B8F8E] whitespace-nowrap">
                              {row.otStepMinutes > 0 ? 'นาที' : 'ไม่คิด OT'}
                            </span>
                          </div>
                        </StandardTd>
                        {canEdit && (
                          <StandardTd align="right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => resetEmployeeToBranchDefault(emp)}
                                disabled={!customized}
                                className="h-[28px] px-2 rounded-[6px] border border-[#D4E4E3] bg-white hover:bg-[#F0F5F4] text-[#2D4A49] text-[10.5px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                title="รีเซ็ตกลับเป็นค่ามาตรฐานสาขา"
                              >
                                <RotateCcw size={11} />
                                <span>ค่าสาขา</span>
                              </button>
                              {emp.isManual && (
                                <button
                                  type="button"
                                  onClick={() => removeManualEmployee(emp)}
                                  className="h-[28px] w-[28px] rounded-[6px] border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center transition-colors cursor-pointer"
                                  title="ลบรายชื่อที่เพิ่มเอง"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </StandardTd>
                        )}
                      </StandardTr>
                    );
                  })
                )}
              </StandardTbody>
            </StandardTable>
          </StandardTableCard>
        </div>
      </section>
    </div>
  );
};
