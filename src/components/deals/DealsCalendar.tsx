'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Video, Calendar, X } from 'lucide-react'
import { clsx } from 'clsx'
import type { Deal } from '@/types/deals'
import { STAGE_CONFIG } from '@/types/deals'

interface DealsCalendarProps {
  deals: Deal[]
  onDealClick: (deal: Deal) => void
}

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日']

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

interface DealEvent {
  deal: Deal
  date: Date
  type: 'meeting' | 'action'
}

export default function DealsCalendar({ deals, onDealClick }: DealsCalendarProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // Build events from deals
  const events = useMemo(() => {
    const result: DealEvent[] = []
    for (const deal of deals) {
      if (deal.meeting_date) {
        result.push({ deal, date: new Date(deal.meeting_date), type: 'meeting' })
      }
      if (deal.next_action_date) {
        result.push({ deal, date: new Date(deal.next_action_date + 'T00:00:00'), type: 'action' })
      }
    }
    return result
  }, [deals])

  // Get events for a specific date
  const getEventsForDate = (date: Date): DealEvent[] => {
    return events.filter(e => isSameDay(e.date, date))
  }

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1)
    // JS: 0=Sunday. Convert to Mon=0 ... Sun=6
    let startDow = firstDay.getDay() - 1
    if (startDow < 0) startDow = 6

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()

    const days: (Date | null)[] = []
    // Leading blanks
    for (let i = 0; i < startDow; i++) days.push(null)
    // Actual days
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(currentYear, currentMonth, d))
    }
    // Trailing blanks to fill last row
    while (days.length % 7 !== 0) days.push(null)

    return days
  }, [currentYear, currentMonth])

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear(currentYear - 1)
      setCurrentMonth(11)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
    setSelectedDate(null)
  }

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear(currentYear + 1)
      setCurrentMonth(0)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
    setSelectedDate(null)
  }

  const goToToday = () => {
    setCurrentYear(today.getFullYear())
    setCurrentMonth(today.getMonth())
    setSelectedDate(null)
  }

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : []

  const monthLabel = `${currentYear}年${currentMonth + 1}月`

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Calendar header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">{monthLabel}</h2>
          <button
            onClick={goToToday}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-gray-400 hover:text-white bg-gray-900 border border-gray-800 hover:border-gray-700 transition-colors"
          >
            今日
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={goToPrevMonth}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goToNextMonth}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Calendar grid */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-px mb-1 shrink-0">
            {WEEKDAYS.map((day, i) => (
              <div
                key={day}
                className={clsx(
                  'text-center text-xs font-medium py-2',
                  i === 5 ? 'text-blue-400' : i === 6 ? 'text-red-400' : 'text-gray-500'
                )}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-px flex-1 auto-rows-fr">
            {calendarDays.map((date, idx) => {
              if (!date) {
                return <div key={`empty-${idx}`} className="bg-gray-950/50 rounded-lg" />
              }

              const dayEvents = getEventsForDate(date)
              const isToday = isSameDay(date, today)
              const isSelected = selectedDate ? isSameDay(date, selectedDate) : false
              const dayOfWeek = idx % 7 // 0=Mon ... 6=Sun

              const hasMeeting = dayEvents.some(e => e.type === 'meeting')
              const hasAction = dayEvents.some(e => e.type === 'action')

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                  className={clsx(
                    'relative flex flex-col items-center pt-1.5 pb-1 rounded-lg transition-all text-xs',
                    isSelected
                      ? 'bg-violet-600/20 border border-violet-500/40'
                      : 'hover:bg-gray-800/50 border border-transparent',
                    isToday && !isSelected && 'bg-gray-900 border-gray-700'
                  )}
                >
                  <span
                    className={clsx(
                      'w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium',
                      isToday ? 'bg-violet-600 text-white' : '',
                      dayOfWeek === 5 ? 'text-blue-400' : dayOfWeek === 6 ? 'text-red-400' : 'text-gray-300',
                      isToday && 'text-white'
                    )}
                  >
                    {date.getDate()}
                  </span>

                  {/* Event dots */}
                  {(hasMeeting || hasAction) && (
                    <div className="flex items-center gap-0.5 mt-0.5">
                      {hasMeeting && <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />}
                      {hasAction && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                    </div>
                  )}

                  {/* Event count badge */}
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] text-gray-500 mt-0.5">{dayEvents.length}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-violet-400" />
              <span className="text-xs text-gray-500">ミーティング</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-xs text-gray-500">アクション期限</span>
            </div>
          </div>
        </div>

        {/* Selected date detail panel */}
        {selectedDate && (
          <div className="w-72 shrink-0 bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h3 className="text-sm font-semibold text-white">
                {selectedDate.getMonth() + 1}/{selectedDate.getDate()}({WEEKDAYS[(() => {
                  let d = selectedDate.getDay() - 1
                  if (d < 0) d = 6
                  return d
                })()]})
              </h3>
              <button
                onClick={() => setSelectedDate(null)}
                className="p-1 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {selectedEvents.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-6">予定なし</p>
            ) : (
              <div className="overflow-y-auto flex-1 space-y-2">
                {selectedEvents.map((event, i) => {
                  const cfg = STAGE_CONFIG[event.deal.stage] ?? STAGE_CONFIG['初回接触']
                  return (
                    <button
                      key={`${event.deal.id}-${event.type}-${i}`}
                      onClick={() => onDealClick(event.deal)}
                      className="w-full text-left p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {event.type === 'meeting' ? (
                          <Video className="w-3 h-3 text-violet-400" />
                        ) : (
                          <Calendar className="w-3 h-3 text-amber-400" />
                        )}
                        <span className="text-xs text-gray-400">
                          {event.type === 'meeting' ? 'ミーティング' : 'アクション期限'}
                        </span>
                        {event.type === 'meeting' && event.deal.meeting_date && (
                          <span className="text-xs text-gray-500 ml-auto">
                            {formatTime(event.deal.meeting_date)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-white truncate">
                        {event.deal.company_name}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span
                          className={clsx(
                            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border',
                            cfg.bg, cfg.color, cfg.border
                          )}
                        >
                          {cfg.emoji} {cfg.label}
                        </span>
                        {event.deal.meeting_url && event.type === 'meeting' && (
                          <a
                            href={event.deal.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-[10px] text-violet-400 hover:text-violet-300 underline"
                          >
                            会議リンク
                          </a>
                        )}
                      </div>
                      {event.type === 'action' && event.deal.next_action && (
                        <p className="text-xs text-gray-500 mt-1.5 truncate">
                          {event.deal.next_action}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
