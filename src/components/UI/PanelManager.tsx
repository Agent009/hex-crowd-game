import React, { useState, useEffect } from 'react';
import {
  Users,
  Building,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { HeroPanel, MinimizedHeroPanel } from './HeroPanel';
import { BuildingPanel, MinimizedBuildingPanel } from './BuildingPanel';

type PanelType = 'hero' | 'building' | 'none';
type PanelState = 'closed' | 'minimized' | 'expanded';

interface PanelConfig {
  state: PanelState;
  width: number;
  minimizedWidth: number;
}

export const PanelManager: React.FC = () => {
  // const { selectedHero, heroes } = useSelector((state: RootState) => state.game);

  // Active panel state - only one panel can be active at a time
  const [activePanel, setActivePanel] = useState<PanelType>('hero');
  const [panelState, setPanelState] = useState<PanelState>('expanded');

  // Panel configurations
  const panelConfig: PanelConfig = {
    state: panelState,
    width: 384,
    minimizedWidth: 60
  };

  // Responsive breakpoints
  // @ts-expect-error ignore
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [isMobile, setIsMobile] = useState(false);
  // console.log("PanelManager > isMobile", isMobile, "activePanel", activePanel, "panelState", panelState);

  // Auto-collapse behavior based on screen size
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      // console.log("PanelManager > handleResize > window.innerWidth", width);

      if (width < 768) {
        setScreenSize('mobile');
        setIsMobile(true);
        setPanelState('minimized');
      } else if (width < 1024) {
        setScreenSize('tablet');
        setIsMobile(false);
        setPanelState('minimized');
      } else {
        setScreenSize('desktop');
        setIsMobile(false);
        setPanelState('expanded');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-show hero panel when hero is selected
  // useEffect(() => {
  //   console.log("PanelManager > selectedHero", selectedHero);
  //   if (selectedHero && activePanel === 'none') {
  //     setActivePanel('hero');
  //     if (panelState === 'closed') {
  //       setPanelState('minimized');
  //     }
  //   }
  // }, [selectedHero, activePanel, panelState, screenSize]);

  const togglePanel = (panelType: PanelType) => {
    // console.log("PanelManager > togglePanel", panelType);
    if (activePanel === panelType) {
      // If clicking the same panel, cycle through states
      if (panelState === 'expanded') {
        setPanelState('minimized');
      } else if (panelState === 'minimized') {
        setPanelState('closed');
        setActivePanel('none');
      } else {
        setPanelState('minimized');
      }
    } else {
      // Switch to different panel
      setActivePanel(panelType);
      setPanelState('expanded');
    }
  };

  const minimizePanel = () => {
    setPanelState('minimized');
  };

  const expandPanel = () => {
    setPanelState('expanded');
  };

  const closePanel = () => {
    setPanelState('closed');
    setActivePanel('none');
  };

  const renderPanelContent = () => {
    if (activePanel === 'hero') {
      return panelState === 'minimized' ? <MinimizedHeroPanel /> : ((panelState !== 'closed') ? <HeroPanel /> : null);
    } else if (activePanel === 'building') {
      return panelState === 'minimized' ? <MinimizedBuildingPanel /> : ((panelState !== 'closed') ? <BuildingPanel /> : null);
    }
    return null;
  };

  const renderPanelControls = () => {
    if (panelState === 'closed' || activePanel === 'none') return null;

    const Icon = activePanel === 'hero' ? Users : Building;
    const title = activePanel === 'hero' ? 'Heroes' : 'Buildings';

    return (
      <div className="flex items-center justify-between p-2 bg-slate-700 border-b border-slate-600">
        <div className="flex items-center space-x-2">
          <Icon className="w-4 h-4 text-slate-300" />
          {panelState === 'expanded' && (
            <span className="text-white font-semibold text-sm">{title}</span>
          )}
        </div>

        {panelState === 'expanded' && (
          <div className="flex items-center space-x-1">
            <button
              onClick={minimizePanel}
              className="p-1 text-slate-400 hover:text-white transition-colors rounded"
              title="Minimize"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
            <button
              onClick={closePanel}
              className="p-1 text-slate-400 hover:text-white transition-colors rounded"
              title="Close"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {panelState === 'minimized' && (
          <button
            onClick={expandPanel}
            className="p-1 text-slate-400 hover:text-white transition-colors rounded"
            title="Expand"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  };

  const renderMainPanel = () => {
    if (panelState === 'closed' || activePanel === 'none') return null;

    const isMinimized = panelState === 'minimized';
    const width = isMinimized ? panelConfig.minimizedWidth : panelConfig.width;

    const panelClasses = `
      fixed bg-slate-800 rounded-lg shadow-xl border border-slate-600 
      transition-all duration-300 ease-in-out z-30
      ${isMobile ? 'bottom-20 top-[14rem] right-4' : 'top-[12rem] right-12 max-h-[calc(100vh-7rem)]'}
      ${isMinimized ? 'overflow-hidden' : 'overflow-visible'}
      panel-shadow
    `;

    const contentClasses = `
      transition-all duration-300 ease-in-out
      ${isMinimized ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}
    `;

    return (
      <div
        className={panelClasses}
        style={{ width: `${width}px` }}
      >
        {renderPanelControls()}

        <div className={contentClasses}>
          {renderPanelContent()}
        </div>
      </div>
    );
  };

  // Toggle buttons for switching between panels
  const renderToggleButtons = () => {
    return (
      <div className="fixed right-0 top-[12rem] z-40 flex flex-col space-y-2">
        <button
          onClick={() => togglePanel('hero')}
          className={`p-3 rounded-lg shadow-lg border transition-all duration-200 ${
            activePanel === 'hero' && panelState !== 'closed'
              ? 'bg-blue-600 border-blue-500 text-white' 
              : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
          title="Toggle Heroes Panel"
        >
          <Users className="w-5 h-5" />
        </button>

        <button
          onClick={() => togglePanel('building')}
          className={`p-3 rounded-lg shadow-lg border transition-all duration-200 ${
            activePanel === 'building' && panelState !== 'closed'
              ? 'bg-amber-600 border-amber-500 text-white' 
              : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
          title="Toggle Buildings Panel"
        >
          <Building className="w-5 h-5" />
        </button>
      </div>
    );
  };

  // Mobile floating controls
  const renderMobileControls = () => {
    if (!isMobile) return null;

    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className="flex flex-col space-y-2 bg-slate-800 rounded-lg p-2 shadow-lg border border-slate-600">
          <button
            onClick={() => togglePanel('hero')}
            className={`p-2 rounded transition-colors ${
              activePanel === 'hero' && panelState !== 'closed'
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            title="Toggle Heroes"
          >
            <Users className="w-4 h-4" />
          </button>

          <button
            onClick={() => togglePanel('building')}
            className={`p-2 rounded transition-colors ${
              activePanel === 'building' && panelState !== 'closed'
                ? 'bg-amber-600 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            title="Toggle Buildings"
          >
            <Building className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // Panel state indicator
  const renderStateIndicator = () => {
    if (isMobile || panelState === 'closed') return null;

    return (
      <div className="fixed top-[12.1rem] right-0 z-50 flex items-center space-x-2 hidden">
        <div className="bg-slate-800 rounded-lg px-3 py-1 border border-slate-600">
          <span className="text-slate-300 text-xs">
            {activePanel === 'hero' ? 'Heroes' : activePanel === 'building' ? 'Buildings' : 'No Panel'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Main panel container */}
      {renderMainPanel()}

      {/* Toggle buttons for desktop/tablet */}
      {!isMobile && renderToggleButtons()}

      {/* Mobile floating controls */}
      {renderMobileControls()}

      {/* State indicator */}
      {renderStateIndicator()}

      {/* Backdrop for mobile when panel is expanded */}
      {isMobile && panelState === 'expanded' && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setPanelState('minimized')}
        />
      )}
    </>
  );
};
