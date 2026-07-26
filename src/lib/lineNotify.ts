import { supabase } from './supabase';

export interface LineNotifySettings {
  token: string;
  enabled: boolean;
  notifyOnWaste: boolean;
  notifyOnRnD: boolean;
  notifyOnStockSubmit: boolean;
  notifyOnChecklist: boolean;
  notifyOnReceiving: boolean;
  notifyOnBakeryPlan: boolean;
}

export const DEFAULT_LINE_NOTIFY_SETTINGS: LineNotifySettings = {
  token: '',
  enabled: false,
  notifyOnWaste: true,
  notifyOnRnD: true,
  notifyOnStockSubmit: true,
  notifyOnChecklist: true,
  notifyOnReceiving: true,
  notifyOnBakeryPlan: true
};

export async function sendLineNotification(message: string, triggeringEvent?: keyof Omit<LineNotifySettings, 'token' | 'enabled'>) {
  try {
    // 1. Get settings from localStorage
    const saved = localStorage.getItem('lineNotifySettings');
    if (!saved) {
      console.log('LINE Notify settings are missing. Skip sending.');
      return;
    }
    
    const settings: LineNotifySettings = JSON.parse(saved);
    if (!settings.enabled || !settings.token) {
      console.log('LINE Notify system is disabled or token is blank.');
      return;
    }

    // 2. Check if this specific event notification is enabled
    if (triggeringEvent && !settings[triggeringEvent]) {
      console.log(`LINE Notify for event "${triggeringEvent}" is turned off.`);
      return;
    }

    // 3. Send request to our Express server proxy
    const response = await fetch('/api/line-notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        token: settings.token
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send LINE notification via proxy:', errorText);
    } else {
      console.log('LINE notification sent successfully! Message:', message);
    }
  } catch (error) {
    console.error('Error in sendLineNotification:', error);
  }
}
