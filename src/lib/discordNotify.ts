export interface DiscordNotifySettings {
  webhookUrl: string;
  enabled: boolean;
  // 1. หน้าหลัก (Home)
  notifyOnLeaveApproval: boolean;
  notifyOnLeaveRequest: boolean;
  // 2. Daily Rec.
  notifyOnDailySales: boolean;
  notifyOnDailyBakery: boolean;
  // 3. สต็อก (Stock)
  notifyOnBarStock: boolean;
  notifyOnBakeryStock: boolean;
  // 4. รายงาน (Reports)
  notifyOnBarReceiving: boolean;
  notifyOnBakeryReceiving: boolean;
  notifyOnBarDailyCount: boolean;
  notifyOnBakeryDailyCount: boolean;
  notifyOnBarWaste: boolean;
  notifyOnBakeryWaste: boolean;
  notifyOnCoffeeWaste: boolean;
  notifyOnMaintenance: boolean;
  // 5. Check-in
  notifyOnBarChecklist: boolean;
  notifyOnBakeryChecklist: boolean;
  // 6. Purchasing
  notifyOnPurchasing: boolean;
  notifyOnOrderedItems: boolean;
  // 7. Bakery
  notifyOnBakeryPlan: boolean;
  // 8. R&D
  notifyOnRnD: boolean;
  // 9. Sub-app: ProdCalc
  notifyOnProdCalcIngredients: boolean;
  notifyOnProdCalcRecipes: boolean;
  // 10. Sub-app: Hello, Crenn
  notifyOnHelloCrennCheckin: boolean;
  notifyOnHelloCrennGeofence: boolean;
  // Legacy keys kept optional for seamless migration of previously saved configs
  notifyOnWaste?: boolean;
  notifyOnStockSubmit?: boolean;
  notifyOnChecklist?: boolean;
  notifyOnReceiving?: boolean;
  notifyOnLeave?: boolean;
  notifyOnProdCalc?: boolean;
}

export type DiscordNotifyEventKey = keyof Omit<
  DiscordNotifySettings,
  | 'webhookUrl'
  | 'enabled'
  | 'notifyOnWaste'
  | 'notifyOnStockSubmit'
  | 'notifyOnChecklist'
  | 'notifyOnReceiving'
  | 'notifyOnLeave'
  | 'notifyOnProdCalc'
>;

export const DEFAULT_DISCORD_NOTIFY_SETTINGS: DiscordNotifySettings = {
  webhookUrl: '',
  enabled: false,
  notifyOnLeaveApproval: true,
  notifyOnLeaveRequest: true,
  notifyOnDailySales: true,
  notifyOnDailyBakery: true,
  notifyOnBarStock: true,
  notifyOnBakeryStock: true,
  notifyOnBarReceiving: true,
  notifyOnBakeryReceiving: true,
  notifyOnBarDailyCount: true,
  notifyOnBakeryDailyCount: true,
  notifyOnBarWaste: true,
  notifyOnBakeryWaste: true,
  notifyOnCoffeeWaste: true,
  notifyOnMaintenance: true,
  notifyOnBarChecklist: true,
  notifyOnBakeryChecklist: true,
  notifyOnPurchasing: true,
  notifyOnOrderedItems: true,
  notifyOnBakeryPlan: true,
  notifyOnRnD: true,
  notifyOnProdCalcIngredients: true,
  notifyOnProdCalcRecipes: true,
  notifyOnHelloCrennCheckin: true,
  notifyOnHelloCrennGeofence: true,
};

/**
 * Merges saved Discord settings (localStorage / Supabase) with defaults,
 * gracefully inheriting legacy grouped flags if split keys were not yet saved.
 */
