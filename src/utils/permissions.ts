export type PagePermission = 'read' | 'edit' | 'hidden';

export type PagePermKey =
  | 'dashboard'
  | 'leaveDashboard'
  | 'personnelLeave'
  | 'leaveHistory'
  | 'dailySales'
  | 'dailyBakery'
  | 'bar_stock'
  | 'bar_receiving'
  | 'bar_stockcount'
  | 'bar_waste'
  | 'bar_checkin'
  | 'bar_coffeeWaste'
  | 'kitchen_stock'
  | 'kitchen_receiving'
  | 'kitchen_stockcount'
  | 'kitchen_waste'
  | 'kitchen_checkin'
  | 'bakeryPlan'
  | 'purchasing'
  | 'orderedItems'
  | 'rndReport'
  | 'maintenanceReport'
  | 'history_edit'
  | 'history_checkin'
  | 'history_stock'
  | 'history_receiving'
  | 'history_bakery'
  | 'userSettings'
  | 'prodcalc'
  | 'prodcalc_ingredients'
  | 'prodcalc_recipes'
  | 'prodcalc_reports'
  | 'hellocrenn'
  | 'hellocrenn_dashboard'
  | 'hellocrenn_scan'
  | 'hellocrenn_history'
  | 'hellocrenn_settings'
  | 'leaveportal';

export interface UserPermissions {
  // General
  dashboard: PagePermission;
  leaveDashboard: PagePermission;
  personnelLeave: PagePermission;
  leaveHistory: PagePermission;
  dailySales: PagePermission;
  dailyBakery: PagePermission;

  // บาร์ (Bar)
  bar_stock: PagePermission;
  bar_receiving: PagePermission;
  bar_stockcount: PagePermission;
  bar_waste: PagePermission;
  bar_checkin: PagePermission;
  bar_coffeeWaste: PagePermission;

  // ครัว (Kitchen/Bakery)
  kitchen_stock: PagePermission;
  kitchen_receiving: PagePermission;
  kitchen_stockcount: PagePermission;
  kitchen_waste: PagePermission;
  kitchen_checkin: PagePermission;
  bakeryPlan: PagePermission;

  // รายงานรวม
  purchasing: PagePermission;
  orderedItems: PagePermission;
  rndReport: PagePermission;
  maintenanceReport: PagePermission;

  // ประวัติ
  history_edit: PagePermission;
  history_checkin: PagePermission;
  history_stock: PagePermission;
  history_receiving: PagePermission;
  history_bakery: PagePermission;

  // Admin
  userSettings: PagePermission;
  canEditDateRange: boolean;

  // Add-ons / Sub-apps (ProdCalc & Hello, Crenn)
  prodcalc: PagePermission;
  prodcalc_ingredients: PagePermission;
  prodcalc_recipes: PagePermission;
  prodcalc_reports: PagePermission;
  hellocrenn: PagePermission;
  hellocrenn_dashboard: PagePermission;
  hellocrenn_scan: PagePermission;
  hellocrenn_history: PagePermission;
  hellocrenn_settings: PagePermission;
  leaveportal: PagePermission;

  [key: string]: any;
}

export type RoleTemplateMap = Record<string, UserPermissions>;

