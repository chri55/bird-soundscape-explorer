import { render, screen, fireEvent } from '@testing-library/react';
import { PoiSearch } from './PoiSearch';
import type { SearchItem } from './PoiSearch';

function makeItem(name: string, lat: number, lng: number, subtitle: string): SearchItem {
  return { name, lat, lng, subtitle };
}

const parkItems: SearchItem[] = [
  makeItem('Yellowstone National Park', 44.42, -110.58, 'U.S. National Park'),
  makeItem('Yosemite National Park', 37.86, -119.53, 'U.S. National Park'),
  makeItem('Grand Canyon National Park', 36.10, -112.09, 'U.S. National Park'),
];

describe('PoiSearch', () => {
  it('shows no dropdown when query is empty', () => {
    render(<PoiSearch items={parkItems} onSelect={vi.fn()} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('filters items by case-insensitive substring match', () => {
    render(<PoiSearch items={parkItems} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'yello' } });
    expect(screen.getByText('Yellowstone National Park')).toBeInTheDocument();
    expect(screen.queryByText('Yosemite National Park')).not.toBeInTheDocument();
  });

  it('calls onSelect with lat/lng when a result is clicked', () => {
    const onSelect = vi.fn();
    render(<PoiSearch items={parkItems} onSelect={onSelect} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'yellow' } });
    fireEvent.click(screen.getByText('Yellowstone National Park'));
    expect(onSelect).toHaveBeenCalledWith({ lat: 44.42, lng: -110.58 });
  });

  it('clears input and closes dropdown after selection', () => {
    render(<PoiSearch items={parkItems} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'yellow' } });
    fireEvent.click(screen.getByText('Yellowstone National Park'));
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('clears input and closes dropdown on Escape', () => {
    render(<PoiSearch items={parkItems} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'yellow' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('caps results at 8', () => {
    const manyItems: SearchItem[] = Array.from({ length: 15 }, (_, i) =>
      makeItem(`Park ${i} National Park`, 39.0 + i, -105.0, 'U.S. National Park'),
    );
    render(<PoiSearch items={manyItems} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'park' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
  });

  it('shows subtitle for each result type in mixed results', () => {
    const mixed: SearchItem[] = [
      makeItem('Yellowstone National Park', 44.42, -110.58, 'U.S. National Park'),
      makeItem('Central Park Birding Area', 40.78, -73.97, 'Birding Hotspot'),
    ];
    render(<PoiSearch items={mixed} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'park' } });
    expect(screen.getByText('U.S. National Park')).toBeInTheDocument();
    expect(screen.getByText('Birding Hotspot')).toBeInTheDocument();
  });
});
