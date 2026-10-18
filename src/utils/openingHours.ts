import type { SiteSettings } from '../types';

/** Mirrors the server's Brazil-time weekly schedule; server is authoritative. */
export function isWithinOpeningHours(settings: SiteSettings, at = new Date()): boolean {
  if (!settings.isOpen) return false;
  if (!settings.autoHoursEnabled) return true;
  const schedule = settings.weeklySchedule;
  if (!schedule) return false;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(at);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  const weekday = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(get('weekday'));
  if (weekday < 0) return false;
  const minutes = (Number(get('hour')) % 24) * 60 + Number(get('minute'));
  const parse = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? Number(s.slice(0,2))*60+Number(s.slice(3)) : -1;
  const today = schedule[String(weekday)];
  if (today?.enabled) {
    const start = parse(today.open), end = parse(today.close);
    if (start >= 0 && end >= 0) {
      if (start === end) return true;
      if (start < end && minutes >= start && minutes < end) return true;
      if (start > end && minutes >= start) return true;
    }
  }
  const yesterday = schedule[String((weekday + 6) % 7)];
  if (yesterday?.enabled) {
    const start = parse(yesterday.open), end = parse(yesterday.close);
    if (start >= 0 && end >= 0 && start > end && minutes < end) return true;
  }
  return false;
}