export const applyRoleDefaults = (role: string): UserPermissions => {
  const r = (role || '').toUpperCase().trim();
  if (r === 'CO-FOUNDER' || r === 'COFOUNDER' || r === 'ADMIN' || r === 'OWNER') {
    return {
      dashboard: 'edit',
      leaveDashboard: 'edit',
      personnelLeave: 'edit',
      leaveHistory: 'edit',
      dailySales: 'edit',
      dailyBakery: 'edit',
      bar_stock: 'edit',
      bar_receiving: 'edit',
      bar_stockcount: 'edit',
      bar_waste: 'edit',
      bar_checkin: 'edit',
      bar_coffeeWaste: 'edit',
      kitchen_stock: 'edit',
      kitchen_receiving: 'edit',
      kitchen_stockcount: 'edit',
      kitchen_waste: 'edit',
      kitchen_checkin: 'edit',
      bakeryPlan: 'edit',
      purchasing: 'edit',
      orderedItems: 'edit',
      rndReport: 'edit',
      maintenanceReport: 'edit',
      history_edit: 'edit',
      history_checkin: 'edit',
      history_stock: 'edit',
      history_receiving: 'edit',
      history_bakery: 'edit',
      userSettings: 'edit',
      canEditDateRange: true,
      prodcalc: 'edit',
      prodcalc_ingredients: 'edit',
      prodcalc_recipes: 'edit',
      prodcalc_reports: 'edit',
      hellocrenn: 'edit',
      hellocrenn_dashboard: 'edit',
      hellocrenn_scan: 'edit',
      hellocrenn_history: 'edit',
      hellocrenn_settings: 'edit',
      leaveportal: 'edit',
    };
  }
  if (r === 'BRANCH MANAGER' || r === 'BRANCHMANAGER') {
    return {
      dashboard: 'edit',
      leaveDashboard: 'edit',
      personnelLeave: 'edit',
      leaveHistory: 'edit',
      dailySales: 'edit',
      dailyBakery: 'edit',
      bar_stock: 'edit',
      bar_receiving: 'edit',
      bar_stockcount: 'edit',
      bar_waste: 'edit',
      bar_checkin: 'edit',
      bar_coffeeWaste: 'edit',
      kitchen_stock: 'edit',
      kitchen_receiving: 'edit',
      kitchen_stockcount: 'edit',
      kitchen_waste: 'edit',
      kitchen_checkin: 'edit',
      bakeryPlan: 'edit',
      purchasing: 'edit',
      orderedItems: 'edit',
      rndReport: 'edit',
      maintenanceReport: 'edit',
      history_edit: 'edit',
      history_checkin: 'edit',
      history_stock: 'edit',
      history_receiving: 'edit',
      history_bakery: 'edit',
      userSettings: 'hidden',
      canEditDateRange: false,
      prodcalc: 'hidden',
      prodcalc_ingredients: 'hidden',
      prodcalc_recipes: 'hidden',
      prodcalc_reports: 'hidden',
      hellocrenn: 'edit',
      hellocrenn_dashboard: 'hidden',
      hellocrenn_scan: 'edit',
      hellocrenn_history: 'edit',
      hellocrenn_settings: 'edit',
      leaveportal: 'edit',
    };
  }
  if (r === 'SENIOR BAKER' || r === 'HEAD BAKER') {
    return {
      dashboard: 'read',
      leaveDashboard: 'read',
      personnelLeave: 'edit',
      leaveHistory: 'read',
      dailySales: 'hidden',
      dailyBakery: 'edit',
      bar_stock: 'hidden',
      bar_receiving: 'hidden',
      bar_stockcount: 'hidden',
      bar_waste: 'hidden',
      bar_checkin: 'hidden',
      bar_coffeeWaste: 'hidden',
      kitchen_stock: 'edit',
      kitchen_receiving: 'edit',
      kitchen_stockcount: 'edit',
      kitchen_waste: 'edit',
      kitchen_checkin: 'edit',
      bakeryPlan: 'edit',
      purchasing: 'read',
      orderedItems: 'read',
      rndReport: 'edit',
      maintenanceReport: 'read',
      history_edit: 'read',
      history_checkin: 'read',
      history_stock: 'read',
      history_receiving: 'read',
      history_bakery: 'read',
      userSettings: 'hidden',
      canEditDateRange: false,
      prodcalc: 'hidden',
      prodcalc_ingredients: 'hidden',
      prodcalc_recipes: 'hidden',
      prodcalc_reports: 'hidden',
      hellocrenn: 'edit',
      hellocrenn_dashboard: 'hidden',
      hellocrenn_scan: 'edit',
      hellocrenn_history: 'read',
      hellocrenn_settings: 'hidden',
      leaveportal: 'edit',
    };
  }
  if (r === 'BARISTA' || r === 'BARISTA ASSISTANCE' || r === 'BARISTA ASSISTANT') {
    return {
      dashboard: 'read',
      leaveDashboard: 'read',
      personnelLeave: 'edit',
      leaveHistory: 'read',
      dailySales: 'hidden',
      dailyBakery: 'read',
      bar_stock: 'edit',
      bar_receiving: 'edit',
      bar_stockcount: 'edit',
      bar_waste: 'edit',
      bar_checkin: 'edit',
      bar_coffeeWaste: 'edit',
      kitchen_stock: 'hidden',
      kitchen_receiving: 'hidden',
      kitchen_stockcount: 'hidden',
      kitchen_waste: 'hidden',
      kitchen_checkin: 'hidden',
      bakeryPlan: 'hidden',
      purchasing: 'read',
      orderedItems: 'read',
      rndReport: 'read',
      maintenanceReport: 'read',
      history_edit: 'read',
      history_checkin: 'read',
      history_stock: 'read',
      history_receiving: 'read',
      history_bakery: 'hidden',
      userSettings: 'hidden',
      canEditDateRange: false,
      prodcalc: 'hidden',
      prodcalc_ingredients: 'hidden',
      prodcalc_recipes: 'hidden',
      prodcalc_reports: 'hidden',
      hellocrenn: 'edit',
      hellocrenn_dashboard: 'hidden',
      hellocrenn_scan: 'edit',
      hellocrenn_history: 'read',
      hellocrenn_settings: 'hidden',
      leaveportal: 'edit',
    };
  }
  // BAKER / JUNIOR BAKER / STAFF / CASHIER / SERVER / CLEANER / custom roles fallback:
  return {
    dashboard: 'read',
    leaveDashboard: 'read',
    personnelLeave: 'edit',
    leaveHistory: 'read',
    dailySales: 'hidden',
    dailyBakery: 'read',
    bar_stock: 'hidden',
    bar_receiving: 'hidden',
    bar_stockcount: 'hidden',
    bar_waste: 'hidden',
    bar_checkin: 'hidden',
    bar_coffeeWaste: 'hidden',
    kitchen_stock: 'read',
    kitchen_receiving: 'read',
    kitchen_stockcount: 'read',
    kitchen_waste: 'read',
    kitchen_checkin: 'read',
    bakeryPlan: 'read',
    purchasing: 'hidden',
    orderedItems: 'hidden',
    rndReport: 'hidden',
    maintenanceReport: 'read',
    history_edit: 'read',
    history_checkin: 'read',
    history_stock: 'read',
    history_receiving: 'read',
    history_bakery: 'read',
    userSettings: 'hidden',
    canEditDateRange: false,
    prodcalc: 'hidden',
    prodcalc_ingredients: 'hidden',
    prodcalc_recipes: 'hidden',
    prodcalc_reports: 'hidden',
    hellocrenn: 'edit',
    hellocrenn_dashboard: 'hidden',
    hellocrenn_scan: 'edit',
    hellocrenn_history: 'read',
    hellocrenn_settings: 'hidden',
    leaveportal: 'edit',
  };
};

