import { storage } from '../storage';
import { getWebSocketService } from './websocket';
import { notificationTypes } from '@shared/schema';
import type { Task, ServiceProvider, User } from '@shared/schema';

export async function notifyNewTask(task: Task, providers: ServiceProvider[]) {
  const providerUserIds = providers.map(p => p.userId);
  
  // Create notifications in database
  const notifications = await Promise.all(
    providerUserIds.map(userId =>
      storage.createNotification({
        userId,
        type: notificationTypes.NEW_TASK,
        title: 'New Task Available',
        message: `New task: ${task.title}`,
        data: { taskId: task.id },
        read: false
      })
    )
  );

  // Send real-time notifications
  const wsService = getWebSocketService();
  await wsService.sendToUsers(providerUserIds, {
    type: notificationTypes.NEW_TASK,
    title: 'New Task Available',
    message: `New task: ${task.title}`,
    data: { taskId: task.id }
  });

  return notifications;
}

export async function notifyTaskAccepted(task: Task, provider: ServiceProvider, client: User) {
  // Notify the client
  const clientNotification = await storage.createNotification({
    userId: client.id,
    type: notificationTypes.TASK_ACCEPTED,
    title: 'Task Accepted',
    message: `Your task "${task.title}" has been accepted by ${provider.user.firstName} ${provider.user.lastName}`,
    data: { taskId: task.id, providerId: provider.id },
    read: false
  });

  // Notify other providers that the task is no longer available
  const otherProviders = await storage.getServiceProvidersByCategory(task.categoryId);
  const otherProviderUserIds = otherProviders
    .filter(p => p.userId !== provider.userId)
    .map(p => p.userId);

  const otherNotifications = await Promise.all(
    otherProviderUserIds.map(userId =>
      storage.createNotification({
        userId,
        type: notificationTypes.TASK_ACCEPTED,
        title: 'Task No Longer Available',
        message: `The task "${task.title}" has been accepted by another provider`,
        data: { taskId: task.id },
        read: false
      })
    )
  );

  // Send real-time notifications
  const wsService = getWebSocketService();
  
  // Notify client
  await wsService.sendToUser(client.id, {
    type: notificationTypes.TASK_ACCEPTED,
    title: 'Task Accepted',
    message: `Your task "${task.title}" has been accepted by ${provider.user.firstName} ${provider.user.lastName}`,
    data: { taskId: task.id, providerId: provider.id }
  });

  // Notify other providers
  await wsService.sendToUsers(otherProviderUserIds, {
    type: notificationTypes.TASK_ACCEPTED,
    title: 'Task No Longer Available',
    message: `The task "${task.title}" has been accepted by another provider`,
    data: { taskId: task.id }
  });

  return {
    clientNotification,
    otherNotifications
  };
}

export async function markNotificationAsRead(notificationId: number, userId: number) {
  return storage.updateNotification(notificationId, {
    read: true
  });
}

export async function getUnreadNotifications(userId: number) {
  return storage.getUnreadNotifications(userId);
}

export async function getAllNotifications(userId: number) {
  return storage.getUserNotifications(userId);
} 