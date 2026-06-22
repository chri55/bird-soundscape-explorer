import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsModal } from './SettingsModal';
import type { EBirdObservation } from '../api/ebird';
import type { ExclusionEntry } from '../hooks/useExclusionList';

function makeObs(sciName: string, comName: string): EBirdObservation {
  return {
    speciesCode: sciName.replace(' ', ''), comName, sciName,
    locName: 'SF', obsDt: '2024-01-01', howMany: 1,
    lat: 37.77, lng: -122.4, obsValid: true, obsReviewed: true, locationPrivate: false,
  };
}

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  availableObs: [] as EBirdObservation[],
  exclusions: [] as ExclusionEntry[],
  onAddExclusion: vi.fn(),
  onRemoveExclusion: vi.fn(),
};

describe('SettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('renders nothing when isOpen is false', () => {
    const { container } = render(<SettingsModal {...baseProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal heading when isOpen is true', () => {
    render(<SettingsModal {...baseProps} />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('disables search input when availableObs is empty', () => {
    render(<SettingsModal {...baseProps} availableObs={[]} />);
    expect(screen.getByPlaceholderText('Drop a pin to see birds')).toBeDisabled();
  });

  it('shows filtered results when typing a matching substring', () => {
    const obs = [makeObs('Branta canadensis', 'Canada Goose')];
    render(<SettingsModal {...baseProps} availableObs={obs} />);
    fireEvent.change(screen.getByPlaceholderText('Search loaded birds…'), { target: { value: 'canada' } });
    expect(screen.getByText('Canada Goose')).toBeInTheDocument();
  });

  it('does not show result for already-excluded species', () => {
    const obs = [makeObs('Branta canadensis', 'Canada Goose')];
    const exclusions: ExclusionEntry[] = [{ sciName: 'Branta canadensis', comName: 'Canada Goose' }];
    render(<SettingsModal {...baseProps} availableObs={obs} exclusions={exclusions} />);
    fireEvent.change(screen.getByPlaceholderText('Search loaded birds…'), { target: { value: 'canada' } });
    // The result in the dropdown is filtered out; only the exclusion list entry shows
    const matches = screen.queryAllByText('Canada Goose');
    // Exclusion list shows one instance; dropdown result is absent
    expect(matches).toHaveLength(1);
  });

  it('calls onAddExclusion with sciName and comName when a result is clicked', () => {
    const onAddExclusion = vi.fn();
    const obs = [makeObs('Branta canadensis', 'Canada Goose')];
    render(<SettingsModal {...baseProps} availableObs={obs} onAddExclusion={onAddExclusion} />);
    fireEvent.change(screen.getByPlaceholderText('Search loaded birds…'), { target: { value: 'canada' } });
    fireEvent.click(screen.getByText('Canada Goose'));
    expect(onAddExclusion).toHaveBeenCalledWith('Branta canadensis', 'Canada Goose');
  });

  it('shows empty-state text when exclusions list is empty', () => {
    render(<SettingsModal {...baseProps} exclusions={[]} />);
    expect(screen.getByText(/No birds excluded/)).toBeInTheDocument();
  });

  it('shows excluded species in the exclusion list', () => {
    const exclusions: ExclusionEntry[] = [{ sciName: 'Branta canadensis', comName: 'Canada Goose' }];
    render(<SettingsModal {...baseProps} exclusions={exclusions} />);
    expect(screen.getByText('Canada Goose')).toBeInTheDocument();
  });

  it('calls onRemoveExclusion with sciName when X button is clicked', () => {
    const onRemoveExclusion = vi.fn();
    const exclusions: ExclusionEntry[] = [{ sciName: 'Branta canadensis', comName: 'Canada Goose' }];
    render(<SettingsModal {...baseProps} exclusions={exclusions} onRemoveExclusion={onRemoveExclusion} />);
    fireEvent.click(screen.getByLabelText('Remove Canada Goose'));
    expect(onRemoveExclusion).toHaveBeenCalledWith('Branta canadensis');
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<SettingsModal {...baseProps} onClose={onClose} />);
    fireEvent.click(container.firstChild as Element);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when modal card is clicked', () => {
    const onClose = vi.fn();
    render(<SettingsModal {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Settings'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders About section with data sources', () => {
    render(<SettingsModal {...baseProps} />);
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('eBird')).toBeInTheDocument();
    expect(screen.getByText('Xeno-canto')).toBeInTheDocument();
    expect(screen.getByText('iNaturalist')).toBeInTheDocument();
  });
});