const toLevel = (val: any, fallback: PagePermission): PagePermission => {
  if (val === 'edit' || val === 'Edit') return 'edit';
  if (val === 'read' || val === 'Read' || val === 'Review') return 'read';
  if (val === 'hidden' || val === 'Hidden') return 'hidden';
  return fallback;
};

export const normalizePermissions = (
  raw: any,
  role: string,
  customDefaults?: UserPermissions | Partial<UserPermissions>
): UserPermissions => {
  const baseDefaults = applyRoleDefaults(role);
  const defaults: UserPermissions = customDefaults
    ? {
        ...baseDefaults,
        ...customDefaults,
        dashboard: toLevel(customDefaults.dashboard, baseDefaults.dashboard),
        leaveDashboard: toLevel(customDefaults.leaveDashboard, baseDefaults.leaveDashboard),
        personnelLeave: toLevel(customDefaults.personnelLeave, baseDefaults.personnelLeave),
        leaveHistory: toLevel(
          customDefaults.leaveHistory !== undefined
            ? customDefaults.leaveHistory
            : customDefaults.leaveDashboard,
          baseDefaults.leaveHistory
        ),
        dailySales: toLevel(customDefaults.dailySales, baseDefaults.dailySales),
        dailyBakery: toLevel(customDefaults.dailyBakery, baseDefaults.dailyBakery),
        bar_stock: toLevel(customDefaults.bar_stock, baseDefaults.bar_stock),
        bar_receiving: toLevel(customDefaults.bar_receiving, baseDefaults.bar_receiving),
        bar_stockcount: toLevel(customDefaults.bar_stockcount, baseDefaults.bar_stockcount),
        bar_waste: toLevel(customDefaults.bar_waste, baseDefaults.bar_waste),
        bar_checkin: toLevel(customDefaults.bar_checkin, baseDefaults.bar_checkin),
        bar_coffeeWaste: toLevel(customDefaults.bar_coffeeWaste, baseDefaults.bar_coffeeWaste),
        kitchen_stock: toLevel(customDefaults.kitchen_stock, baseDefaults.kitchen_stock),
        kitchen_receiving: toLevel(customDefaults.kitchen_receiving, baseDefaults.kitchen_receiving),
        kitchen_stockcount: toLevel(customDefaults.kitchen_stockcount, baseDefaults.kitchen_stockcount),
        kitchen_waste: toLevel(customDefaults.kitchen_waste, baseDefaults.kitchen_waste),
        kitchen_checkin: toLevel(customDefaults.kitchen_checkin, baseDefaults.kitchen_checkin),
        bakeryPlan: toLevel(customDefaults.bakeryPlan, baseDefaults.bakeryPlan),
        purchasing: toLevel(customDefaults.purchasing, baseDefaults.purchasing),
        orderedItems: toLevel(
          customDefaults.orderedItems !== undefined ? customDefaults.orderedItems : customDefaults.purchasing,
          baseDefaults.orderedItems
        ),
        rndReport: toLevel(customDefaults.rndReport, baseDefaults.rndReport),
        maintenanceReport: toLevel(customDefaults.maintenanceReport, baseDefaults.maintenanceReport),
        history_edit: toLevel(customDefaults.history_edit, baseDefaults.history_edit),
        history_checkin: toLevel(customDefaults.history_checkin, baseDefaults.history_checkin),
        history_stock: toLevel(customDefaults.history_stock, baseDefaults.history_stock),
        history_receiving: toLevel(customDefaults.history_receiving, baseDefaults.history_receiving),
        history_bakery: toLevel(customDefaults.history_bakery, baseDefaults.history_bakery),
        userSettings: toLevel(customDefaults.userSettings, baseDefaults.userSettings),
        canEditDateRange:
          typeof customDefaults.canEditDateRange === 'boolean'
            ? customDefaults.canEditDateRange
            : baseDefaults.canEditDateRange,
        prodcalc: toLevel(customDefaults.prodcalc, baseDefaults.prodcalc),
        prodcalc_ingredients: toLevel(
          customDefaults.prodcalc_ingredients !== undefined ? customDefaults.prodcalc_ingredients : customDefaults.prodcalc,
          baseDefaults.prodcalc_ingredients
        ),
        prodcalc_recipes: toLevel(
          customDefaults.prodcalc_recipes !== undefined ? customDefaults.prodcalc_recipes : customDefaults.prodcalc,
          baseDefaults.prodcalc_recipes
        ),
        prodcalc_reports: toLevel(
          customDefaults.prodcalc_reports !== undefined ? customDefaults.prodcalc_reports : customDefaults.prodcalc,
          baseDefaults.prodcalc_reports
        ),
        hellocrenn: toLevel(customDefaults.hellocrenn, baseDefaults.hellocrenn),
        hellocrenn_dashboard: toLevel(
          customDefaults.hellocrenn_dashboard !== undefined
            ? customDefaults.hellocrenn_dashboard
            : customDefaults.hellocrenn === 'hidden'
              ? 'hidden'
              : undefined,
          baseDefaults.hellocrenn_dashboard
        ),
        hellocrenn_scan: toLevel(
          customDefaults.hellocrenn_scan !== undefined ? customDefaults.hellocrenn_scan : customDefaults.hellocrenn,
          baseDefaults.hellocrenn_scan
        ),
        hellocrenn_history: toLevel(
          customDefaults.hellocrenn_history !== undefined
            ? customDefaults.hellocrenn_history
            : customDefaults.hellocrenn === 'hidden'
              ? 'hidden'
              : undefined,
          baseDefaults.hellocrenn_history
        ),
        hellocrenn_settings: toLevel(
          customDefaults.hellocrenn_settings !== undefined
            ? customDefaults.hellocrenn_settings
            : customDefaults.hellocrenn === 'hidden'
              ? 'hidden'
              : undefined,
          baseDefaults.hellocrenn_settings
        ),
        leaveportal: toLevel(
          customDefaults.leaveportal !== undefined
            ? customDefaults.leaveportal
            : customDefaults.leaveDashboard === 'hidden' && customDefaults.personnelLeave === 'hidden'
              ? 'hidden'
              : undefined,
          baseDefaults.leaveportal
        ),
      }
    : baseDefaults;

  if (!raw) return defaults;
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return defaults;
    }
  }
  if (typeof parsed !== 'object' || parsed === null) return defaults;

  return {
    dashboard: toLevel(
      parsed.dashboard !== undefined ? parsed.dashboard : parsed.dashboardBar || parsed.dashboardBakery,
      defaults.dashboard
    ),
    leaveDashboard: toLevel(parsed.leaveDashboard, defaults.leaveDashboard),
    personnelLeave: toLevel(parsed.personnelLeave, defaults.personnelLeave),
    leaveHistory: toLevel(
      parsed.leaveHistory !== undefined
        ? parsed.leaveHistory
        : parsed.leaveDashboard,
      defaults.leaveHistory
    ),
    dailySales: toLevel(
      parsed.dailySales !== undefined ? parsed.dailySales : parsed.dailyRecord,
      defaults.dailySales
    ),
    dailyBakery: toLevel(
      parsed.dailyBakery !== undefined ? parsed.dailyBakery : parsed.dailyRecord,
      defaults.dailyBakery
    ),

    bar_stock: toLevel(
      parsed.bar_stock !== undefined ? parsed.bar_stock : parsed.stockTableBar,
      defaults.bar_stock
    ),
    bar_receiving: toLevel(
      parsed.bar_receiving !== undefined ? parsed.bar_receiving : parsed.barReceiving,
      defaults.bar_receiving
    ),
    bar_stockcount: toLevel(
      parsed.bar_stockcount !== undefined ? parsed.bar_stockcount : parsed.dailyStockCountBar,
      defaults.bar_stockcount
    ),
    bar_waste: toLevel(
      parsed.bar_waste !== undefined ? parsed.bar_waste : parsed.wasteReport,
      defaults.bar_waste
    ),
    bar_checkin: toLevel(
      parsed.bar_checkin !== undefined ? parsed.bar_checkin : parsed.checklistsBar,
      defaults.bar_checkin
    ),
    bar_coffeeWaste: toLevel(
      parsed.bar_coffeeWaste !== undefined ? parsed.bar_coffeeWaste : parsed.historyWaste,
      defaults.bar_coffeeWaste
    ),

    kitchen_stock: toLevel(
      parsed.kitchen_stock !== undefined ? parsed.kitchen_stock : parsed.stockTableBakery,
      defaults.kitchen_stock
    ),
    kitchen_receiving: toLevel(
      parsed.kitchen_receiving !== undefined ? parsed.kitchen_receiving : parsed.bakeryReceiving,
      defaults.kitchen_receiving
    ),
    kitchen_stockcount: toLevel(
      parsed.kitchen_stockcount !== undefined ? parsed.kitchen_stockcount : parsed.dailyStockCountBakery,
      defaults.kitchen_stockcount
    ),
    kitchen_waste: toLevel(
      parsed.kitchen_waste !== undefined ? parsed.kitchen_waste : parsed.wasteReport,
      defaults.kitchen_waste
    ),
    kitchen_checkin: toLevel(
      parsed.kitchen_checkin !== undefined ? parsed.kitchen_checkin : parsed.checklistsBakery,
      defaults.kitchen_checkin
    ),
    bakeryPlan: toLevel(parsed.bakeryPlan, defaults.bakeryPlan),

    purchasing: toLevel(
      parsed.purchasing !== undefined ? parsed.purchasing : parsed.purchasingReport,
      defaults.purchasing
    ),
    orderedItems: toLevel(
      parsed.orderedItems !== undefined
        ? parsed.orderedItems
        : parsed.purchasing !== undefined
          ? parsed.purchasing
          : parsed.purchasingReport,
      defaults.orderedItems
    ),
    rndReport: toLevel(parsed.rndReport, defaults.rndReport),
    maintenanceReport: toLevel(parsed.maintenanceReport, defaults.maintenanceReport),

    history_edit: toLevel(
      parsed.history_edit !== undefined ? parsed.history_edit : parsed.historyLogs,
      defaults.history_edit
    ),
    history_checkin: toLevel(
      parsed.history_checkin !== undefined ? parsed.history_checkin : parsed.historyChecklist,
      defaults.history_checkin
    ),
    history_stock: toLevel(
      parsed.history_stock !== undefined ? parsed.history_stock : parsed.historyLogs,
      defaults.history_stock
    ),
    history_receiving: toLevel(
      parsed.history_receiving !== undefined ? parsed.history_receiving : parsed.historyReceiving,
      defaults.history_receiving
    ),
    history_bakery: toLevel(
      parsed.history_bakery !== undefined ? parsed.history_bakery : parsed.historyBakery,
      defaults.history_bakery
    ),

    userSettings: toLevel(
      parsed.userSettings !== undefined ? parsed.userSettings : parsed.adminTools,
      defaults.userSettings
    ),
    canEditDateRange:
      typeof parsed.canEditDateRange === 'boolean' ? parsed.canEditDateRange : defaults.canEditDateRange,
    prodcalc: toLevel(
      parsed.prodcalc !== undefined ? parsed.prodcalc : parsed.ProdCalc || parsed.prodCalc,
      defaults.prodcalc || 'hidden'
    ),
    prodcalc_ingredients: toLevel(
      parsed.prodcalc_ingredients !== undefined
        ? parsed.prodcalc_ingredients
        : parsed.prodcalc !== undefined
          ? parsed.prodcalc
          : parsed.ProdCalc || parsed.prodCalc,
      defaults.prodcalc_ingredients || 'hidden'
    ),
    prodcalc_recipes: toLevel(
      parsed.prodcalc_recipes !== undefined
        ? parsed.prodcalc_recipes
        : parsed.prodcalc !== undefined
          ? parsed.prodcalc
          : parsed.ProdCalc || parsed.prodCalc,
      defaults.prodcalc_recipes || 'hidden'
    ),
    prodcalc_reports: toLevel(
      parsed.prodcalc_reports !== undefined
        ? parsed.prodcalc_reports
        : parsed.prodcalc !== undefined
          ? parsed.prodcalc
          : parsed.ProdCalc || parsed.prodCalc,
      defaults.prodcalc_reports || 'hidden'
    ),
    hellocrenn: toLevel(
      parsed.hellocrenn !== undefined ? parsed.hellocrenn : parsed.helloCrenn,
      defaults.hellocrenn || 'edit'
    ),
    hellocrenn_dashboard: toLevel(
      parsed.hellocrenn_dashboard !== undefined
        ? parsed.hellocrenn_dashboard
        : parsed.hellocrenn === 'hidden' || parsed.helloCrenn === 'hidden'
          ? 'hidden'
          : undefined,
      defaults.hellocrenn_dashboard || 'hidden'
    ),
    hellocrenn_scan: toLevel(
      parsed.hellocrenn_scan !== undefined
        ? parsed.hellocrenn_scan
        : parsed.hellocrenn !== undefined
          ? parsed.hellocrenn
          : parsed.helloCrenn,
      defaults.hellocrenn_scan || 'edit'
    ),
    hellocrenn_history: toLevel(
      parsed.hellocrenn_history !== undefined
        ? parsed.hellocrenn_history
        : parsed.hellocrenn === 'hidden' || parsed.helloCrenn === 'hidden'
          ? 'hidden'
          : parsed.hellocrenn === 'read' || parsed.helloCrenn === 'read'
            ? 'read'
            : undefined,
      defaults.hellocrenn_history || 'read'
    ),
    hellocrenn_settings: toLevel(
      parsed.hellocrenn_settings !== undefined
        ? parsed.hellocrenn_settings
        : parsed.hellocrenn === 'hidden' || parsed.helloCrenn === 'hidden'
          ? 'hidden'
          : undefined,
      defaults.hellocrenn_settings || 'hidden'
    ),
    leaveportal: toLevel(
      parsed.leaveportal !== undefined
        ? parsed.leaveportal
        : parsed.leavePortal !== undefined
          ? parsed.leavePortal
          : parsed.leaveDashboard === 'hidden' && parsed.personnelLeave === 'hidden'
            ? 'hidden'
            : undefined,
      defaults.leaveportal || 'edit'
    ),
  };
};

