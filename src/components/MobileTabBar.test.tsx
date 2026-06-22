import { render, screen, fireEvent } from '@testing-library/react';
import { MobileTabBar } from './MobileTabBar';

describe('MobileTabBar', () => {
  it('renders Map and Species buttons', () => {
    render(<MobileTabBar activeTab="map" onTabChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Switch to map view' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Switch to species list' })).toBeTruthy();
  });

  it('applies active class to Map button when activeTab is map', () => {
    render(<MobileTabBar activeTab="map" onTabChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Switch to map view' }).className).toContain('text-green-400');
    expect(screen.getByRole('button', { name: 'Switch to species list' }).className).toContain('text-gray-400');
  });

  it('applies active class to Species button when activeTab is list', () => {
    render(<MobileTabBar activeTab="list" onTabChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Switch to map view' }).className).toContain('text-gray-400');
    expect(screen.getByRole('button', { name: 'Switch to species list' }).className).toContain('text-green-400');
  });

  it('calls onTabChange with "map" when Map button is clicked', () => {
    const onTabChange = vi.fn();
    render(<MobileTabBar activeTab="list" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to map view' }));
    expect(onTabChange).toHaveBeenCalledWith('map');
  });

  it('calls onTabChange with "list" when Species button is clicked', () => {
    const onTabChange = vi.fn();
    render(<MobileTabBar activeTab="map" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to species list' }));
    expect(onTabChange).toHaveBeenCalledWith('list');
  });
});
