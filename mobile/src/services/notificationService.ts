import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { DailyPlan } from '../state/WorkspaceContext';
import { date_from_key, parse_clock_minutes } from '../utils/date';

const notification_ids_key = 'lifeagent_plan_notification_ids_v1';

export type NotificationSyncResult = {
  scheduled: number;
  enabled: boolean;
};

function plan_trigger_date(plan: DailyPlan): Date | null {
  const date = date_from_key(plan.plan_date);
  const minutes = parse_clock_minutes(plan.start_time);
  if (!date || minutes === null) return null;
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

async function cancel_previous_notifications(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(notification_ids_key);
    const ids: unknown = saved ? JSON.parse(saved) : [];
    if (Array.isArray(ids)) {
      await Promise.all(ids.filter((id): id is string => typeof id === 'string').map((id) => Notifications.cancelScheduledNotificationAsync(id)));
    }
  } catch {
    // Notification cleanup is best effort and never blocks the plan screen.
  }
}

async function sync_plan_notifications_impl(plans: DailyPlan[]): Promise<NotificationSyncResult> {
  if (Platform.OS === 'web') return { scheduled: 0, enabled: false };
  try {
    await cancel_previous_notifications();
    const permissions = await Notifications.getPermissionsAsync();
    const granted = permissions.granted || permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    const final_permissions = granted ? permissions : await Notifications.requestPermissionsAsync();
    const enabled = final_permissions.granted || final_permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    if (!enabled) return { scheduled: 0, enabled: false };

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('lifeagent-plan', {
        name: 'LifeAgent 计划提醒',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
    }

    const ids: string[] = [];
    const now = Date.now();
    for (const plan of plans) {
      if (plan.completed) continue;
      const trigger_date = plan_trigger_date(plan);
      if (!trigger_date || trigger_date.getTime() <= now) continue;
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'LifeAgent 计划提醒',
          body: `${plan.start_time} 开始：${plan.task_name}`,
          data: { plan_id: plan.plan_id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: trigger_date,
          ...(Platform.OS === 'android' ? { channelId: 'lifeagent-plan' } : {}),
        },
      });
      ids.push(id);
    }
    await AsyncStorage.setItem(notification_ids_key, JSON.stringify(ids));
    return { scheduled: ids.length, enabled: true };
  } catch {
    return { scheduled: 0, enabled: false };
  }
}

// State changes can arrive from both the workspace and a screen transition.
// Serialize the native cancel/schedule pair so an older sync cannot erase a
// newer set of reminders halfway through its update.
let notification_queue: Promise<void> = Promise.resolve();

export function sync_plan_notifications(plans: DailyPlan[]): Promise<NotificationSyncResult> {
  const operation = notification_queue.then(() => sync_plan_notifications_impl(plans));
  notification_queue = operation.then(() => undefined, () => undefined);
  return operation;
}