export const buildSavePermissions = (perms: UserPermissions) => {
  const toLegacy = (lvl: PagePermission) =>
    lvl === 'edit' ? 'Edit' : lvl === 'read' ? 'Review' : 'Hidden';
  return {
    ...perms,
    dashboard: perms.dashboard,
    leaveDashboard: perms.leaveDashboard,
    personnelLeave: perms.personnelLeave,
    leaveHistory: perms.leaveHistory,
    dailySales: perms.dailySales,
    dailyBakery: perms.dailyBakery,
    bar_stock: perms.bar_stock,
    bar_receiving: perms.bar_receiving,
    bar_stockcount: perms.bar_stockcount,
    bar_waste: perms.bar_waste,
    bar_checkin: perms.bar_checkin,
    bar_coffeeWaste: perms.bar_coffeeWaste,
    kitchen_stock: perms.kitchen_stock,
    kitchen_receiving: perms.kitchen_receiving,
    kitchen_stockcount: perms.kitchen_stockcount,
    kitchen_waste: perms.kitchen_waste,
    kitchen_checkin: perms.kitchen_checkin,
    bakeryPlan: perms.bakeryPlan,
    purchasing: perms.purchasing,
    orderedItems: perms.orderedItems ?? perms.purchasing,
    rndReport: perms.rndReport,
    maintenanceReport: perms.maintenanceReport,
    history_edit: perms.history_edit,
    history_checkin: perms.history_checkin,
    history_stock: perms.history_stock,
    history_receiving: perms.history_receiving,
    history_bakery: perms.history_bakery,
    userSettings: perms.userSettings,
    canEditDateRange: !!perms.canEditDateRange,
    prodcalc: perms.prodcalc || 'hidden',
    prodcalc_ingredients: perms.prodcalc_ingredients ?? perms.prodcalc ?? 'hidden',
    prodcalc_recipes: perms.prodcalc_recipes ?? perms.prodcalc ?? 'hidden',
    prodcalc_reports: perms.prodcalc_reports ?? perms.prodcalc ?? 'hidden',
    hellocrenn: perms.hellocrenn || 'edit',
    hellocrenn_dashboard: perms.hellocrenn_dashboard ?? 'hidden',
    hellocrenn_scan: perms.hellocrenn_scan ?? perms.hellocrenn ?? 'edit',
    hellocrenn_history: perms.hellocrenn_history ?? 'read',
    hellocrenn_settings: perms.hellocrenn_settings ?? 'hidden',
    leaveportal: perms.leaveportal || 'edit',

    // Legacy fields for backward compatibility
    dailyRecord: perms.dailySales,
    dashboardBar: toLegacy(perms.dashboard),
    dashboardBakery: toLegacy(perms.dashboard),
    stockTableBar: toLegacy(perms.bar_stock),
    stockTableBakery: toLegacy(perms.kitchen_stock),
    barReceiving: toLegacy(perms.bar_receiving),
    bakeryReceiving: toLegacy(perms.kitchen_receiving),
    dailyStockCountBar: toLegacy(perms.bar_stockcount),
    dailyStockCountBakery: toLegacy(perms.kitchen_stockcount),
    checklistsBar: toLegacy(perms.bar_checkin),
    checklistsBakery: toLegacy(perms.kitchen_checkin),
    purchasingReport: toLegacy(perms.purchasing),
    historyLogs: toLegacy(perms.history_edit),
    historyChecklist: toLegacy(perms.history_checkin),
    historyWaste: toLegacy(perms.bar_coffeeWaste),
    historyReceiving: toLegacy(perms.history_receiving),
    historyBakery: toLegacy(perms.history_bakery),
    manageIngredients: perms.bar_stock === 'edit' || perms.kitchen_stock === 'edit' ? 'Edit' : 'Hidden',
    adminTools: toLegacy(perms.userSettings),
    ProdCalc: toLegacy(perms.prodcalc || 'hidden'),
  };
};

