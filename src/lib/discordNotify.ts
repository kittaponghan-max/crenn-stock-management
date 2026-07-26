export interface DiscordNotifySettings {
  webhookUrl: string;
  enabled: boolean;
  notifyOnWaste: boolean;
  notifyOnRnD: boolean;
  notifyOnStockSubmit: boolean;
  notifyOnChecklist: boolean;
  notifyOnReceiving: boolean;
  notifyOnBakeryPlan: boolean;
}

export const DEFAULT_DISCORD_NOTIFY_SETTINGS: DiscordNotifySettings = {
  webhookUrl: '',
  enabled: false,
  notifyOnWaste: true,
  notifyOnRnD: true,
  notifyOnStockSubmit: true,
  notifyOnChecklist: true,
  notifyOnReceiving: true,
  notifyOnBakeryPlan: true
};

export const sendDiscordNotification = async (message: string, eventType?: keyof Omit<DiscordNotifySettings, 'webhookUrl' | 'enabled'>) => {
  try {
    const saved = localStorage.getItem('discordNotifySettings');
    if (!saved) {
      return { success: false, error: 'Discord Notify settings not found' };
    }

    const settings: DiscordNotifySettings = JSON.parse(saved);

    if (!settings.enabled || !settings.webhookUrl.trim()) {
      return { success: false, error: 'Discord Notify is disabled or Webhook URL is empty' };
    }

    if (eventType && !settings[eventType]) {
      return { success: false, error: 'Notification type disabled' };
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
