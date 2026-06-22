import { render, screen, fireEvent } from '@testing-library/react';
import { SpeciesListRow } from './SpeciesListRow';
import type { DeduplicatedObs } from '../utils/species';

const obs: DeduplicatedObs = {
  speciesCode: 'amerob', comName: 'American Robin',
  sciName: 'Turdus migratorius', locName: 'Central Park',
  obsDt: '2024-06-15 08:00', firstObsDt: '2024-06-15 08:00', howMany: 12,
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

  it('shows Notable pill when isNotable', () => {
    render(<SpeciesListRow obs={obs} isNotable={true} onClick={vi.fn()} />);
    expect(screen.getByText('Notable')).toBeInTheDocument();
  });

  it('does not show Notable pill when not notable', () => {
    render(<SpeciesListRow obs={obs} isNotable={false} onClick={vi.fn()} />);
    expect(screen.queryByText('Notable')).toBeNull();
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

  it('button has type="button"', () => {
    render(<SpeciesListRow obs={obs} isNotable={false} onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('shows single date when firstObsDt equals obsDt', () => {
    render(<SpeciesListRow obs={{ ...obs, obsDt: '2024-06-15 08:00', firstObsDt: '2024-06-15 08:00' }} isNotable={false} onClick={vi.fn()} />);
    expect(screen.getByText(/Jun 15, 2024/)).toBeInTheDocument();
    expect(screen.queryByText(/–/)).toBeNull();
  });

  it('shows date range with year only on last date when same year', () => {
    render(<SpeciesListRow obs={{ ...obs, obsDt: '2024-06-15 08:00', firstObsDt: '2024-06-01 08:00' }} isNotable={false} onClick={vi.fn()} />);
    expect(screen.getByText(/Jun 1 – Jun 15, 2024/)).toBeInTheDocument();
  });

  it('shows date range with year on both dates when different years', () => {
    render(<SpeciesListRow obs={{ ...obs, obsDt: '2024-01-03 08:00', firstObsDt: '2023-12-28 08:00' }} isNotable={false} onClick={vi.fn()} />);
    expect(screen.getByText(/Dec 28, 2023 – Jan 3, 2024/)).toBeInTheDocument();
  });
});
