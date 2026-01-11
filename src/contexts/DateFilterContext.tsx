import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { DateRange } from "react-day-picker";
import { startOfDay, endOfDay, format } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

const LAST_SYNC_DATE_KEY = "royalpay_last_sync_date";
const USER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

interface DateFilterContextType {
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  startDate: Date | undefined;
  endDate: Date | undefined;
  // ISO strings for backend queries (UTC)
  startDateISO: string | undefined;
  endDateISO: string | undefined;
  // YYYY-MM-DD format for display and simple comparisons
  selectedDateString: string;
  isFiltered: boolean;
  clearFilter: () => void;
  currentDayLabel: string;
  isTodayView: boolean;
  isLoading: boolean;
  // Date query helpers
  getDateQueryParams: () => { start: string; end: string; date: string };
  userTimezone: string;
}

const DateFilterContext = createContext<DateFilterContextType | undefined>(undefined);

export const useDateFilter = () => {
  const context = useContext(DateFilterContext);
  if (!context) {
    const today = new Date();
    return {
      dateRange: undefined,
      setDateRange: () => {},
      startDate: undefined,
      endDate: undefined,
      startDateISO: undefined,
      endDateISO: undefined,
      selectedDateString: format(today, "yyyy-MM-dd"),
      isFiltered: false,
      clearFilter: () => {},
      currentDayLabel: "",
      isTodayView: true,
      isLoading: false,
      getDateQueryParams: () => ({
        start: startOfDay(today).toISOString(),
        end: endOfDay(today).toISOString(),
        date: format(today, "yyyy-MM-dd"),
      }),
      userTimezone: USER_TIMEZONE,
    };
  }
  return context;
};

interface DateFilterProviderProps {
  children: ReactNode;
}

export const DateFilterProvider = ({ children }: DateFilterProviderProps) => {
  // Get today range in local timezone
  const getTodayRange = useCallback(() => {
    const today = new Date();
    return {
      from: startOfDay(today),
      to: endOfDay(today),
    };
  }, []);

  const [dateRange, setDateRangeInternal] = useState<DateRange | undefined>(getTodayRange);
  const [currentDayLabel, setCurrentDayLabel] = useState(() => 
    format(new Date(), "dd/MM/yyyy")
  );
  const [isLoading, setIsLoading] = useState(false);
  const prevDateRangeRef = useRef<string | null>(null);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Custom setDateRange that sets loading state
  const setDateRange = useCallback((range: DateRange | undefined) => {
    // Clear any pending loading timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    
    // Set loading immediately
    setIsLoading(true);
    
    // Normalize the range to ensure full day coverage
    if (range?.from) {
      const normalizedRange: DateRange = {
        from: startOfDay(range.from),
        to: range.to ? endOfDay(range.to) : endOfDay(range.from),
      };
      setDateRangeInternal(normalizedRange);
    } else {
      setDateRangeInternal(range);
    }
    
    // Auto-clear loading after max 3 seconds
    loadingTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
    }, 3000);
  }, []);

  // Check for day change and sync
  useEffect(() => {
    const checkAndSyncDay = () => {
      const now = new Date();
      const todayStr = format(startOfDay(now), "yyyy-MM-dd");
      const lastSync = localStorage.getItem(LAST_SYNC_DATE_KEY);

      if (lastSync !== todayStr) {
        console.log(`[DateFilter] New day detected: ${lastSync || "never"} -> ${todayStr}`);
        localStorage.setItem(LAST_SYNC_DATE_KEY, todayStr);
        setDateRangeInternal(getTodayRange());
        setCurrentDayLabel(format(now, "dd/MM/yyyy"));
      }
    };

    checkAndSyncDay();

    // Check every 30 seconds
    const intervalId = setInterval(checkAndSyncDay, 30000);

    // Schedule midnight check
    const scheduleNextMidnight = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const msUntilMidnight = tomorrow.getTime() - now.getTime();
      
      return setTimeout(() => {
        console.log("[DateFilter] Midnight - resetting to new day");
        checkAndSyncDay();
        scheduleNextMidnight();
      }, msUntilMidnight);
    };

    const timeoutId = scheduleNextMidnight();

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [getTodayRange]);

  // Calculate derived values
  const startDate = dateRange?.from ? startOfDay(dateRange.from) : undefined;
  const endDate = dateRange?.to ? endOfDay(dateRange.to) : undefined;

  // ISO strings for backend queries (UTC format)
  const startDateISO = startDate ? startDate.toISOString() : undefined;
  const endDateISO = endDate ? endDate.toISOString() : undefined;

  // YYYY-MM-DD string for the selected date
  const selectedDateString = dateRange?.from 
    ? format(dateRange.from, "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");

  const isFiltered = !!(dateRange?.from || dateRange?.to);
  
  // Check if viewing today
  const isTodayView = dateRange?.from && dateRange?.to
    ? format(startOfDay(dateRange.from), "yyyy-MM-dd") === format(startOfDay(new Date()), "yyyy-MM-dd") &&
      format(startOfDay(dateRange.to), "yyyy-MM-dd") === format(startOfDay(new Date()), "yyyy-MM-dd")
    : false;

  // Detect date change for loading state
  useEffect(() => {
    const currentRangeKey = dateRange?.from 
      ? `${format(dateRange.from, "yyyy-MM-dd")}-${dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : ""}`
      : "none";
    
    if (prevDateRangeRef.current !== null && prevDateRangeRef.current !== currentRangeKey) {
      console.log(`[DateFilter] Date changed: ${prevDateRangeRef.current} -> ${currentRangeKey}`);
    }
    
    prevDateRangeRef.current = currentRangeKey;
  }, [dateRange]);

  // Clear loading when data is loaded (called by hooks)
  const clearLoading = useCallback(() => {
    setIsLoading(false);
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }, []);

  const clearFilter = useCallback(() => {
    setDateRange(undefined);
  }, [setDateRange]);

  // Helper function to get query params for backend
  const getDateQueryParams = useCallback(() => {
    const start = startDateISO || startOfDay(new Date()).toISOString();
    const end = endDateISO || endOfDay(new Date()).toISOString();
    const date = selectedDateString;
    
    return { start, end, date };
  }, [startDateISO, endDateISO, selectedDateString]);

  return (
    <DateFilterContext.Provider
      value={{
        dateRange,
        setDateRange,
        startDate,
        endDate,
        startDateISO,
        endDateISO,
        selectedDateString,
        isFiltered,
        clearFilter,
        currentDayLabel,
        isTodayView,
        isLoading,
        getDateQueryParams,
        userTimezone: USER_TIMEZONE,
      }}
    >
      {children}
    </DateFilterContext.Provider>
  );
};
