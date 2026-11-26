import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarClock,
  Clock,
  Users,
  Search,
  Plus,
  Trash2,
  Pencil,
  Copy,
  RotateCcw,
  Shield,
  MapPin,
  ArrowRight,
  EyeOff,
  CheckCircle2,
  Sparkles,
  CalendarDays,
  X,
  Sliders,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  BranchGeofenceConfig,
  DayOfWeekKey,
  EmployeeShiftAssignmentMode,
  EmployeeShiftConfig,
  HolidayOtOverride,
  OtMultiplier,
  OvertimeCalculationMode,
  OvertimeEdgeRule,
  ShiftScheduleType,
  ShiftTemplate,
} from '../../types/hellocrenn';
import {
  computeShiftWorkMinutes,
  createDefaultShiftTemplate,
  DAY_OF_WEEK_LIST,
  getOtTypeLabel,
  normalizeOtMultiplier,
  OT_MULTIPLIER_OPTIONS,
} from '../../utils/gpsUtils';
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
  STANDARD_NATIVE_SELECT_CLASS,
  formatThaiNumericDate,
} from '../ui';

interface BranchStaffMember {
  id?: string;
  name: string;
  role: string;
  isManual?: boolean;
}

interface ShiftSettingsProps {
  config: BranchGeofenceConfig;
  canEdit: boolean;
  onSaveConfig: (nextConfig: BranchGeofenceConfig) => Promise<void>;
  onOpenGeofenceSettings?: () => void;
}

type ShiftSubTab = 'templates' | 'employees' | 'holidays';
type TemplateModalTab = 'schedule' | 'overtime' | 'advanced';