export const findRoleTemplate = (
  roleTemplates: Record<string, any> | undefined | null,
  role: string | undefined | null
): UserPermissions | undefined => {
  if (!roleTemplates || !role) return undefined;
  if (roleTemplates[role]) return roleTemplates[role];
  const target = role.trim().toLowerCase();
  const matchedKey = Object.keys(roleTemplates).find((k) => k.trim().toLowerCase() === target);
  return matchedKey ? roleTemplates[matchedKey] : undefined;
};

export const getCachedRoleTemplates = (branch?: string): Record<string, any> => {
  if (typeof window === 'undefined') return {};
  try {
    const keys = [
      branch ? `role_permissions_templates_${branch}` : null,
      'role_permissions_templates_GLOBAL',
      'role_permissions_templates',
    ].filter(Boolean) as string[];
    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    }
  } catch {}
  return {};
};

const LEGACY_KEY_MAP: Record<string, PagePermKey> = {
  dashboardBar: 'dashboard',
  dashboardBakery: 'dashboard',
  stockTableBar: 'bar_stock',
  stockTableBakery: 'kitchen_stock',
  barReceiving: 'bar_receiving',
  bakeryReceiving: 'kitchen_receiving',
  dailyStockCountBar: 'bar_stockcount',
  dailyStockCountBakery: 'kitchen_stockcount',
  checklistsBar: 'bar_checkin',
  checklistsBakery: 'kitchen_checkin',
  purchasingReport: 'purchasing',
  historyLogs: 'history_edit',
  historyChecklist: 'history_checkin',
  historyWaste: 'bar_coffeeWaste',
  historyReceiving: 'history_receiving',
  historyBakery: 'history_bakery',
  adminTools: 'userSettings',
  ProdCalc: 'prodcalc',
  prodCalc: 'prodcalc',
  dailyRecord: 'dailySales',
};

