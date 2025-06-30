import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import {
  Clock,
  MapPin,
  Package,
  Hammer,
  Heart,
  Zap,
  AlertTriangle,
  Scroll,
  ChevronDown,
  ChevronUp,
  Filter,
  X
} from 'lucide-react';
import { ActivityEvent } from "../../store/gameSlice.ts";

interface ActivityLogProps {
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

export const ActivityLog: React.FC<ActivityLogProps> = ({
  isMinimized = false,
  onToggleMinimize
}) => {
  const { roundNumber, gameTimer, activityEvents } = useSelector((state: RootState) => state.game);
  const [filteredEvents, setFilteredEvents] = useState<ActivityEvent[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter events based on selected filters
  useEffect(() => {
    if (selectedFilters.size === 0) {
      setFilteredEvents(activityEvents);
    } else {
      setFilteredEvents(activityEvents.filter(event => selectedFilters.has(event.type)));
    }
  }, [activityEvents, selectedFilters]);

  // Auto-scroll to latest events
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [filteredEvents, autoScroll]);

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getEventIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'movement': return MapPin;
      case 'item_usage': return Package;
      case 'crafting': return Hammer;
      case 'harvesting': return Package;
      case 'terrain_effect': return AlertTriangle;
      case 'damage': return Heart;
      case 'healing': return Heart;
      case 'disaster': return AlertTriangle;
      case 'elimination': return X;
      case 'round_start': return Clock;
      default: return Zap;
    }
  };

  const getEventColor = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'movement': return 'text-blue-400';
      case 'item_usage': return 'text-purple-400';
      case 'crafting': return 'text-orange-400';
      case 'harvesting': return 'text-green-400';
      case 'terrain_effect': return 'text-yellow-400';
      case 'damage': return 'text-red-400';
      case 'healing': return 'text-green-400';
      case 'disaster': return 'text-red-500';
      case 'elimination': return 'text-red-600';
      case 'round_start': return 'text-cyan-400';
      default: return 'text-slate-400';
    }
  };

  const eventTypes = [
    { id: 'movement', label: 'Movement', color: 'text-blue-400' },
    { id: 'item_usage', label: 'Item Usage', color: 'text-purple-400' },
    { id: 'crafting', label: 'Crafting', color: 'text-orange-400' },
    { id: 'harvesting', label: 'Harvesting', color: 'text-green-400' },
    { id: 'terrain_effect', label: 'Terrain Effects', color: 'text-yellow-400' },
    { id: 'damage', label: 'Damage', color: 'text-red-400' },
    { id: 'healing', label: 'Healing', color: 'text-green-400' },
    { id: 'disaster', label: 'Disasters', color: 'text-red-500' },
    { id: 'elimination', label: 'Eliminations', color: 'text-red-600' },
    { id: 'round_start', label: 'Round Events', color: 'text-cyan-400' },
    { id: 'phase_change', label: 'Phase Changes', color: 'text-blue-400' },
    { id: 'phase_effect', label: 'Phase Effects', color: 'text-blue-400' }
  ];

  const toggleFilter = (eventType: string) => {
    const newFilters = new Set(selectedFilters);
    if (newFilters.has(eventType)) {
      newFilters.delete(eventType);
    } else {
      newFilters.add(eventType);
    }
    setSelectedFilters(newFilters);
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 left-4 z-40">
        <button
          onClick={onToggleMinimize}
          className="bg-slate-800 hover:bg-slate-700 text-white p-3 rounded-lg shadow-lg border border-slate-600 transition-colors"
          title="Open Activity Log"
        >
          <Scroll className="w-5 h-5" />
          {activityEvents.length > 0 && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {Math.min(activityEvents.length, 9)}
            </div>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 w-96 h-80 bg-slate-800 rounded-lg shadow-xl border border-slate-600 z-40 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-slate-600 bg-slate-900 rounded-t-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-bold flex items-center">
            <Scroll className="w-4 h-4 mr-2 text-cyan-400" />
            Activity Log
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`p-1 rounded transition-colors ${
                autoScroll ? 'text-green-400' : 'text-slate-400'
              }`}
              title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
            >
              {autoScroll ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            {onToggleMinimize && (
              <button
                onClick={onToggleMinimize}
                className="text-slate-400 hover:text-white transition-colors"
                title="Minimize"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-2">
          <Filter className="w-3 h-3 text-slate-400" />
          <div className="flex flex-wrap gap-1">
            {eventTypes.slice(0, 4).map(type => (
              <button
                key={type.id}
                onClick={() => toggleFilter(type.id)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  selectedFilters.has(type.id)
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {type.label}
              </button>
            ))}
            {selectedFilters.size > 0 && (
              <button
                onClick={() => setSelectedFilters(new Set())}
                className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Events List */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-2"
        onScroll={(e) => {
          const { scrollTop } = e.currentTarget;
          setAutoScroll(scrollTop < 10);
        }}
      >
        {filteredEvents.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            <Scroll className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No events to display</p>
            {selectedFilters.size > 0 && (
              <p className="text-xs mt-1">Try adjusting your filters</p>
            )}
          </div>
        ) : (
          filteredEvents.map(event => {
            const Icon = getEventIcon(event.type);
            const colorClass = getEventColor(event.type);

            return (
              <div
                key={event.id}
                className="bg-slate-700 rounded p-2 border border-slate-600 hover:bg-slate-600 transition-colors"
              >
                <div className="flex items-start space-x-2">
                  <Icon className={`w-4 h-4 mt-0.5 ${colorClass}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-white text-sm">{event.message}</p>
                      <span className="text-slate-400 text-xs whitespace-nowrap ml-2">
                        {formatTime(event.timestamp)}
                      </span>
                    </div>

                    {event.details?.coords && (
                      <p className="text-slate-400 text-xs mt-1">
                        Coordinates: ({event.details.coords.q}, {event.details.coords.r}, {event.details.coords.s})
                        {event.details.terrain && ` • ${event.details.terrain}`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-slate-600 bg-slate-900 rounded-b-lg">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{filteredEvents.length} events</span>
          <span>Round {roundNumber} • {Math.floor(gameTimer / 60)}:{(gameTimer % 60).toString().padStart(2, '0')}</span>
        </div>
      </div>
    </div>
  );
};