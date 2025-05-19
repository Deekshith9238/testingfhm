import { 
  Bell, 
  Check, 
  Loader2, 
  MessagesSquare, 
  StarIcon, 
  BriefcaseBusiness,
  CircleCheck,
  AlertCircle 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, Notification } from "@/hooks/use-notifications";
import { useNavigate } from "react-router-dom";

interface NotificationListProps {
  onNotificationClick?: (notification: Notification) => void;
  maxHeight?: string;
}

export function NotificationList({ 
  onNotificationClick,
  maxHeight = "400px" 
}: NotificationListProps) {
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    markAsRead, 
    markAllAsRead 
  } = useNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already read
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Call custom click handler if provided
    if (onNotificationClick) {
      onNotificationClick(notification);
      return;
    }

    // Default navigation behavior
    switch (notification.type) {
      case "task_request":
        if (notification.relatedId) {
          navigate(`/tasks/${notification.relatedId}`);
        }
        break;
      case "service_request":
        if (notification.relatedId) {
          navigate(`/services/${notification.relatedId}`);
        }
        break;
      case "message":
        if (notification.relatedId) {
          navigate(`/messages/${notification.relatedId}`);
        }
        break;
      case "review":
        if (notification.relatedId) {
          navigate(`/reviews/${notification.relatedId}`);
        }
        break;
    }
  };

  const getNotificationIcon = (notification: Notification) => {
    switch (notification.type) {
      case "task_request":
        return <BriefcaseBusiness className="h-4 w-4 mr-2 flex-shrink-0" />;
      case "service_request":
        return <CircleCheck className="h-4 w-4 mr-2 flex-shrink-0" />;
      case "message":
        return <MessagesSquare className="h-4 w-4 mr-2 flex-shrink-0" />;
      case "review":
        return <StarIcon className="h-4 w-4 mr-2 flex-shrink-0" />;
      case "system":
        return <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />;
      default:
        return <Bell className="h-4 w-4 mr-2 flex-shrink-0" />;
    }
  };

  return (
    <>
      <div className="p-4 flex items-center justify-between border-b">
        <h3 className="text-sm font-medium">Notifications</h3>
        {unreadCount > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-xs hover:bg-accent" 
            onClick={markAllAsRead}
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            Mark all as read
          </Button>
        )}
      </div>
      
      <ScrollArea style={{ height: maxHeight }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length > 0 ? (
          <div className="flex flex-col">
            {notifications.map(notification => (
              <button
                key={notification.id} 
                className={`p-4 hover:bg-accent/50 transition-colors flex items-start text-sm w-full text-left ${
                  notification.read ? "opacity-70" : "font-medium bg-accent/30"
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start flex-1 min-w-0">
                  {getNotificationIcon(notification)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm line-clamp-2">{notification.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-sm text-muted-foreground">
            <Bell className="h-8 w-8 mb-2 text-muted-foreground/50" />
            <p>No notifications</p>
          </div>
        )}
      </ScrollArea>
    </>
  );
} 