export interface PermissionUserLike {
  name?: string;
  role?: string | any;
  branch?: string;
  permissions?: any;
}

export const resolveEffectivePermissions = (
  user: PermissionUserLike | null | undefined,
  roleTemplates?: Record<string, any> | null
): UserPermissions => {
  if (!user) return applyRoleDefaults('Staff');
  const templates = roleTemplates && Object.keys(roleTemplates).length > 0
    ? roleTemplates
    : getCachedRoleTemplates(user.branch);
  const roleTemplate = findRoleTemplate(templates, String(user.role || ''));
  return normalizePermissions(user.permissions, String(user.role || ''), roleTemplate);
};

export const getPermissionLevel = (
  user: PermissionUserLike | null | undefined,
  key: PagePermKey | string,
  roleTemplates?: Record<string, any> | null
): PagePermission => {
  if (!user) return 'hidden';
  const canonicalKey = (LEGACY_KEY_MAP[key] || key) as PagePermKey;
  const effective = resolveEffectivePermissions(user, roleTemplates);
  return toLevel(effective[canonicalKey], 'hidden');
};

export const canViewPage = (
  user: PermissionUserLike | null | undefined,
  key: PagePermKey | string,
  roleTemplates?: Record<string, any> | null
): boolean => {
  return getPermissionLevel(user, key, roleTemplates) !== 'hidden';
};

