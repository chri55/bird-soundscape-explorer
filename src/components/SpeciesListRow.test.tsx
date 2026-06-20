import { render, screen, fireEvent } from '@testing-library/react';
import { SpeciesListRow } from './SpeciesListRow';
import type { EBirdObservation } from '../api/ebird';

const obs: EBirdObservation = {
  speciesCode: 'amerob', comName: 'American Robin',
  sciName: 'Turdus migratorius', locName: 'Central Park',
  obsDt: '2024-06-15 08:00', howMany: 12,
  lat: 40.78, lng: -73.97, obsValid: true, obsReviewed: false, locationPrivate: false,
};

describe('SpeciesListRow', () => {
  it('renders common name', () => {
    render(<SpeciesListRow obs={obs} isNotable={false} onClick={vi.fn()} />);
    expect(screen.getByText('American Robin')).toBeInTheDocument();
  });

  it('renders scientific name', () => {
    render(<SpeciesListRow obs={obs} isNotable={false} onClick={vi.fn()} />);
    expect(screen.getByText('Turdus migratorius')).toBeInTheDocument();
  });

  it('renders count badge when howMany > 0', () => {
    render(<SpeciesListRow obs={obs} isNotable={false} onClick={vi.fn()} />);
    expect(screen.getByText('12 seen')).toBeInTheDocument();
  });

  it('omits count badge when howMany is 0', () => {
    render(<SpeciesListRow obs={{ ...obs, howMany: 0 }} isNotable={false} onClick={vi.fn()} />);
    expect(screen.queryByText(/seen/)).toBeNull();
  });

  it('shows Rare pill when isNotable', () => {
    render(<SpeciesListRow obs={obs} isNotable={true} onClick={vi.fn()} />);
    expect(screen.getByText('Rare')).toBeInTheDocument();
  });

  it('does not show Rare pill when not notable', () => {
    render(<SpeciesListRow obs={obs} isNotable={false} onClick={vi.fn()} />);
    expect(screen.queryByText('Rare')).toBeNull();
  });

  it('calls onClick when the row is clicked', () => {
    const onClick = vi.fn();
    render(<SpeciesListRow obs={obs} isNotable={false} onClick={onClick} />);
    fireEvent.click(screen.getByText('American Robin'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders location name', () => {
    render(<SpeciesListRow obs={obs} isNotable={false} onClick={vi.fn()} />);
    expect(screen.getByText(/Central Park/)).toBeInTheDocument();
  });
});
