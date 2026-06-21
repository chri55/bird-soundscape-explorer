import { render, screen, fireEvent } from '@testing-library/react';
import { SpeciesPanel } from './SpeciesPanel';
import type { EBirdObservation } from '../api/ebird';

vi.mock('../api/inat', () => ({ fetchBirdPhoto: vi.fn().mockResolvedValue(null) }));
vi.mock('../api/ebird', () => ({
  fetchTaxonomy: vi.fn().mockResolvedValue([]),
  fetchRecentNearby: vi.fn(),
  fetchNearbyNotable: vi.fn(),
  clearTaxonomyCache: vi.fn(),
}));

function makeObs(comName: string, howMany: number, locName = 'SF'): EBirdObservation {
  return {
    speciesCode: comName.replace(' ', ''), comName, sciName: comName.toLowerCase().replace(' ', '.'),
    locName, obsDt: '2024-06-15 08:00', howMany,
    lat: 37.77, lng: -122.4, obsValid: true, obsReviewed: false, locationPrivate: false,
  };
}

describe('SpeciesPanel', () => {
  it('shows empty state when no obs and not loading', () => {
    render(<SpeciesPanel notableObs={[]} recentObs={[]} recordings={[]} isLoading={false} />);
    expect(screen.getByText(/Drop a pin/)).toBeInTheDocument();
  });

  it('shows skeleton rows when isLoading', () => {
    const { container } = render(
      <SpeciesPanel notableObs={[]} recentObs={[]} recordings={[]} isLoading={true} />,
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders Rarest Sightings section when notableObs present', () => {
    render(
      <SpeciesPanel
        notableObs={[makeObs('Snow Bunting', 1)]}
        recentObs={[]}
        recordings={[]}
        isLoading={false}
      />,
    );
    expect(screen.getByText('Rarest Sightings')).toBeInTheDocument();
    expect(screen.getByText('Snow Bunting')).toBeInTheDocument();
  });

  it('renders Most Common section when recentObs present', () => {
    render(
      <SpeciesPanel
        notableObs={[]}
        recentObs={[makeObs('American Robin', 10)]}
        recordings={[]}
        isLoading={false}
      />,
    );
    expect(screen.getByText('Most Common')).toBeInTheDocument();
    expect(screen.getByText('American Robin')).toBeInTheDocument();
  });

  it('deduplicates recentObs by sciName', () => {
    const obs = [makeObs('American Robin', 5), makeObs('American Robin', 3)];
    render(<SpeciesPanel notableObs={[]} recentObs={obs} recordings={[]} isLoading={false} />);
    const rows = screen.getAllByText('American Robin');
    expect(rows).toHaveLength(1);
  });

  it('sorts Most Common by summed howMany descending', () => {
    const obs = [makeObs('Sparrow', 2), makeObs('Robin', 10)];
    render(<SpeciesPanel notableObs={[]} recentObs={obs} recordings={[]} isLoading={false} />);
    const items = screen.getAllByText(/Sparrow|Robin/);
    expect(items[0].textContent).toBe('Robin');
  });

  it('clicking a row shows the detail view', () => {
    render(
      <SpeciesPanel
        notableObs={[makeObs('Snow Bunting', 1)]}
        recentObs={[]}
        recordings={[]}
        isLoading={false}
      />,
    );
    fireEvent.click(screen.getByText('Snow Bunting'));
    expect(screen.getByText('← Back')).toBeInTheDocument();
  });

  it('Back button returns to list view', () => {
    render(
      <SpeciesPanel
        notableObs={[makeObs('Snow Bunting', 1)]}
        recentObs={[]}
        recordings={[]}
        isLoading={false}
      />,
    );
    fireEvent.click(screen.getByText('Snow Bunting'));
    fireEvent.click(screen.getByText('← Back'));
    expect(screen.getByText('Rarest Sightings')).toBeInTheDocument();
  });

  it('shows filter input when species are loaded', () => {
    render(
      <SpeciesPanel
        notableObs={[makeObs('Snow Bunting', 1)]}
        recentObs={[]}
        recordings={[]}
        isLoading={false}
      />,
    );
    expect(screen.getByPlaceholderText('Filter birds…')).toBeInTheDocument();
  });

  it('filters species by common name substring', () => {
    render(
      <SpeciesPanel
        notableObs={[makeObs('Snow Bunting', 1), makeObs('American Robin', 2)]}
        recentObs={[]}
        recordings={[]}
        isLoading={false}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Filter birds…'), { target: { value: 'snow' } });
    expect(screen.getByText('Snow Bunting')).toBeInTheDocument();
    expect(screen.queryByText('American Robin')).not.toBeInTheDocument();
  });

  it('filters species by scientific name substring', () => {
    render(
      <SpeciesPanel
        notableObs={[makeObs('Snow Bunting', 1)]}
        recentObs={[]}
        recordings={[]}
        isLoading={false}
      />,
    );
    // makeObs sets sciName = comName.toLowerCase().replace(' ', '.') → 'snow.bunting'
    fireEvent.change(screen.getByPlaceholderText('Filter birds…'), { target: { value: 'snow.bunt' } });
    expect(screen.getByText('Snow Bunting')).toBeInTheDocument();
  });

  it('shows No matches when filter has no results', () => {
    render(
      <SpeciesPanel
        notableObs={[makeObs('Snow Bunting', 1)]}
        recentObs={[]}
        recordings={[]}
        isLoading={false}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Filter birds…'), { target: { value: 'xyz' } });
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('resets filter when notableObs prop changes', () => {
    const { rerender } = render(
      <SpeciesPanel
        notableObs={[makeObs('Snow Bunting', 1)]}
        recentObs={[]}
        recordings={[]}
        isLoading={false}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Filter birds…'), { target: { value: 'snow' } });
    expect(screen.getByPlaceholderText('Filter birds…')).toHaveValue('snow');

    rerender(
      <SpeciesPanel
        notableObs={[makeObs('American Robin', 2)]}
        recentObs={[]}
        recordings={[]}
        isLoading={false}
      />,
    );
    expect(screen.getByPlaceholderText('Filter birds…')).toHaveValue('');
  });
});