export const canEditPage = (
  user: PermissionUserLike | null | undefined,
  key: PagePermKey | string,
  roleTemplates?: Record<string, any> | null
): boolean => {
  return getPermissionLevel(user, key, roleTemplates) === 'edit';
};

export const isReadOnlyPage = (
  user: PermissionUserLike | null | undefined,
  key: PagePermKey | string,
  roleTemplates?: Record<string, any> | null
): boolean => {
  return getPermissionLevel(user, key, roleTemplates) !== 'edit';
};

export const canEditDateRangePerm = (
  user: PermissionUserLike | null | undefined,
  roleTemplates?: Record<string, any> | null
): boolean => {
  if (!user) return false;
  return !!resolveEffectivePermissions(user, roleTemplates).canEditDateRange;
};

export const TAB_TO_PERMISSION: Record<string, PagePermKey> = {
  home: 'dashboard',
  dashboard: 'dashboard',
  leaveDashboard: 'leaveDashboard',
  personnelLeave: 'personnelLeave',
  leaveHistory: 'leaveHistory',
  dailySales: 'dailySales',
  dailyBakery: 'dailyBakery',
  barStock: 'bar_stock',
  barReceiving: 'bar_receiving',
  barDailyCount: 'bar_stockcount',
  barWasteLog: 'bar_waste',
  barChecklist: 'bar_checkin',
  barWaste: 'bar_coffeeWaste',
  bakeryStock: 'kitchen_stock',
  bakeryReceiving: 'kitchen_receiving',
  bakeryDailyCount: 'kitchen_stockcount',
  bakeryWasteLog: 'kitchen_waste',
  bakeryChecklist: 'kitchen_checkin',
  bakeryPlan: 'bakeryPlan',
  barPurchasing: 'purchasing',
  orderedItems: 'orderedItems',
  rndReport: 'rndReport',
  maintenanceReport: 'maintenanceReport',
  logs: 'history_edit',
  checklistHistory: 'history_checkin',
  stockSubmitHistory: 'history_stock',
  receivingHistory: 'history_receiving',
  bakeryPlanHistory: 'history_bakery',
  userSettings: 'userSettings',
  prodcalc: 'prodcalc',
  prodcalc_ingredients: 'prodcalc_ingredients',
  prodcalc_recipes: 'prodcalc_recipes',
  prodcalc_reports: 'prodcalc_reports',
  hellocrenn: 'hellocrenn',
  hellocrenn_dashboard: 'hellocrenn_dashboard',
  hellocrenn_scan: 'hellocrenn_scan',
  hellocrenn_history: 'hellocrenn_history',
  hellocrenn_settings: 'hellocrenn_settings',
  leaveportal: 'leaveportal',
};

