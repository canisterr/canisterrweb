import type { MovieLog, MovieLogWithContent } from "@/types";

export type OnThisDayMemory<T extends MovieLog = MovieLogWithContent> = {
  log: T;
  yearsAgo: number;
};

export function findOnThisDayMemories<T extends MovieLog>(
  logs: T[],
  today: Date = new Date()
): OnThisDayMemory<T>[] {
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  return logs
    .filter((log) => !log.watch_later && Boolean(log.watched_date))
    .flatMap((log) => {
      const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(log.watched_date);
      if (!match) return [];
      const watchedYear = Number(match[1]);
      const watchedMonth = Number(match[2]);
      const watchedDay = Number(match[3]);
      if (watchedYear >= currentYear || watchedMonth !== currentMonth || watchedDay !== currentDay) return [];
      return [{ log, yearsAgo: currentYear - watchedYear }];
    })
    .sort((a, b) => a.yearsAgo - b.yearsAgo || b.log.watched_date.localeCompare(a.log.watched_date));
}

export function formatYearsAgo(yearsAgo: number): string {
  return yearsAgo === 1 ? "One year ago" : `${yearsAgo} years ago`;
}