export const normalizeDiscordSettings = (raw: any): DiscordNotifySettings => {
  const src = raw && typeof raw === 'object' ? raw : {};
  const boolOr = (val: any, legacyVal: any, fallback = true): boolean => {
    if (typeof val === 'boolean') return val;
    if (typeof legacyVal === 'boolean') return legacyVal;
    return fallback;
  };

  return {
    webhookUrl: typeof src.webhookUrl === 'string' ? src.webhookUrl : '',
    enabled: Boolean(src.enabled),
    notifyOnLeaveApproval: boolOr(src.notifyOnLeaveApproval, src.notifyOnLeave),
    notifyOnLeaveRequest: boolOr(src.notifyOnLeaveRequest, src.notifyOnLeave),
    notifyOnDailySales: boolOr(src.notifyOnDailySales, undefined),
    notifyOnDailyBakery: boolOr(src.notifyOnDailyBakery, undefined),
    notifyOnBarStock: boolOr(src.notifyOnBarStock, src.notifyOnStockSubmit),
    notifyOnBakeryStock: boolOr(src.notifyOnBakeryStock, src.notifyOnStockSubmit),
    notifyOnBarReceiving: boolOr(src.notifyOnBarReceiving, src.notifyOnReceiving),
    notifyOnBakeryReceiving: boolOr(src.notifyOnBakeryReceiving, src.notifyOnReceiving),
    notifyOnBarDailyCount: boolOr(src.notifyOnBarDailyCount, src.notifyOnStockSubmit),
    notifyOnBakeryDailyCount: boolOr(src.notifyOnBakeryDailyCount, src.notifyOnStockSubmit),
    notifyOnBarWaste: boolOr(src.notifyOnBarWaste, src.notifyOnWaste),
    notifyOnBakeryWaste: boolOr(src.notifyOnBakeryWaste, src.notifyOnWaste),
    notifyOnCoffeeWaste: boolOr(src.notifyOnCoffeeWaste, src.notifyOnWaste),
    notifyOnMaintenance: boolOr(src.notifyOnMaintenance, undefined),
    notifyOnBarChecklist: boolOr(src.notifyOnBarChecklist, src.notifyOnChecklist),
    notifyOnBakeryChecklist: boolOr(src.notifyOnBakeryChecklist, src.notifyOnChecklist),
    notifyOnPurchasing: boolOr(src.notifyOnPurchasing, undefined),
    notifyOnOrderedItems: boolOr(src.notifyOnOrderedItems, src.notifyOnPurchasing),
    notifyOnBakeryPlan: boolOr(src.notifyOnBakeryPlan, undefined),
    notifyOnRnD: boolOr(src.notifyOnRnD, undefined),
    notifyOnProdCalcIngredients: boolOr(src.notifyOnProdCalcIngredients, src.notifyOnProdCalc),
    notifyOnProdCalcRecipes: boolOr(src.notifyOnProdCalcRecipes, src.notifyOnProdCalc),
    notifyOnHelloCrennCheckin: boolOr(src.notifyOnHelloCrennCheckin, undefined),
    notifyOnHelloCrennGeofence: boolOr(src.notifyOnHelloCrennGeofence, undefined),
  };
};

export const sendDiscordNotification = async (
  message: string,
  eventType?: DiscordNotifyEventKey | 'notifyOnStockSubmit' | 'notifyOnReceiving' | 'notifyOnChecklist' | 'notifyOnWaste' | 'notifyOnLeave' | 'notifyOnProdCalc'
) => {
  try {
    const saved = localStorage.getItem('discordNotifySettings');
    if (!saved) {
      return { success: false, error: 'Discord Notify settings not found' };
    }

    const parsed = JSON.parse(saved);
    const settings = normalizeDiscordSettings(parsed);

    if (!settings.enabled || !settings.webhookUrl.trim()) {
      return { success: false, error: 'Discord Notify is disabled or Webhook URL is empty' };
    }

    if (eventType) {
      const normalizedKey = eventType as keyof DiscordNotifySettings;
      if (normalizedKey in settings && !settings[normalizedKey]) {
        return { success: false, error: 'Notification type disabled' };
      }
    }

    const response = await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: message
      })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Failed to send Discord notification:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
};