export const canAccessTab = (
  user: PermissionUserLike | null | undefined,
  tab: string,
  roleTemplates?: Record<string, any> | null
): boolean => {
  if (!user) return false;
  if (tab === 'leaveRequest') {
    return (
      canEditPage(user, 'personnelLeave', roleTemplates) ||
      canEditPage(user, 'leaveDashboard', roleTemplates)
    );
  }
  const permKey = TAB_TO_PERMISSION[tab];
  if (!permKey) return true;
  return canViewPage(user, permKey, roleTemplates);
};

const ROUTE_PRIORITY: string[] = [
  'home',
  'barStock',
  'bakeryStock',
  'barDailyCount',
  'bakeryDailyCount',
  'barReceiving',
  'bakeryReceiving',
  'barChecklist',
  'bakeryChecklist',
  'dailySales',
  'dailyBakery',
  'bakeryPlan',
  'barPurchasing',
  'orderedItems',
  'barWasteLog',
  'bakeryWasteLog',
  'barWaste',
  'rndReport',
  'maintenanceReport',
  'logs',
  'stockSubmitHistory',
  'receivingHistory',
  'checklistHistory',
  'bakeryPlanHistory',
  'userSettings',
];

export const getFirstAccessibleRoute = (
  user: PermissionUserLike | null | undefined,
  roleTemplates?: Record<string, any> | null
): string => {
  if (!user) return 'home';
  for (const tab of ROUTE_PRIORITY) {
    if (canAccessTab(user, tab, roleTemplates)) {
      return tab;
    }
  }
  return 'home';
};
