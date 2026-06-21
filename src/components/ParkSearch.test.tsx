import { render, screen, fireEvent } from '@testing-library/react';
import { ParkSearch } from './ParkSearch';
import type { NpsPark } from '../api/nps';

function makePark(name: string, lat: string, lng: string, code: string): NpsPark {
  return { parkCode: code, fullName: name, latitude: lat, longitude: lng };
}

const parks: NpsPark[] = [
  makePark('Yellowstone National Park', '44.42', '-110.58', 'yell'),
  makePark('Yosemite National Park', '37.86', '-119.53', 'yose'),
  makePark('Grand Canyon National Park', '36.10', '-112.09', 'grca'),
];

describe('ParkSearch', () => {
  it('shows no dropdown when query is empty', () => {
    render(<ParkSearch parks={parks} onSelect={vi.fn()} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('filters parks by case-insensitive substring match', () => {
    render(<ParkSearch parks={parks} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'yello' } });
    expect(screen.getByText('Yellowstone National Park')).toBeInTheDocument();
    expect(screen.queryByText('Yosemite National Park')).not.toBeInTheDocument();
  });

  it('calls onSelect with parsed lat/lng when a result is clicked', () => {
    const onSelect = vi.fn();
    render(<ParkSearch parks={parks} onSelect={onSelect} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'yellow' } });
    fireEvent.click(screen.getByText('Yellowstone National Park'));
    expect(onSelect).toHaveBeenCalledWith({ lat: 44.42, lng: -110.58 });
  });

  it('clears input and closes dropdown after selection', () => {
    render(<ParkSearch parks={parks} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'yellow' } });
    fireEvent.click(screen.getByText('Yellowstone National Park'));
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('clears input and closes dropdown on Escape', () => {
    render(<ParkSearch parks={parks} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'yellow' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('caps results at 8', () => {
    const manyParks: NpsPark[] = Array.from({ length: 15 }, (_, i) =>
      makePark(`Park ${i} National Park`, '39.0', '-105.0', `p${i}`),
    );
    render(<ParkSearch parks={manyParks} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'park' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
  });
});