export const ShiftSettings: React.FC<ShiftSettingsProps> = ({
  config,
  canEdit,
  onSaveConfig,
  onOpenGeofenceSettings,
}) => {
  const [draft, setDraft] = useState<BranchGeofenceConfig>(config);
  const [activeTab, setActiveTab] = useState<ShiftSubTab>('templates');
  const [notice, setNotice] = useState<string | null>(null);

  // Templates tab state
  const [templateSearch, setTemplateSearch] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null);
  const [isNewTemplate, setIsNewTemplate] = useState(false);
  const [templateModalTab, setTemplateModalTab] = useState<TemplateModalTab>('schedule');

  // Employees tab state
  const [staffMembers, setStaffMembers] = useState<BranchStaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('Staff');
  const [bulkTemplateId, setBulkTemplateId] = useState<string>('');
  const [weeklyModalEmp, setWeeklyModalEmp] = useState<BranchStaffMember | null>(null);

  // Holiday override inputs
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayLabel, setNewHolidayLabel] = useState('');
  const [newHolidayMult, setNewHolidayMult] = useState<OtMultiplier>(3);

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
          console.warn('ShiftSettings load staff error:', err);
        }
      }

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

  const templates = useMemo<ShiftTemplate[]>(
    () => draft.shiftTemplates || [],
    [draft.shiftTemplates]
  );

  useEffect(() => {
    if (templates.length > 0 && !bulkTemplateId) {
      setBulkTemplateId(templates[0].id);
    }
  }, [templates, bulkTemplateId]);

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, templateSearch]);

  // Combine loaded branch staff + any manual employees saved in employeeShifts
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
    const q = empSearch.trim().toLowerCase();
    if (!q) return combinedEmployees;
    return combinedEmployees.filter(
      (emp) => emp.name.toLowerCase().includes(q) || emp.role.toLowerCase().includes(q)
    );
  }, [combinedEmployees, empSearch]);

  // Count how many employees actively use each template
  const templateUsageCount = useMemo(() => {
    const counts: Record<string, number> = {};
    combinedEmployees.forEach((emp) => {
      const entry = getEmployeeEntry(emp);
      if (entry.ignored) return;
      const mode = resolveAssignmentMode(entry);
      if (mode === 'template' && entry.shiftTemplateId) {
        counts[entry.shiftTemplateId] = (counts[entry.shiftTemplateId] || 0) + 1;
      } else if (mode === 'weekly' && entry.weeklySchedule) {
        const usedIds = new Set(
          Object.values(entry.weeklySchedule).filter(
            (v): v is string => Boolean(v && v !== 'OFF' && v !== 'BRANCH_DEFAULT')
          )
        );
        usedIds.forEach((tid) => {
          counts[tid] = (counts[tid] || 0) + 1;
        });
      } else if (mode === 'branch_default' && templates[0]) {
        counts[templates[0].id] = (counts[templates[0].id] || 0) + 1;
      }
    });
    return counts;
  }, [combinedEmployees, draft.employeeShifts, templates]);

  function getEmployeeEntry(emp: BranchStaffMember): EmployeeShiftConfig {
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
      ignored: false,
      assignmentMode: 'branch_default',
    };
  }

  function resolveAssignmentMode(entry: EmployeeShiftConfig): EmployeeShiftAssignmentMode {
    if (entry.assignmentMode) return entry.assignmentMode;
    if (entry.weeklySchedule && Object.keys(entry.weeklySchedule).length > 0) return 'weekly';
    if (entry.shiftTemplateId) return 'template';
    const isDiff =
      entry.shiftStartTime !== draft.shiftStartTime ||
      entry.shiftEndTime !== draft.shiftEndTime ||
      Number(entry.graceMinutes) !== Number(draft.graceMinutes) ||
      Number(entry.otStepMinutes) !== Number(draft.otStepMinutes ?? 30);
    return isDiff ? 'custom' : 'branch_default';
  }

  const updateBranchField = <K extends keyof BranchGeofenceConfig>(
    key: K,
    value: BranchGeofenceConfig[K]
  ) => {
    if (!canEdit) return;
    setDraft((prev) => ({ ...prev, [key]: value }));
    markDirty();
  };

  // ─── TEMPLATE MODAL HANDLERS ───
  const openCreateTemplate = (scheduleType: ShiftScheduleType) => {
    if (!canEdit) return;
    const isOt = scheduleType === 'overtime';
    const isFlex = scheduleType === 'flexible';
    const newTpl = createDefaultShiftTemplate({
      id: `tpl_${Date.now()}`,
      name: isOt
        ? 'กะล่วงเวลา (OT)'
        : isFlex
          ? 'กะยืดหยุ่น (Flexible)'
          : 'กะงานใหม่',
      scheduleType,
      checkInTime: draft.shiftStartTime || '08:00',
      checkOutTime: draft.shiftEndTime || '17:00',
      breakMinutes: isOt ? 0 : 60,
      graceMinutes: draft.graceMinutes ?? 15,
      isOvertimeSchedule: isOt,
      otCalculationMode: 'actual',
      otStepMinutes: draft.otStepMinutes ?? 30,
      otMultiplier: isOt ? 2 : draft.defaultOtMultiplier ?? 1.5,
    });
    setEditingTemplate(newTpl);
    setIsNewTemplate(true);
    setTemplateModalTab('schedule');
  };

  const openEditTemplate = (tpl: ShiftTemplate) => {
    setEditingTemplate({ ...tpl });
    setIsNewTemplate(false);
    setTemplateModalTab('schedule');
  };

  const handleDuplicateTemplate = (tpl: ShiftTemplate) => {
    if (!canEdit) return;
    const clone: ShiftTemplate = {
      ...tpl,
      id: `tpl_${Date.now()}`,
      name: `${tpl.name} (สำเนา)`,
    };
    setDraft((prev) => ({
      ...prev,
      shiftTemplates: [...(prev.shiftTemplates || []), clone],
    }));
    markDirty();
  };

  const handleDeleteTemplate = (tpl: ShiftTemplate) => {
    if (!canEdit) return;
    if ((draft.shiftTemplates || []).length <= 1) {
      setNotice('ต้องมีตารางเวลากะงานอย่างน้อย 1 รายการในสาขา');
      return;
    }
    setDraft((prev) => {
      const nextTemplates = (prev.shiftTemplates || []).filter((t) => t.id !== tpl.id);
      const fallbackId = nextTemplates[0]?.id;
      const nextEmpShifts: Record<string, EmployeeShiftConfig> = {};
      (Object.entries(prev.employeeShifts || {}) as Array<[string, EmployeeShiftConfig]>).forEach(
        ([k, emp]) => {
          const updated: EmployeeShiftConfig = { ...emp };
          if (updated.shiftTemplateId === tpl.id) {
            updated.shiftTemplateId = fallbackId;
            updated.assignmentMode = 'branch_default';
          }
          if (updated.weeklySchedule) {
            const nextWeekly: Partial<Record<DayOfWeekKey, string>> = {};
            (
              Object.entries(updated.weeklySchedule) as Array<
                [DayOfWeekKey, string | undefined]
              >
            ).forEach(([dk, val]) => {
              if (val) {
                nextWeekly[dk] = val === tpl.id ? 'BRANCH_DEFAULT' : val;
              }
            });
            updated.weeklySchedule = nextWeekly;
          }
          nextEmpShifts[k] = updated;
        }
      );
      return {
        ...prev,
        shiftTemplates: nextTemplates,
        employeeShifts: nextEmpShifts,
      };
    });
    markDirty();
  };

  const handleSaveTemplateModal = () => {
    if (!canEdit || !editingTemplate) return;
    const trimmedName = editingTemplate.name.trim() || 'กะงานมาตรฐาน';
    const computedWork =
      editingTemplate.scheduleType === 'flexible'
        ? Math.max(0, Number(editingTemplate.workMinutes) || 0)
        : computeShiftWorkMinutes(
            editingTemplate.checkInTime,
            editingTemplate.checkOutTime,
            editingTemplate.breakMinutes
          );
    const finalized: ShiftTemplate = {
      ...editingTemplate,
      name: trimmedName,
      workMinutes: computedWork,
      isOvertimeSchedule:
        editingTemplate.isOvertimeSchedule || editingTemplate.scheduleType === 'overtime',
    };

    setDraft((prev) => {
      const currentList = prev.shiftTemplates || [];
      const exists = currentList.some((t) => t.id === finalized.id);
      const nextList = exists
        ? currentList.map((t) => (t.id === finalized.id ? finalized : t))
        : [...currentList, finalized];

      // Keep branch defaults aligned if editing the primary/default template
      const isPrimary = finalized.id === 'tpl_default' || currentList[0]?.id === finalized.id;
      const nextEmpShifts: Record<string, EmployeeShiftConfig> = {
        ...(prev.employeeShifts || {}),
      };
      // Refresh shiftStartTime/shiftEndTime on employees explicitly linked to this template
      (Object.entries(nextEmpShifts) as Array<[string, EmployeeShiftConfig]>).forEach(
        ([k, emp]) => {
          if (emp.assignmentMode === 'template' && emp.shiftTemplateId === finalized.id) {
            nextEmpShifts[k] = {
              ...emp,
              shiftStartTime: finalized.checkInTime,
              shiftEndTime: finalized.checkOutTime,
              graceMinutes: finalized.graceMinutes,
              otStepMinutes: finalized.otStepMinutes,
            };
          }
        }
      );

      return {
        ...prev,
        ...(isPrimary
          ? {
              shiftStartTime: finalized.checkInTime,
              shiftEndTime: finalized.checkOutTime,
              graceMinutes: finalized.graceMinutes,
              otStepMinutes: finalized.otStepMinutes,
              defaultOtMultiplier: finalized.otMultiplier,
            }
          : {}),
        shiftTemplates: nextList,
        employeeShifts: nextEmpShifts,
      };
    });

    setEditingTemplate(null);
    markDirty();
  };

  // ─── EMPLOYEE SHIFT ASSIGNMENT HANDLERS ───
  const mutateEmployeeShift = (
    emp: BranchStaffMember,
    updater: (current: EmployeeShiftConfig, prevConfig: BranchGeofenceConfig) => EmployeeShiftConfig
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
          ignored: false,
          assignmentMode: 'branch_default',
        };
      const updated = updater(currentEntry, prev);
      prevMap[existingKey || emp.name] = {
        ...updated,
        userId: emp.id ?? updated.userId,
        userName: emp.name,
        userRole: emp.role || updated.userRole,
      };
      return {
        ...prev,
        employeeShifts: prevMap,
      };
    });
    markDirty();
  };

  const handleEmployeeModeChange = (emp: BranchStaffMember, mode: EmployeeShiftAssignmentMode) => {
    mutateEmployeeShift(emp, (cur, prevConfig) => {
      if (mode === 'template') {
        const chosenTpl =
          templates.find((t) => t.id === cur.shiftTemplateId) || templates[0];
        return {
          ...cur,
          assignmentMode: 'template',
          shiftTemplateId: chosenTpl?.id,
          shiftStartTime: chosenTpl?.checkInTime || prevConfig.shiftStartTime,
          shiftEndTime: chosenTpl?.checkOutTime || prevConfig.shiftEndTime,
          graceMinutes: chosenTpl?.graceMinutes ?? prevConfig.graceMinutes,
          otStepMinutes: chosenTpl?.otStepMinutes ?? prevConfig.otStepMinutes,
        };
      }
      if (mode === 'weekly') {
        const defaultId = cur.shiftTemplateId || templates[0]?.id || 'BRANCH_DEFAULT';
        const existingWeekly = cur.weeklySchedule || {
          mon: defaultId,
          tue: defaultId,
          wed: defaultId,
          thu: defaultId,
          fri: defaultId,
          sat: defaultId,
          sun: 'OFF',
        };
        return {
          ...cur,
          assignmentMode: 'weekly',
          weeklySchedule: existingWeekly,
          dayOffOtMultiplier: cur.dayOffOtMultiplier ?? 2,
        };
      }
      if (mode === 'branch_default') {
        return {
          ...cur,
          assignmentMode: 'branch_default',
          shiftTemplateId: undefined,
          shiftStartTime: prevConfig.shiftStartTime,
          shiftEndTime: prevConfig.shiftEndTime,
          graceMinutes: prevConfig.graceMinutes,
          otStepMinutes: prevConfig.otStepMinutes ?? 30,
        };
      }
      return {
        ...cur,
        assignmentMode: 'custom',
      };
    });
  };

  const handleAssignEmployeeTemplate = (emp: BranchStaffMember, templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    mutateEmployeeShift(emp, (cur) => ({
      ...cur,
      assignmentMode: 'template',
      shiftTemplateId: tpl.id,
      shiftStartTime: tpl.checkInTime,
      shiftEndTime: tpl.checkOutTime,
      graceMinutes: tpl.graceMinutes,
      otStepMinutes: tpl.otStepMinutes,
    }));
  };

  const handleBulkAssignTemplate = () => {
    if (!canEdit || !bulkTemplateId) return;
    const tpl = templates.find((t) => t.id === bulkTemplateId);
    if (!tpl) return;
    setDraft((prev) => {
      const nextMap = { ...(prev.employeeShifts || {}) };
      combinedEmployees.forEach((emp) => {
        const existingKey = Object.keys(nextMap).find(
          (k) => k.trim().toLowerCase() === emp.name.trim().toLowerCase()
        );
        const cur = (existingKey ? nextMap[existingKey] : undefined) || {
          userId: emp.id,
          userName: emp.name,
          userRole: emp.role,
          shiftStartTime: tpl.checkInTime,
          shiftEndTime: tpl.checkOutTime,
          graceMinutes: tpl.graceMinutes,
          otStepMinutes: tpl.otStepMinutes,
          ignored: false,
        };
        nextMap[existingKey || emp.name] = {
          ...cur,
          userId: emp.id ?? cur.userId,
          userName: emp.name,
          userRole: emp.role || cur.userRole,
          assignmentMode: 'template',
          shiftTemplateId: tpl.id,
          shiftStartTime: tpl.checkInTime,
          shiftEndTime: tpl.checkOutTime,
          graceMinutes: tpl.graceMinutes,
          otStepMinutes: tpl.otStepMinutes,
        };
      });
      return { ...prev, employeeShifts: nextMap };
    });
    markDirty();
    setNotice(`กำหนดกะงาน "${tpl.name}" ให้พนักงานทั้งหมดเรียบร้อย (กดบันทึกเพื่อยืนยัน)`);
  };

  const resetAllEmployeesToBranchDefault = () => {
    if (!canEdit) return;
    setDraft((prev) => {
      const nextMap: Record<string, EmployeeShiftConfig> = {};
      combinedEmployees.forEach((emp) => {
        const existing = getEmployeeEntry(emp);
        if (emp.isManual || existing.ignored) {
          nextMap[emp.name] = {
            ...existing,
            userId: emp.id ?? existing.userId,
            userName: emp.name,
            userRole: emp.role || existing.userRole,
            assignmentMode: 'branch_default',
            shiftTemplateId: undefined,
            weeklySchedule: undefined,
            otMultiplier: undefined,
            shiftStartTime: prev.shiftStartTime,
            shiftEndTime: prev.shiftEndTime,
            graceMinutes: prev.graceMinutes,
            otStepMinutes: prev.otStepMinutes ?? 30,
          };
        }
      });
      return { ...prev, employeeShifts: nextMap };
    });
    markDirty();
  };

  const resetSingleEmployee = (emp: BranchStaffMember) => {
    if (!canEdit) return;
    setDraft((prev) => {
      const prevMap = { ...(prev.employeeShifts || {}) };
      const existingKey = Object.keys(prevMap).find(
        (k) => k.trim().toLowerCase() === emp.name.trim().toLowerCase()
      );
      if (emp.isManual && existingKey) {
        prevMap[existingKey] = {
          ...prevMap[existingKey],
          assignmentMode: 'branch_default',
          shiftTemplateId: undefined,
          weeklySchedule: undefined,
          otMultiplier: undefined,
          shiftStartTime: prev.shiftStartTime,
          shiftEndTime: prev.shiftEndTime,
          graceMinutes: prev.graceMinutes,
          otStepMinutes: prev.otStepMinutes ?? 30,
          ignored: false,
        };
      } else if (existingKey) {
        delete prevMap[existingKey];
      }
      return { ...prev, employeeShifts: prevMap };
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
      return { ...prev, employeeShifts: prevMap };
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
      setNotice(`มีรายชื่อพนักงาน "${trimmed}" อยู่ในรายการแล้ว`);
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
          assignmentMode: 'branch_default',
        },
      },
    }));
    setNewStaffName('');
    setNewStaffRole('Staff');
    setShowAddStaff(false);
    markDirty();
  };

  // ─── HOLIDAY OT OVERRIDE HANDLERS ───
  const handleAddHoliday = () => {
    if (!canEdit || !newHolidayDate) return;
    const exists = (draft.holidayOverrides || []).some((h) => h.date === newHolidayDate);
    if (exists) {
      setNotice(`วันที่ ${formatThaiNumericDate(newHolidayDate)} ถูกตั้งค่าไว้แล้ว`);
      return;
    }
    const item: HolidayOtOverride = {
      id: `hol_${Date.now()}`,
      date: newHolidayDate,
      label: newHolidayLabel.trim() || 'วันหยุดนักขัตฤกษ์ / วันพิเศษ',
      otMultiplier: newHolidayMult,
    };
    setDraft((prev) => ({
      ...prev,
      holidayOverrides: [...(prev.holidayOverrides || []), item].sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
    }));
    setNewHolidayDate('');
    setNewHolidayLabel('');
    markDirty();
  };

  const handleRemoveHoliday = (id: string) => {
    if (!canEdit) return;
    setDraft((prev) => ({
      ...prev,
      holidayOverrides: (prev.holidayOverrides || []).filter((h) => h.id !== id),
    }));
    markDirty();
  };

  // ─── SAVE ALL SHIFT & OT CONFIG ───
  const handleSave = async () => {
    if (!canEdit || !isDirty) return;
    await runSave(async () => {
      const cleanedMap: Record<string, EmployeeShiftConfig> = {};
      combinedEmployees.forEach((emp) => {
        const row = getEmployeeEntry(emp);
        const mode = resolveAssignmentMode(row);
        const hasCustomData =
          emp.isManual ||
          Boolean(row.ignored) ||
          mode !== 'branch_default' ||
          Boolean(row.otMultiplier) ||
          Boolean(draft.employeeShifts?.[emp.name]);
        if (hasCustomData) {
          cleanedMap[emp.name] = {
            ...row,
            userId: emp.id ?? row.userId,
            userName: emp.name,
            userRole: emp.role || row.userRole,
            assignmentMode: mode,
            ignored: Boolean(row.ignored),
          };
        }
      });

      await onSaveConfig({
        ...config,
        ...draft,
        employeeShifts: cleanedMap,
        updatedAt: new Date().toISOString(),
      });
    });
  };

  const ignoredCount = useMemo(
    () => combinedEmployees.filter((emp) => Boolean(getEmployeeEntry(emp).ignored)).length,
    [combinedEmployees, draft.employeeShifts]
  );

  const summarizeWeeklySchedule = (entry: EmployeeShiftConfig): string => {
    if (!entry.weeklySchedule) return 'ยังไม่จัดตาราง';
    const offDays = DAY_OF_WEEK_LIST.filter((d) => entry.weeklySchedule?.[d.key] === 'OFF').map(
      (d) => d.shortLabel
    );
    const tplNames = new Set<string>();
    DAY_OF_WEEK_LIST.forEach((d) => {
      const v = entry.weeklySchedule?.[d.key];
      if (v && v !== 'OFF' && v !== 'BRANCH_DEFAULT') {
        const found = templates.find((t) => t.id === v);
        if (found) tplNames.add(found.name);
      }
    });
    const parts: string[] = [];
    if (tplNames.size > 0) parts.push(Array.from(tplNames).join(' / '));
    if (offDays.length > 0) parts.push(`หยุด: ${offDays.join(', ')}`);
    return parts.join(' · ') || 'ใช้ค่าสาขา';
  };

  return (
    <div className="space-y-4">
      <PageHeaderBanner
        variant="sub"
        icon={<CalendarClock size={18} />}
        title="ตั้งค่าเวลากะงานและโอที (Shift & OT Settings)"
        branchLabel={draft.branchLabel}
        subtitle="จัดทำตารางเวลากะงาน ตั้งเกณฑ์ล่วงเวลา (1.5x / 2x / 3x) และผูกกะงานเข้ากับพนักงานแต่ละคนอย่างยืดหยุ่น"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {onOpenGeofenceSettings && (
              <button
                type="button"
                onClick={onOpenGeofenceSettings}
                className="h-[32px] px-3 rounded-[8px] bg-white hover:bg-[#F0F5F4] border border-[#D4E4E3] text-[#2D4A49] text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <MapPin size={13} className="text-[#5A8A88]" />
                <span>ตั้งค่าพิกัดสาขา</span>
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
                label="บันทึกกะงาน & โอที"
              />
            ) : (
              <div className="h-[32px] px-3 rounded-[8px] bg-[#F0F5F4] border border-[#D4E4E3] text-[#6B8F8E] text-[11px] font-semibold flex items-center gap-1.5">
                <Shield size={13} />
                <span>โหมดดูอย่างเดียว (เฉพาะ Admin / ผู้จัดการสาขา)</span>
              </div>
            )}
          </div>
        }
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-2 w-full">
            <div className="flex flex-wrap items-center gap-1 bg-[#F0F5F4] p-0.5 rounded-[9px] border border-[#D4E4E3]">
              <button
                type="button"
                onClick={() => setActiveTab('templates')}
                className={`h-[30px] px-3 rounded-[7px] text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'templates'
                    ? 'bg-[#5A8A88] text-white shadow-xs'
                    : 'text-[#2D4A49] hover:bg-white'
                }`}
              >
                <Clock size={13} />
                <span>1. ตารางเวลากะงาน ({templates.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('employees')}
                className={`h-[30px] px-3 rounded-[7px] text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'employees'
                    ? 'bg-[#5A8A88] text-white shadow-xs'
                    : 'text-[#2D4A49] hover:bg-white'
                }`}
              >
                <Users size={13} />
                <span>2. ผูกกะงานพนักงาน ({combinedEmployees.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('holidays')}
                className={`h-[30px] px-3 rounded-[7px] text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'holidays'
                    ? 'bg-[#5A8A88] text-white shadow-xs'
                    : 'text-[#2D4A49] hover:bg-white'
                }`}
              >
                <Sparkles size={13} />
                <span>3. ชนิดโอที & วันหยุดพิเศษ</span>
              </button>
            </div>

            <div className="text-[11px] text-[#6B8F8E] flex items-center gap-2">
              <span>ค่าเริ่มต้นสาขา:</span>
              <span className="font-mono font-bold text-[#2D4A49]">
                {draft.shiftStartTime}–{draft.shiftEndTime} น.
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[#E8F3F2] text-[#2D4A49] font-semibold text-[10px]">
                {getOtTypeLabel(draft.defaultOtMultiplier ?? 1.5)}
              </span>
            </div>
          </div>
        }
      />

      {notice && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#E8F3F2] border border-[#D4E4E3] text-[#2D4A49] text-xs font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-[#5A8A88] shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-[11px] underline cursor-pointer"
          >
            ปิด
          </button>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* TAB 1: SHIFT TEMPLATES LIST (Screenshot 1, 2, 3) */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'templates' && (
        <section className="bg-white rounded-2xl border border-[#D4E4E3] p-5 shadow-[0_2px_8px_rgba(90,138,136,0.06)] space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <div className="relative flex-1">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B8F8E] pointer-events-none"
                />
                <input
                  type="text"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="ค้นหาชื่อตารางเวลากะงาน..."
                  className="w-full h-[32px] pl-8 pr-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-xs outline-none focus:border-[#5A8A88]"
                />
              </div>
            </div>

            {canEdit && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openCreateTemplate('standard')}
                  className="h-[32px] px-3 rounded-[8px] bg-[#5A8A88] hover:bg-[#4A7876] text-white text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                >
                  <Plus size={13} />
                  <span>เพิ่มตารางเวลา</span>
                </button>
                <button
                  type="button"
                  onClick={() => openCreateTemplate('flexible')}
                  className="h-[32px] px-3 rounded-[8px] bg-[#E8F3F2] hover:bg-[#D8EAE8] border border-[#5A8A88] text-[#2D4A49] text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Plus size={13} className="text-[#5A8A88]" />
                  <span>เพิ่มตารางเวลายืดหยุ่น</span>
                </button>
                <button
                  type="button"
                  onClick={() => openCreateTemplate('overtime')}
                  className="h-[32px] px-3 rounded-[8px] bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Plus size={13} />
                  <span>เพิ่มตารางเวลาล่วงเวลา</span>
                </button>
              </div>
            )}
          </div>

          <StandardTableCard>
            <StandardTable>
              <StandardThead>
                <StandardHeaderRow>
                  <StandardTh>ชื่อตารางเวลา (กะงาน)</StandardTh>
                  <StandardTh className="text-center">เช็คอิน</StandardTh>
                  <StandardTh className="text-center">เช็คเอาท์</StandardTh>
                  <StandardTh align="right">เวลาทำงาน (นาที)</StandardTh>
                  <StandardTh align="right">ช่วงเวลาพัก (นาที)</StandardTh>
                  <StandardTh className="text-center">เกณฑ์ล่วงเวลา / ชนิด OT</StandardTh>
                  <StandardTh className="text-center">พนักงานที่ใช้</StandardTh>
                  <StandardTh align="right">จัดการ</StandardTh>
                </StandardHeaderRow>
              </StandardThead>
              <StandardTbody>
                {filteredTemplates.length === 0 ? (
                  <StandardTableEmpty
                    colSpan={8}
                    icon={<Clock size={20} />}
                    title="ไม่พบตารางเวลากะงาน"
                    description="กดปุ่ม + เพิ่มตารางเวลา เพื่อสร้างกะงานใหม่สำหรับสาขา"
                  />
                ) : (
                  filteredTemplates.map((tpl) => {
                    const empCount = templateUsageCount[tpl.id] || 0;
                    const otTypeLabel = getOtTypeLabel(tpl.otMultiplier);
                    return (
                      <StandardTr key={tpl.id}>
                        <StandardTd>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: tpl.color || '#5A8A88' }}
                            />
                            <div>
                              <div className="font-bold text-[#2D4A49]">{tpl.name}</div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                {tpl.isOvertimeSchedule || tpl.scheduleType === 'overtime' ? (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                    ตารางเวลาล่วงเวลา
                                  </span>
                                ) : tpl.scheduleType === 'flexible' ? (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                                    ยืดหยุ่น
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-medium text-[#6B8F8E]">
                                    กะปกติ · อนุโลมสาย {tpl.graceMinutes} น.
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </StandardTd>
                        <StandardTd className="text-center font-mono tabular-nums font-semibold text-[#2D4A49]">
                          {tpl.checkInTime}
                        </StandardTd>
                        <StandardTd className="text-center font-mono tabular-nums font-semibold text-[#2D4A49]">
                          {tpl.checkOutTime}
                        </StandardTd>
                        <StandardTd align="right" className="font-mono tabular-nums">
                          <span className="font-semibold text-[#2D4A49]">{tpl.workMinutes}</span>
                          <span className="text-[10px] text-[#6B8F8E] ml-1">
                            ({(tpl.workMinutes / 60).toFixed(1)} ชม.)
                          </span>
                        </StandardTd>
                        <StandardTd align="right" className="font-mono tabular-nums text-[#6B8F8E]">
                          {tpl.breakMinutes}
                        </StandardTd>
                        <StandardTd className="text-center">
                          <div className="inline-flex flex-col items-center gap-0.5">
                            <span
                              className={`text-[10.5px] font-bold px-2 py-0.5 rounded border ${
                                tpl.otMultiplier === 3
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : tpl.otMultiplier === 2
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-[#E8F3F2] text-[#2D4A49] border-[#D4E4E3]'
                              }`}
                            >
                              {otTypeLabel}
                            </span>
                            <span className="text-[10px] text-[#6B8F8E]">
                              {tpl.otCalculationMode === 'actual'
                                ? `ขั้นต่ำ ${tpl.lateOutMinOtMinutes} น. (ตามจริง)`
                                : tpl.otStepMinutes > 0
                                  ? `ทุกๆ ${tpl.otStepMinutes} น.`
                                  : 'ปิด OT'}
                            </span>
                          </div>
                        </StandardTd>
                        <StandardTd className="text-center tabular-nums">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#F0F5F4] text-[#2D4A49] text-[11px] font-semibold">
                            {empCount} คน
                          </span>
                        </StandardTd>
                        <StandardTd align="right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEditTemplate(tpl)}
                              className="h-[28px] px-2 rounded-[6px] border border-[#D4E4E3] bg-white hover:bg-[#F0F5F4] text-[#2D4A49] text-[10.5px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                              title="แก้ไขตารางเวลาและตั้งค่าโอที"
                            >
                              <Pencil size={11} className="text-[#5A8A88]" />
                              <span>{canEdit ? 'ตั้งค่า' : 'ดู'}</span>
                            </button>
                            {canEdit && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateTemplate(tpl)}
                                  className="h-[28px] w-[28px] rounded-[6px] border border-[#D4E4E3] bg-white hover:bg-[#F0F5F4] text-[#5A8A88] inline-flex items-center justify-center cursor-pointer"
                                  title="คัดลอกตารางเวลา"
                                >
                                  <Copy size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTemplate(tpl)}
                                  disabled={templates.length <= 1}
                                  className="h-[28px] w-[28px] rounded-[6px] border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                                  title="ลบตารางเวลา"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </>
                            )}
                          </div>
                        </StandardTd>
                      </StandardTr>
                    );
                  })
                )}
              </StandardTbody>
            </StandardTable>
          </StandardTableCard>
        </section>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* TAB 2: FLEXIBLE EMPLOYEE SHIFT ASSIGNMENT */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'employees' && (
        <section className="bg-white rounded-2xl border border-[#D4E4E3] p-5 shadow-[0_2px_8px_rgba(90,138,136,0.06)] space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-bold text-[#2D4A49] flex items-center gap-1.5">
                <Users size={16} className="text-[#5A8A88]" />
                <span>
                  ผูกกะงานและอัตราโอทีรายบุคคล ({combinedEmployees.length} คน
                  {ignoredCount > 0 ? ` · Ignore ${ignoredCount} คน` : ''})
                </span>
              </h2>
              <p className="text-[11px] text-[#6B8F8E] mt-0.5">
                เลือกผูกกับตารางเวลากะงานที่สร้างไว้ กำหนดตารางสลับรายวัน (จันทร์–อาทิตย์) หรือกำหนดเวลาเฉพาะคนได้อย่างยืดหยุ่น
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[185px]">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B8F8E] pointer-events-none"
                />
                <input
                  type="text"
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  placeholder="ค้นหาชื่อพนักงาน / ตำแหน่ง..."
                  className="w-full h-[32px] pl-8 pr-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-[11px] outline-none focus:border-[#5A8A88]"
                />
              </div>

              {canEdit && (
                <>
                  <div className="flex items-center gap-1 bg-[#F8FCFC] border border-[#D4E4E3] rounded-[8px] p-0.5">
                    <select
                      value={bulkTemplateId}
                      onChange={(e) => setBulkTemplateId(e.target.value)}
                      className="h-[28px] px-2 rounded-[6px] bg-white text-[#2D4A49] text-[11px] outline-none"
                      aria-label="เลือกกะงานเพื่อกำหนดให้ทุกคน"
                    >
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.checkInTime}–{t.checkOutTime})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleBulkAssignTemplate}
                      className="h-[28px] px-2.5 rounded-[6px] bg-[#5A8A88] hover:bg-[#497573] text-white text-[10.5px] font-semibold cursor-pointer whitespace-nowrap"
                    >
                      ใช้กับทุกคน
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={resetAllEmployeesToBranchDefault}
                    className="h-[32px] px-2.5 rounded-[8px] bg-white hover:bg-[#F0F5F4] border border-[#D4E4E3] text-[#2D4A49] text-[11px] font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    title="รีเซ็ตทุกคนให้ใช้ค่าเริ่มต้นสาขา"
                  >
                    <RotateCcw size={12} className="text-[#5A8A88]" />
                    <span>รีเซ็ตค่าสาขา</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAddStaff((prev) => !prev)}
                    className="h-[32px] px-2.5 rounded-[8px] bg-[#E8F3F2] hover:bg-[#D8EAE8] border border-[#5A8A88] text-[#2D4A49] text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
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
                  <StandardTh>พนักงาน / ตำแหน่ง</StandardTh>
                  <StandardTh>รูปแบบการผูกกะงาน</StandardTh>
                  <StandardTh>รายละเอียดกะงาน / ตารางเวลา</StandardTh>
                  <StandardTh>ชนิด OT ประจำตัว</StandardTh>
                  {canEdit && <StandardTh align="right">จัดการ</StandardTh>}
                </StandardHeaderRow>
              </StandardThead>
              <StandardTbody>
                {loadingStaff ? (
                  <StandardTr>
                    <StandardTd colSpan={canEdit ? 6 : 5} className="text-center py-6 text-[#6B8F8E]">
                      กำลังโหลดรายชื่อพนักงานในสาขา...
                    </StandardTd>
                  </StandardTr>
                ) : filteredEmployees.length === 0 ? (
                  <StandardTableEmpty
                    colSpan={canEdit ? 6 : 5}
                    icon={<Users size={20} />}
                    title="ไม่พบรายชื่อพนักงาน"
                    description="ตรวจสอบคำค้นหา หรือกดปุ่มเพิ่มพนักงานเพื่อกำหนดกะงานรายบุคคล"
                  />
                ) : (
                  filteredEmployees.map((emp, idx) => {
                    const entry = getEmployeeEntry(emp);
                    const mode = resolveAssignmentMode(entry);
                    const isIgnored = Boolean(entry.ignored);
                    const matchedTpl =
                      templates.find((t) => t.id === entry.shiftTemplateId) || templates[0];

                    return (
                      <StandardTr
                        key={`${emp.name}-${idx}`}
                        className={isIgnored ? 'bg-slate-50/75 opacity-80' : undefined}
                      >
                        <StandardTd className="text-center text-[#6B8F8E] tabular-nums">
                          {idx + 1}
                        </StandardTd>
                        <StandardTd>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`font-semibold ${
                                isIgnored ? 'text-slate-500 line-through' : 'text-[#2D4A49]'
                              }`}
                            >
                              {emp.name}
                            </span>
                            {isIgnored && (
                              <span className="text-[9.5px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                Ignore
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-[#6B8F8E]">{emp.role}</div>
                        </StandardTd>

                        <StandardTd>
                          <select
                            disabled={!canEdit || isIgnored}
                            value={mode}
                            onChange={(e) =>
                              handleEmployeeModeChange(
                                emp,
                                e.target.value as EmployeeShiftAssignmentMode
                              )
                            }
                            className={`${STANDARD_NATIVE_SELECT_CLASS} h-[30px] text-[11px] min-w-[155px]`}
                          >
                            <option value="branch_default">ค่าเริ่มต้นสาขา</option>
                            <option value="template">เลือกตารางเวลา (1 กะ)</option>
                            <option value="weekly">จัดตารางรายวัน (จ.-อา.)</option>
                            <option value="custom">กำหนดเวลาเอง (Custom)</option>
                          </select>
                        </StandardTd>

                        <StandardTd>
                          {mode === 'branch_default' && (
                            <div className="text-[11px] text-[#6B8F8E] font-mono tabular-nums">
                              ใช้ค่าสาขา: <strong className="text-[#2D4A49]">{draft.shiftStartTime}–{draft.shiftEndTime}</strong> · สาย {draft.graceMinutes} น.
                            </div>
                          )}

                          {mode === 'template' && (
                            <select
                              disabled={!canEdit || isIgnored}
                              value={matchedTpl?.id || ''}
                              onChange={(e) => handleAssignEmployeeTemplate(emp, e.target.value)}
                              className={`${STANDARD_NATIVE_SELECT_CLASS} h-[30px] text-[11px] min-w-[210px]`}
                            >
                              {templates.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name} ({t.checkInTime}–{t.checkOutTime} · {getOtTypeLabel(t.otMultiplier)})
                                </option>
                              ))}
                            </select>
                          )}

                          {mode === 'weekly' && (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] text-[#2D4A49] max-w-[230px] truncate" title={summarizeWeeklySchedule(entry)}>
                                {summarizeWeeklySchedule(entry)}
                              </span>
                              <button
                                type="button"
                                disabled={isIgnored}
                                onClick={() => setWeeklyModalEmp(emp)}
                                className="h-[26px] px-2 rounded-[6px] bg-[#E8F3F2] hover:bg-[#D8EAE8] border border-[#5A8A88] text-[#2D4A49] text-[10.5px] font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-45 whitespace-nowrap"
                              >
                                <CalendarDays size={11} className="text-[#5A8A88]" />
                                <span>จัดตาราง จ.-อา.</span>
                              </button>
                            </div>
                          )}

                          {mode === 'custom' && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <input
                                type="time"
                                disabled={!canEdit || isIgnored}
                                value={entry.shiftStartTime}
                                onChange={(e) =>
                                  mutateEmployeeShift(emp, (cur) => ({
                                    ...cur,
                                    assignmentMode: 'custom',
                                    shiftStartTime: e.target.value,
                                  }))
                                }
                                className="h-[28px] px-1.5 rounded-[6px] bg-[#F8FCFC] border border-[#D4E4E3] text-[11px] font-mono tabular-nums"
                              />
                              <span className="text-[#6B8F8E]">–</span>
                              <input
                                type="time"
                                disabled={!canEdit || isIgnored}
                                value={entry.shiftEndTime}
                                onChange={(e) =>
                                  mutateEmployeeShift(emp, (cur) => ({
                                    ...cur,
                                    assignmentMode: 'custom',
                                    shiftEndTime: e.target.value,
                                  }))
                                }
                                className="h-[28px] px-1.5 rounded-[6px] bg-[#F8FCFC] border border-[#D4E4E3] text-[11px] font-mono tabular-nums"
                              />
                              <div className="inline-flex items-center gap-1 text-[10px] text-[#6B8F8E]">
                                <span>สาย</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={120}
                                  disabled={!canEdit || isIgnored}
                                  value={entry.graceMinutes}
                                  onChange={(e) =>
                                    mutateEmployeeShift(emp, (cur) => ({
                                      ...cur,
                                      assignmentMode: 'custom',
                                      graceMinutes: Math.max(0, parseInt(e.target.value, 10) || 0),
                                    }))
                                  }
                                  className="h-[28px] w-[44px] px-1 text-center rounded-[6px] bg-[#F8FCFC] border border-[#D4E4E3] text-[11px] font-mono tabular-nums text-[#2D4A49]"
                                />
                              </div>
                              <div className="inline-flex items-center gap-1 text-[10px] text-[#6B8F8E]">
                                <span>OT</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={240}
                                  step={5}
                                  disabled={!canEdit || isIgnored}
                                  value={entry.otStepMinutes}
                                  onChange={(e) =>
                                    mutateEmployeeShift(emp, (cur) => ({
                                      ...cur,
                                      assignmentMode: 'custom',
                                      otStepMinutes: Math.max(0, parseInt(e.target.value, 10) || 0),
                                    }))
                                  }
                                  className="h-[28px] w-[44px] px-1 text-center rounded-[6px] bg-[#F8FCFC] border border-[#D4E4E3] text-[11px] font-mono tabular-nums text-[#2D4A49]"
                                />
                              </div>
                            </div>
                          )}
                        </StandardTd>

                        <StandardTd>
                          <select
                            disabled={!canEdit || isIgnored}
                            value={entry.otMultiplier ? String(entry.otMultiplier) : 'INHERIT'}
                            onChange={(e) => {
                              const val = e.target.value;
                              mutateEmployeeShift(emp, (cur) => ({
                                ...cur,
                                otMultiplier:
                                  val === 'INHERIT' ? undefined : normalizeOtMultiplier(val),
                              }));
                            }}
                            className={`${STANDARD_NATIVE_SELECT_CLASS} h-[30px] text-[11px] min-w-[125px]`}
                          >
                            <option value="INHERIT">ตามกะ / วัน</option>
                            <option value="1.5">OT 1.5 เท่า</option>
                            <option value="2">OT 2 เท่า</option>
                            <option value="3">OT 3 เท่า</option>
                          </select>
                        </StandardTd>

                        {canEdit && (
                          <StandardTd align="right">
                            <div className="inline-flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  mutateEmployeeShift(emp, (cur) => ({
                                    ...cur,
                                    ignored: !cur.ignored,
                                  }))
                                }
                                className={`h-[26px] px-1.5 rounded-[6px] border text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                                  isIgnored
                                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                                    : 'border-[#D4E4E3] bg-white text-[#6B8F8E] hover:bg-[#F0F5F4] hover:text-[#2D4A49]'
                                }`}
                              >
                                <EyeOff size={11} />
                                <span>{isIgnored ? 'Ignored' : 'Ignore'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => resetSingleEmployee(emp)}
                                className="h-[26px] px-1.5 rounded-[6px] border border-[#D4E4E3] bg-white hover:bg-[#F0F5F4] text-[#2D4A49] text-[10px] font-medium inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                title="รีเซ็ตกลับเป็นค่าสาขา"
                              >
                                <RotateCcw size={10} />
                                <span>รีเซ็ต</span>
                              </button>
                              {emp.isManual && (
                                <button
                                  type="button"
                                  onClick={() => removeManualEmployee(emp)}
                                  className="h-[26px] w-[26px] rounded-[6px] border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center cursor-pointer"
                                  title="ลบรายชื่อที่เพิ่มเอง"
                                >
                                  <Trash2 size={11} />
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
        </section>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* TAB 3: OT MULTIPLIERS & HOLIDAY OVERRIDES */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'holidays' && (
        <div className="space-y-4">
          <section className="bg-white rounded-2xl border border-[#D4E4E3] p-5 shadow-[0_2px_8px_rgba(90,138,136,0.06)] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8F3F2] pb-3">
              <div>
                <h2 className="text-[14px] font-bold text-[#2D4A49]">
                  ค่าเริ่มต้นกะงานและชนิดโอทีของสาขา
                </h2>
                <p className="text-[11px] text-[#6B8F8E] mt-0.5">
                  ใช้เป็นค่าหลักสำหรับพนักงานที่เลือก &quot;ค่าเริ่มต้นสาขา&quot; และกำหนดอัตรา OT เริ่มต้น
                </p>
              </div>
              <Sliders size={18} className="text-[#5A8A88]" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                  เข้างานมาตรฐาน
                </label>
                <input
                  type="time"
                  disabled={!canEdit}
                  value={draft.shiftStartTime}
                  onChange={(e) => updateBranchField('shiftStartTime', e.target.value)}
                  className="w-full h-[36px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-xs font-mono tabular-nums outline-none focus:border-[#5A8A88] disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                  เลิกงานมาตรฐาน
                </label>
                <input
                  type="time"
                  disabled={!canEdit}
                  value={draft.shiftEndTime}
                  onChange={(e) => updateBranchField('shiftEndTime', e.target.value)}
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
                  onChange={(e) =>
                    updateBranchField('graceMinutes', Math.max(0, parseInt(e.target.value, 10) || 0))
                  }
                  className="w-full h-[36px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-xs font-mono tabular-nums outline-none focus:border-[#5A8A88] disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                  คิดโอทีทุกๆ (นาที)
                </label>
                <input
                  type="number"
                  min={0}
                  max={240}
                  step={5}
                  disabled={!canEdit}
                  value={draft.otStepMinutes ?? 30}
                  onChange={(e) =>
                    updateBranchField('otStepMinutes', Math.max(0, parseInt(e.target.value, 10) || 0))
                  }
                  className="w-full h-[36px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-xs font-mono tabular-nums outline-none focus:border-[#5A8A88] disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                  ชนิด OT เริ่มต้นสาขา
                </label>
                <select
                  disabled={!canEdit}
                  value={String(draft.defaultOtMultiplier ?? 1.5)}
                  onChange={(e) =>
                    updateBranchField('defaultOtMultiplier', normalizeOtMultiplier(e.target.value))
                  }
                  className={`${STANDARD_NATIVE_SELECT_CLASS} w-full h-[36px] text-xs`}
                >
                  {OT_MULTIPLIER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3 OT Rate Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              {OT_MULTIPLIER_OPTIONS.map((opt) => (
                <div
                  key={opt.value}
                  className={`p-3.5 rounded-xl border ${
                    opt.value === 3
                      ? 'bg-rose-50/60 border-rose-200'
                      : opt.value === 2
                        ? 'bg-amber-50/60 border-amber-200'
                        : 'bg-[#F8FCFC] border-[#D4E4E3]'
                  }`}
                >
                  <div className="font-bold text-xs text-[#2D4A49]">{opt.label}</div>
                  <p className="text-[11px] text-[#6B8F8E] mt-1">{opt.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Special Holiday OT Override List */}
          <section className="bg-white rounded-2xl border border-[#D4E4E3] p-5 shadow-[0_2px_8px_rgba(90,138,136,0.06)] space-y-4">
            <div className="border-b border-[#E8F3F2] pb-3">
              <h2 className="text-[14px] font-bold text-[#2D4A49]">
                กำหนดวันหยุดนักขัตฤกษ์ / วันพิเศษ (บังคับใช้อัตรา OT อัตโนมัติ)
              </h2>
              <p className="text-[11px] text-[#6B8F8E] mt-0.5">
                เมื่อพนักงานลงเวลาในวันที่กำหนดไว้ด้านล่าง ระบบจะคิดชั่วโมง OT ด้วยชนิดโอทีที่ตั้งไว้ของวันนั้นโดยอัตโนมัติ (เช่น 2 เท่า หรือ 3 เท่า)
              </p>
            </div>

            {canEdit && (
              <div className="flex flex-wrap items-end gap-2.5 p-3 rounded-xl bg-[#F8FCFC] border border-[#D4E4E3]">
                <div>
                  <label className="block text-[10.5px] font-semibold text-[#2D4A49] mb-1">
                    วันที่
                  </label>
                  <input
                    type="date"
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                    className="h-[34px] px-2.5 rounded-[8px] bg-white border border-[#D4E4E3] text-xs text-[#2D4A49]"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-[10.5px] font-semibold text-[#2D4A49] mb-1">
                    ชื่อวันหยุด / เหตุผล
                  </label>
                  <input
                    type="text"
                    value={newHolidayLabel}
                    onChange={(e) => setNewHolidayLabel(e.target.value)}
                    placeholder="เช่น วันขึ้นปีใหม่, วันสงกรานต์, วันหยุดร้านประจำปี..."
                    className="w-full h-[34px] px-3 rounded-[8px] bg-white border border-[#D4E4E3] text-xs text-[#2D4A49]"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-semibold text-[#2D4A49] mb-1">
                    ชนิด OT ที่ใช้
                  </label>
                  <select
                    value={String(newHolidayMult)}
                    onChange={(e) => setNewHolidayMult(normalizeOtMultiplier(e.target.value, 3))}
                    className={`${STANDARD_NATIVE_SELECT_CLASS} h-[34px] text-xs`}
                  >
                    {OT_MULTIPLIER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleAddHoliday}
                  disabled={!newHolidayDate}
                  className="h-[34px] px-3.5 rounded-[8px] bg-[#2D4A49] hover:bg-[#203635] text-white text-xs font-semibold cursor-pointer disabled:opacity-45 whitespace-nowrap"
                >
                  + เพิ่มวันพิเศษ
                </button>
              </div>
            )}

            <StandardTableCard>
              <StandardTable>
                <StandardThead>
                  <StandardHeaderRow>
                    <StandardTh>วันที่</StandardTh>
                    <StandardTh>ชื่อวันหยุด / รายละเอียด</StandardTh>
                    <StandardTh className="text-center">ชนิด OT</StandardTh>
                    {canEdit && <StandardTh align="right">ลบ</StandardTh>}
                  </StandardHeaderRow>
                </StandardThead>
                <StandardTbody>
                  {(draft.holidayOverrides || []).length === 0 ? (
                    <StandardTableEmpty
                      colSpan={canEdit ? 4 : 3}
                      icon={<CalendarDays size={20} />}
                      title="ยังไม่มีรายการวันหยุดพิเศษ"
                      description="สามารถเพิ่มวันที่ต้องการคิด OT เป็น 2 เท่า หรือ 3 เท่า ได้ที่นี่"
                    />
                  ) : (
                    (draft.holidayOverrides || []).map((hol) => (
                      <StandardTr key={hol.id}>
                        <StandardTd className="font-mono tabular-nums font-semibold">
                          {formatThaiNumericDate(hol.date)}
                        </StandardTd>
                        <StandardTd className="font-medium text-[#2D4A49]">{hol.label}</StandardTd>
                        <StandardTd className="text-center">
                          <span
                            className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded border ${
                              hol.otMultiplier === 3
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : hol.otMultiplier === 2
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-[#E8F3F2] text-[#2D4A49] border-[#D4E4E3]'
                            }`}
                          >
                            {getOtTypeLabel(hol.otMultiplier)}
                          </span>
                        </StandardTd>
                        {canEdit && (
                          <StandardTd align="right">
                            <button
                              type="button"
                              onClick={() => handleRemoveHoliday(hol.id)}
                              className="h-[26px] w-[26px] rounded-[6px] border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center cursor-pointer"
                            >
                              <Trash2 size={11} />
                            </button>
                          </StandardTd>
                        )}
                      </StandardTr>
                    ))
                  )}
                </StandardTbody>
              </StandardTable>
            </StandardTableCard>
          </section>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* MODAL 1: ADD / EDIT SHIFT TEMPLATE (Screenshots 2 & 3) */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {editingTemplate && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4"
          onClick={() => setEditingTemplate(null)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-2xl border border-[#D4E4E3] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-[#2D4A49] text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">
                  {isNewTemplate ? 'เพิ่มตารางเวลากะงานใหม่' : `แก้ไขตารางเวลา: ${editingTemplate.name}`}
                </h3>
                <p className="text-[11px] text-[#D4E4E3]">
                  ตั้งค่าเวลาเช็คอิน-เอาท์ หน้าต่างลงเวลา เกณฑ์ล่วงเวลา และชนิด OT (1.5x / 2x / 3x)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTemplate(null)}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Internal Tabs (matches Screenshot 2) */}
            <div className="px-5 pt-3 border-b border-[#E8F3F2] flex items-center gap-4 bg-[#F8FCFC]">
              {(
                [
                  { id: 'schedule', label: 'การตั้งค่ากฎ (ตารางเวลา)' },
                  { id: 'overtime', label: 'การตั้งค่าล่วงเวลา (OT)' },
                  { id: 'advanced', label: 'การตั้งค่าขั้นสูง' },
                ] as Array<{ id: TemplateModalTab; label: string }>
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplateModalTab(t.id)}
                  className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    templateModalTab === t.id
                      ? 'border-[#5A8A88] text-[#5A8A88]'
                      : 'border-transparent text-[#6B8F8E] hover:text-[#2D4A49]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {templateModalTab === 'schedule' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                        * ชื่อตารางเวลา
                      </label>
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={editingTemplate.name}
                        onChange={(e) =>
                          setEditingTemplate((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                        }
                        placeholder="เช่น ทีมครัว จันทร์-เสาร์, ทีมบาร์ เสาร์..."
                        className="w-full h-[36px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-xs text-[#2D4A49] outline-none focus:border-[#5A8A88]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                        รูปแบบตารางเวลา
                      </label>
                      <select
                        disabled={!canEdit}
                        value={editingTemplate.scheduleType}
                        onChange={(e) => {
                          const st = e.target.value as ShiftScheduleType;
                          setEditingTemplate((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  scheduleType: st,
                                  isOvertimeSchedule: st === 'overtime' ? true : prev.isOvertimeSchedule,
                                }
                              : prev
                          );
                        }}
                        className={`${STANDARD_NATIVE_SELECT_CLASS} w-full h-[36px] text-xs`}
                      >
                        <option value="standard">ตารางเวลาปกติ (Standard)</option>
                        <option value="flexible">ตารางเวลายืดหยุ่น (Flexible)</option>
                        <option value="overtime">ตารางเวลาล่วงเวลา (OT Schedule)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                        * เช็คอิน
                      </label>
                      <input
                        type="time"
                        disabled={!canEdit}
                        value={editingTemplate.checkInTime}
                        onChange={(e) =>
                          setEditingTemplate((prev) => {
                            if (!prev) return prev;
                            const nextIn = e.target.value;
                            return {
                              ...prev,
                              checkInTime: nextIn,
                              workMinutes:
                                prev.scheduleType === 'flexible'
                                  ? prev.workMinutes
                                  : computeShiftWorkMinutes(nextIn, prev.checkOutTime, prev.breakMinutes),
                            };
                          })
                        }
                        className="w-full h-[36px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-xs font-mono tabular-nums text-[#2D4A49]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                        * เช็คเอาท์
                      </label>
                      <input
                        type="time"
                        disabled={!canEdit}
                        value={editingTemplate.checkOutTime}
                        onChange={(e) =>
                          setEditingTemplate((prev) => {
                            if (!prev) return prev;
                            const nextOut = e.target.value;
                            return {
                              ...prev,
                              checkOutTime: nextOut,
                              workMinutes:
                                prev.scheduleType === 'flexible'
                                  ? prev.workMinutes
                                  : computeShiftWorkMinutes(prev.checkInTime, nextOut, prev.breakMinutes),
                            };
                          })
                        }
                        className="w-full h-[36px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-xs font-mono tabular-nums text-[#2D4A49]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                        ช่วงเวลาพัก (นาที)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={240}
                        disabled={!canEdit}
                        value={editingTemplate.breakMinutes}
                        onChange={(e) =>
                          setEditingTemplate((prev) => {
                            if (!prev) return prev;
                            const brk = Math.max(0, parseInt(e.target.value, 10) || 0);
                            return {
                              ...prev,
                              breakMinutes: brk,
                              workMinutes:
                                prev.scheduleType === 'flexible'
                                  ? prev.workMinutes
                                  : computeShiftWorkMinutes(prev.checkInTime, prev.checkOutTime, brk),
                            };
                          })
                        }
                        className="w-full h-[36px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-xs font-mono tabular-nums text-[#2D4A49]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                        เวลาทำงานสุทธิ (นาที)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={1440}
                        disabled={!canEdit || editingTemplate.scheduleType !== 'flexible'}
                        value={
                          editingTemplate.scheduleType === 'flexible'
                            ? editingTemplate.workMinutes
                            : computeShiftWorkMinutes(
                                editingTemplate.checkInTime,
                                editingTemplate.checkOutTime,
                                editingTemplate.breakMinutes
                              )
                        }
                        onChange={(e) =>
                          setEditingTemplate((prev) =>
                            prev
                              ? { ...prev, workMinutes: Math.max(0, parseInt(e.target.value, 10) || 0) }
                              : prev
                          )
                        }
                        className="w-full h-[36px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-xs font-mono tabular-nums text-[#2D4A49] disabled:bg-[#F0F5F4]"
                      />
                    </div>
                  </div>

                  {/* Check-in / Check-out Scan Windows (from Screenshot 3) */}
                  <div className="pt-3 border-t border-[#E8F3F2] grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                        * ช่วงเวลาเช็คอินก่อนเริ่มงาน (นาที)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={480}
                        disabled={!canEdit}
                        value={editingTemplate.checkInBeforeMinutes}
                        onChange={(e) =>
                          setEditingTemplate((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  checkInBeforeMinutes: Math.max(0, parseInt(e.target.value, 10) || 0),
                                }
                              : prev
                          )
                        }
                        className="w-full h-[36px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-xs font-mono tabular-nums text-[#2D4A49]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                        * ช่วงเวลาเช็คอินหลังเริ่มงาน (นาที)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={480}
                        disabled={!canEdit}
                        value={editingTemplate.checkInAfterMinutes}
                        onChange={(e) =>
                          setEditingTemplate((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  checkInAfterMinutes: Math.max(0, parseInt(e.target.value, 10) || 0),
                                }
                              : prev
                          )
                        }
                        className="w-full h-[36px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-xs font-mono tabular-nums text-[#2D4A49]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                        * ช่วงเวลาเช็คเอาท์ก่อนเลิกงาน (นาที)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={480}
                        disabled={!canEdit}
                        value={editingTemplate.checkOutBeforeMinutes}
                        onChange={(e) =>
                          setEditingTemplate((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  checkOutBeforeMinutes: Math.max(0, parseInt(e.target.value, 10) || 0),
                                }
                              : prev
                          )
                        }
                        className="w-full h-[36px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-xs font-mono tabular-nums text-[#2D4A49]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                        * ช่วงเวลาเช็คเอาท์หลังเลิกงาน (นาที)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={720}
                        disabled={!canEdit}
                        value={editingTemplate.checkOutAfterMinutes}
                        onChange={(e) =>
                          setEditingTemplate((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  checkOutAfterMinutes: Math.max(0, parseInt(e.target.value, 10) || 0),
                                }
                              : prev
                          )
                        }
                        className="w-full h-[36px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-xs font-mono tabular-nums text-[#2D4A49]"
                      />
                    </div>
                  </div>

                  {/* Toggle: ตั้งเป็นตารางเวลาล่วงเวลา (Screenshot 3) */}
                  <label className="flex items-center justify-between p-3 rounded-xl border border-[#D4E4E3] bg-[#F8FCFC] cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-[#2D4A49] block">
                        * ตั้งเป็นตารางเวลาล่วงเวลา
                      </span>
                      <span className="text-[10.5px] text-[#6B8F8E]">
                        เมื่อเปิดใช้ ชั่วโมงการทำงานทั้งหมดในตารางเวลานี้จะถูกนับเป็นเวลาล่วงเวลา (OT)
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={editingTemplate.isOvertimeSchedule}
                      onChange={(e) =>
                        setEditingTemplate((prev) =>
                          prev
                            ? {
                                ...prev,
                                isOvertimeSchedule: e.target.checked,
                                scheduleType: e.target.checked
                                  ? 'overtime'
                                  : prev.scheduleType === 'overtime'
                                    ? 'standard'
                                    : prev.scheduleType,
                              }
                            : prev
                        )
                      }
                      className="w-4 h-4 accent-[#5A8A88]"
                    />
                  </label>
                </div>
              )}

              {templateModalTab === 'overtime' && (
                <div className="space-y-4">
                  {/* OT Multiplier Selector (1.5x / 2x / 3x) */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#2D4A49] mb-1.5">
                      * ชนิดอัตราโอที (OT Multiplier) ของตารางเวลานี้
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {OT_MULTIPLIER_OPTIONS.map((opt) => {
                        const selected = editingTemplate.otMultiplier === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={!canEdit}
                            onClick={() =>
                              setEditingTemplate((prev) =>
                                prev ? { ...prev, otMultiplier: opt.value } : prev
                              )
                            }
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              selected
                                ? 'bg-[#E8F3F2] border-[#5A8A88] ring-1 ring-[#5A8A88]'
                                : 'bg-[#F8FCFC] border-[#D4E4E3] hover:bg-[#F0F5F4]'
                            }`}
                          >
                            <div className="text-xs font-bold text-[#2D4A49]">{opt.label}</div>
                            <div className="text-[10px] text-[#6B8F8E] mt-0.5 leading-snug">
                              {opt.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Early Check-in OT (matches Screenshot 2) */}
                  <div className="p-3.5 rounded-xl border border-[#D4E4E3] bg-[#F8FCFC] space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                          * เข้าเร็วกว่ากำหนด
                        </label>
                        <select
                          disabled={!canEdit}
                          value={editingTemplate.earlyInRule}
                          onChange={(e) =>
                            setEditingTemplate((prev) =>
                              prev ? { ...prev, earlyInRule: e.target.value as OvertimeEdgeRule } : prev
                            )
                          }
                          className={`${STANDARD_NATIVE_SELECT_CLASS} w-full h-[34px] text-xs`}
                        >
                          <option value="ignore">ละเว้น</option>
                          <option value="count_ot">คำนวณเป็นล่วงเวลา</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                          เกณฑ์เข้าเร็วกว่ากำหนด (นาที)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={240}
                          disabled={!canEdit || editingTemplate.earlyInRule === 'ignore'}
                          value={editingTemplate.earlyInThresholdMinutes}
                          onChange={(e) =>
                            setEditingTemplate((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    earlyInThresholdMinutes: Math.max(0, parseInt(e.target.value, 10) || 0),
                                  }
                                : prev
                            )
                          }
                          className="w-full h-[34px] px-2.5 rounded-[8px] bg-white border border-[#D4E4E3] text-xs font-mono tabular-nums disabled:opacity-45"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                          ระยะเวลาล่วงเวลาขั้นต่ำ (นาที)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={240}
                          disabled={!canEdit || editingTemplate.earlyInRule === 'ignore'}
                          value={editingTemplate.earlyInMinOtMinutes}
                          onChange={(e) =>
                            setEditingTemplate((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    earlyInMinOtMinutes: Math.max(0, parseInt(e.target.value, 10) || 0),
                                  }
                                : prev
                            )
                          }
                          className="w-full h-[34px] px-2.5 rounded-[8px] bg-white border border-[#D4E4E3] text-xs font-mono tabular-nums disabled:opacity-45"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Late Check-out OT (matches Screenshot 2) */}
                  <div className="p-3.5 rounded-xl border border-[#D4E4E3] bg-[#F8FCFC] space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                          * ออกช้ากว่ากำหนด
                        </label>
                        <select
                          disabled={!canEdit}
                          value={editingTemplate.lateOutRule}
                          onChange={(e) =>
                            setEditingTemplate((prev) =>
                              prev ? { ...prev, lateOutRule: e.target.value as OvertimeEdgeRule } : prev
                            )
                          }
                          className={`${STANDARD_NATIVE_SELECT_CLASS} w-full h-[34px] text-xs`}
                        >
                          <option value="ignore">ละเว้น</option>
                          <option value="count_ot">คำนวณเป็นล่วงเวลา</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                          เกณฑ์ออกช้ากว่ากำหนด (นาที)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={240}
                          disabled={!canEdit || editingTemplate.lateOutRule === 'ignore'}
                          value={editingTemplate.lateOutThresholdMinutes}
                          onChange={(e) =>
                            setEditingTemplate((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    lateOutThresholdMinutes: Math.max(0, parseInt(e.target.value, 10) || 0),
                                  }
                                : prev
                            )
                          }
                          className="w-full h-[34px] px-2.5 rounded-[8px] bg-white border border-[#D4E4E3] text-xs font-mono tabular-nums disabled:opacity-45"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                          ระยะเวลาล่วงเวลาขั้นต่ำ (นาที)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={240}
                          disabled={!canEdit || editingTemplate.lateOutRule === 'ignore'}
                          value={editingTemplate.lateOutMinOtMinutes}
                          onChange={(e) =>
                            setEditingTemplate((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    lateOutMinOtMinutes: Math.max(0, parseInt(e.target.value, 10) || 0),
                                  }
                                : prev
                            )
                          }
                          className="w-full h-[34px] px-2.5 rounded-[8px] bg-white border border-[#D4E4E3] text-xs font-mono tabular-nums disabled:opacity-45"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Rounding Mode (Actual vs Step) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                        วิธีคำนวณเวลาล่วงเวลา
                      </label>
                      <select
                        disabled={!canEdit}
                        value={editingTemplate.otCalculationMode}
                        onChange={(e) =>
                          setEditingTemplate((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  otCalculationMode: e.target.value as OvertimeCalculationMode,
                                }
                              : prev
                          )
                        }
                        className={`${STANDARD_NATIVE_SELECT_CLASS} w-full h-[36px] text-xs`}
                      >
                        <option value="actual">แสดงตามเวลาจริงเมื่อถึงขั้นต่ำ</option>
                        <option value="step">ปัดรอบลงทุกๆ X นาที</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                        คิดโอทีทุกๆ กี่นาที (โหมดปัดรอบ / 0 = ปิด OT)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={240}
                        step={5}
                        disabled={!canEdit}
                        value={editingTemplate.otStepMinutes}
                        onChange={(e) =>
                          setEditingTemplate((prev) =>
                            prev
                              ? { ...prev, otStepMinutes: Math.max(0, parseInt(e.target.value, 10) || 0) }
                              : prev
                          )
                        }
                        className="w-full h-[36px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-xs font-mono tabular-nums"
                      />
                    </div>
                  </div>

                  {/* Explanatory Box matching Screenshot 2 */}
                  <div className="p-3 rounded-xl bg-[#F0F5F4] border border-[#D4E4E3] text-[11px] text-[#6B8F8E] space-y-1 leading-relaxed">
                    <p className="font-semibold text-[#2D4A49]">
                      {editingTemplate.otCalculationMode === 'actual'
                        ? `ตัวอย่าง (โหมดเวลาจริง · ขั้นต่ำ ${editingTemplate.lateOutMinOtMinutes} นาที · ${getOtTypeLabel(editingTemplate.otMultiplier)}):`
                        : `ตัวอย่าง (โหมดปัดรอบทุก ${editingTemplate.otStepMinutes} นาที · ${getOtTypeLabel(editingTemplate.otMultiplier)}):`}
                    </p>
                    {editingTemplate.otCalculationMode === 'actual' ? (
                      <>
                        <p>
                          1) หากลงเวลาล่วงเวลาจริงคือ {Math.max(0, editingTemplate.lateOutMinOtMinutes - 1)} นาที จะไม่คำนวณล่วงเวลา
                        </p>
                        <p>
                          2) หากลงเวลาล่วงเวลาจริงคือ {editingTemplate.lateOutMinOtMinutes} นาที จะคำนวณล่วงเวลาเป็น {editingTemplate.lateOutMinOtMinutes} นาที
                        </p>
                        <p>
                          3) หากลงเวลาล่วงเวลาจริงคือ {editingTemplate.lateOutMinOtMinutes + 2} นาที จะคำนวณล่วงเวลาเป็น {editingTemplate.lateOutMinOtMinutes + 2} นาที ({getOtTypeLabel(editingTemplate.otMultiplier)})
                        </p>
                      </>
                    ) : (
                      <p>
                        หากลงเวลาเกิน {Math.max(editingTemplate.lateOutMinOtMinutes, editingTemplate.otStepMinutes)} นาที ระบบจะปัดลงเป็นรอบทุกๆ {editingTemplate.otStepMinutes} นาที ({getOtTypeLabel(editingTemplate.otMultiplier)})
                      </p>
                    )}
                  </div>
                </div>
              )}

              {templateModalTab === 'advanced' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                        อนุโลมสายได้ (นาที)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={120}
                        disabled={!canEdit}
                        value={editingTemplate.graceMinutes}
                        onChange={(e) =>
                          setEditingTemplate((prev) =>
                            prev
                              ? { ...prev, graceMinutes: Math.max(0, parseInt(e.target.value, 10) || 0) }
                              : prev
                          )
                        }
                        className="w-full h-[36px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-xs font-mono tabular-nums text-[#2D4A49]"
                      />
                      <p className="text-[10px] text-[#6B8F8E] mt-1">
                        หากสแกนเข้างานเกินเวลาเช็คอิน + นาทีอนุโลมสาย ระบบจะบันทึกสถานะเป็น &quot;มาสาย&quot;
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                        สีป้ายกำกับตารางเวลา
                      </label>
                      <div className="flex items-center gap-2 pt-1">
                        {['#5A8A88', '#2D4A49', '#0EA5E9', '#D97706', '#E11D48', '#7C3AED'].map(
                          (clr) => (
                            <button
                              key={clr}
                              type="button"
                              disabled={!canEdit}
                              onClick={() =>
                                setEditingTemplate((prev) => (prev ? { ...prev, color: clr } : prev))
                              }
                              className={`w-7 h-7 rounded-full border-2 cursor-pointer transition-transform ${
                                editingTemplate.color === clr
                                  ? 'border-slate-900 scale-110'
                                  : 'border-white shadow-xs'
                              }`}
                              style={{ backgroundColor: clr }}
                            />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-[#F8FCFC] border-t border-[#E8F3F2] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingTemplate(null)}
                className="h-[34px] px-3.5 rounded-[8px] bg-white border border-[#D4E4E3] text-xs font-medium text-[#6B8F8E] cursor-pointer"
              >
                ปิด
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={handleSaveTemplateModal}
                  className="h-[34px] px-4 rounded-[8px] bg-[#2D4A49] hover:bg-[#203635] text-white text-xs font-semibold cursor-pointer"
                >
                  ตกลง (อัปเดตตารางเวลา)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* MODAL 2: WEEKLY SCHEDULE (MON - SUN) FOR AN EMPLOYEE */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {weeklyModalEmp && (() => {
        const empEntry = getEmployeeEntry(weeklyModalEmp);
        const weekly = empEntry.weeklySchedule || {};
        const defaultTplId = templates[0]?.id || 'BRANCH_DEFAULT';

        const applyQuickWeek = (mode: 'mon_fri' | 'mon_sat') => {
          const targetTpl = empEntry.shiftTemplateId || defaultTplId;
          mutateEmployeeShift(weeklyModalEmp, (cur) => ({
            ...cur,
            assignmentMode: 'weekly',
            weeklySchedule: {
              mon: targetTpl,
              tue: targetTpl,
              wed: targetTpl,
              thu: targetTpl,
              fri: targetTpl,
              sat: mode === 'mon_sat' ? targetTpl : 'OFF',
              sun: 'OFF',
            },
          }));
        };

        return (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4"
            onClick={() => setWeeklyModalEmp(null)}
          >
            <div
              className="w-full max-w-lg bg-white rounded-2xl border border-[#D4E4E3] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-3.5 bg-[#2D4A49] text-white flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold">
                    จัดตารางกะงานรายวัน (จ.–อา.) · {weeklyModalEmp.name}
                  </h3>
                  <p className="text-[11px] text-[#D4E4E3]">
                    {weeklyModalEmp.role} — กำหนดกะงานแยกแต่ละวัน หรือตั้งวันหยุดประจำสัปดาห์
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWeeklyModalEmp(null)}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-3">
                {canEdit && (
                  <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-[#E8F3F2]">
                    <span className="text-[11px] font-semibold text-[#6B8F8E]">ตั้งค่าด่วน:</span>
                    <button
                      type="button"
                      onClick={() => applyQuickWeek('mon_fri')}
                      className="h-[28px] px-2.5 rounded-[6px] bg-[#E8F3F2] hover:bg-[#D8EAE8] text-[#2D4A49] text-[10.5px] font-semibold cursor-pointer"
                    >
                      จันทร์–ศุกร์ (หยุด ส.-อา.)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyQuickWeek('mon_sat')}
                      className="h-[28px] px-2.5 rounded-[6px] bg-[#E8F3F2] hover:bg-[#D8EAE8] text-[#2D4A49] text-[10.5px] font-semibold cursor-pointer"
                    >
                      จันทร์–เสาร์ (หยุด อา.)
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  {DAY_OF_WEEK_LIST.map((day) => {
                    const currentVal = weekly[day.key] || defaultTplId;
                    return (
                      <div
                        key={day.key}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#F8FCFC] border border-[#D4E4E3]"
                      >
                        <span className="text-xs font-bold text-[#2D4A49] w-24">
                          วัน{day.label}
                        </span>
                        <select
                          disabled={!canEdit}
                          value={currentVal}
                          onChange={(e) => {
                            const val = e.target.value;
                            mutateEmployeeShift(weeklyModalEmp, (cur) => ({
                              ...cur,
                              assignmentMode: 'weekly',
                              weeklySchedule: {
                                ...(cur.weeklySchedule || {}),
                                [day.key]: val,
                              },
                            }));
                          }}
                          className={`${STANDARD_NATIVE_SELECT_CLASS} flex-1 h-[32px] text-xs`}
                        >
                          <option value="OFF">วันหยุดประจำสัปดาห์ (OFF — หากมาทำคิดเป็น OT)</option>
                          <option value="BRANCH_DEFAULT">ใช้ค่าเริ่มต้นสาขา ({draft.shiftStartTime}–{draft.shiftEndTime})</option>
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.checkInTime}–{t.checkOutTime} · {getOtTypeLabel(t.otMultiplier)})
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-[#E8F3F2] flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold text-[#2D4A49]">
                    ชนิด OT หากมาทำงานในวันหยุด (OFF):
                  </span>
                  <select
                    disabled={!canEdit}
                    value={String(empEntry.dayOffOtMultiplier ?? 2)}
                    onChange={(e) =>
                      mutateEmployeeShift(weeklyModalEmp, (cur) => ({
                        ...cur,
                        dayOffOtMultiplier: normalizeOtMultiplier(e.target.value, 2),
                      }))
                    }
                    className={`${STANDARD_NATIVE_SELECT_CLASS} h-[32px] text-xs`}
                  >
                    <option value="1.5">OT 1.5 เท่า</option>
                    <option value="2">OT 2 เท่า</option>
                    <option value="3">OT 3 เท่า</option>
                  </select>
                </div>
              </div>

              <div className="px-5 py-3 bg-[#F8FCFC] border-t border-[#E8F3F2] flex justify-end">
                <button
                  type="button"
                  onClick={() => setWeeklyModalEmp(null)}
                  className="h-[34px] px-4 rounded-[8px] bg-[#2D4A49] hover:bg-[#203635] text-white text-xs font-semibold cursor-pointer"
                >
                  เสร็จสิ้น
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default ShiftSettings;
