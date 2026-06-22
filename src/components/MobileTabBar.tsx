import type { JSX } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMap, faList } from '@fortawesome/free-solid-svg-icons';

export type MobileTab = 'map' | 'list';

export interface MobileTabBarProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

export function MobileTabBar({ activeTab, onTabChange }: MobileTabBarProps): JSX.Element {
  return (
    <div className="md:hidden bg-gray-900 text-white flex shrink-0 border-t border-gray-700">
      <button
        type="button"
        aria-label="Switch to map view"
        onClick={() => onTabChange('map')}
        className={`flex-1 py-3 flex flex-col items-center gap-1 text-sm ${
          activeTab === 'map' ? 'text-green-400' : 'text-gray-400'
        }`}
      >
        <FontAwesomeIcon icon={faMap} />
        <span>Map</span>
      </button>
      <button
        type="button"
        aria-label="Switch to species list"
        onClick={() => onTabChange('list')}
        className={`flex-1 py-3 flex flex-col items-center gap-1 text-sm ${
          activeTab === 'list' ? 'text-green-400' : 'text-gray-400'
        }`}
      >
        <FontAwesomeIcon icon={faList} />
        <span>Species</span>
      </button>
    </div>
  );
}
