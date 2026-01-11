import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useSalesStats } from "@/hooks/useSalesStats";

interface Notification {
  id: string;
  type: "sale_approved" | "withdrawal_pending" | "withdrawal_approved" | "bank_account_pending" | "bank_account_approved";
  title: string;
  description: string;
  amount: number;
  createdAt: Date;
  read: boolean;
}

interface RevenueContextType {
  totalRevenue: number;
  currentGoal: number;
  goalLabel: string;
  notifications: Notification[];
  valuesVisible: boolean;
  toggleValuesVisibility: () => void;
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;
  unreadCount: number;
  addNotification: (notification: Omit<Notification, "id" | "createdAt" | "read">) => void;
  // Sales stats
  totalSalesCount: number;
  approvedSalesCount: number;
  pendingSalesCount: number;
  refusedSalesCount: number;
  approvedAmount: number;
  pendingAmount: number;
  availableBalance: number;
  retentionAmount: number;
  commissionAmount: number;
  pixPercentage: number;
  creditCardPercentage: number;
  boletoPercentage: number;
  statsLoading: boolean;
  refetchStats: () => void;
}

const GOALS = [
  { value: 10000, label: "10K" },
  { value: 100000, label: "100K" },
  { value: 500000, label: "500K" },
  { value: 1000000, label: "1M" },
  { value: 5000000, label: "5M" },
  { value: 10000000, label: "10M" },
];

const RevenueContext = createContext<RevenueContextType | undefined>(undefined);

export const useRevenue = () => {
  const context = useContext(RevenueContext);
  if (!context) {
    return {
      totalRevenue: 0,
      currentGoal: 10000,
      goalLabel: "10K",
      notifications: [],
      valuesVisible: true,
      toggleValuesVisibility: () => {},
      markNotificationAsRead: () => {},
      clearAllNotifications: () => {},
      unreadCount: 0,
      addNotification: () => {},
      totalSalesCount: 0,
      approvedSalesCount: 0,
      pendingSalesCount: 0,
      refusedSalesCount: 0,
      approvedAmount: 0,
      pendingAmount: 0,
      availableBalance: 0,
      retentionAmount: 0,
      commissionAmount: 0,
      pixPercentage: 0,
      creditCardPercentage: 0,
      boletoPercentage: 0,
      statsLoading: false,
      refetchStats: () => {},
    };
  }
  return context;
};

interface RevenueProviderProps {
  children: ReactNode;
}

export const RevenueProvider = ({ children }: RevenueProviderProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [valuesVisible, setValuesVisible] = useState(true);

  const salesStats = useSalesStats();

  const getCurrentGoal = (revenue: number) => {
    for (const goal of GOALS) {
      if (revenue < goal.value) {
        return goal;
      }
    }
    return GOALS[GOALS.length - 1];
  };

  const currentGoalData = getCurrentGoal(salesStats.totalRevenue);
  const currentGoal = currentGoalData.value;
  const goalLabel = currentGoalData.label;

  const toggleValuesVisibility = () => {
    setValuesVisible((prev) => !prev);
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const clearAllNotifications = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const addNotification = (notification: Omit<Notification, "id" | "createdAt" | "read">) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      read: false,
    };
    setNotifications((prev) => [newNotification, ...prev]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const saved = localStorage.getItem("notifications");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNotifications(parsed.map((n: any) => ({
          ...n,
          createdAt: new Date(n.createdAt)
        })));
      } catch (e) {
        console.error("Error loading notifications:", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("notifications", JSON.stringify(notifications));
  }, [notifications]);

  return (
    <RevenueContext.Provider
      value={{
        totalRevenue: salesStats.totalRevenue,
        currentGoal,
        goalLabel,
        notifications,
        valuesVisible,
        toggleValuesVisibility,
        markNotificationAsRead,
        clearAllNotifications,
        unreadCount,
        addNotification,
        totalSalesCount: salesStats.totalSalesCount,
        approvedSalesCount: salesStats.approvedSalesCount,
        pendingSalesCount: salesStats.pendingSalesCount,
        refusedSalesCount: salesStats.refusedSalesCount,
        approvedAmount: salesStats.approvedAmount,
        pendingAmount: salesStats.pendingAmount,
        availableBalance: salesStats.availableBalance,
        retentionAmount: salesStats.retentionAmount,
        commissionAmount: salesStats.commissionAmount,
        pixPercentage: salesStats.pixPercentage,
        creditCardPercentage: salesStats.creditCardPercentage,
        boletoPercentage: salesStats.boletoPercentage,
        statsLoading: salesStats.loading,
        refetchStats: salesStats.refetch,
      }}
    >
      {children}
    </RevenueContext.Provider>
  );
};
