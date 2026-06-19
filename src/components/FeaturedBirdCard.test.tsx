import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeaturedBirdCard, FeaturedBirdCardProps } from './FeaturedBirdCard';
import type { EBirdObservation, EBirdTaxon } from '../api/ebird';
import type { BirdPhoto } from '../api/inat';
import type { XCRecording } from '../api/xeno-canto';

const obs: EBirdObservation = {
  speciesCode: 'snobun',
  comName: 'Snow Bunting',
  sciName: 'Plectrophenax nivalis',
  locName: 'Central Park',
  obsDt: '2026-06-19 08:00',
  howMany: 1,
  lat: 40.78,
  lng: -73.97,
};

const taxon: EBirdTaxon = {
  sciName: 'Plectrophenax nivalis',
  comName: 'Snow Bunting',
  speciesCode: 'snobun',
  category: 'species',
  taxonOrder: 36000,
  bandingCodes: ['SNBU'],
  comNameCodes: ['SNBU'],
  sciNameCodes: ['PLNI'],
  order: 'Passeriformes',
  familyComName: 'Old World Sparrows',
  familySciName: 'Passeridae',
};

const photo: BirdPhoto = {
  photoUrl: 'https://example.com/medium.jpg',
  largeUrl: 'https://example.com/large.jpg',
  attribution: '(c) Test User, CC BY-NC',
  licenseCode: 'cc-by-nc',
};

const recording: XCRecording = {
  id: '1',
  gen: 'Plectrophenax',
  sp: 'nivalis',
  en: 'Snow Bunting',
  rec: 'Jane Doe',
  cnt: 'United States',
  loc: 'Central Park',
  lat: '40.78',
  lon: '-73.97',
  type: 'song',
  q: 'A',
  file: 'https://xeno-canto.org/sounds/uploaded/test.mp3',
  date: '2026-01-15',
  'file-name': 'test.mp3',
  sono: {
    small: 'https://xeno-canto.org/sono/small/test.png',
    med: 'https://xeno-canto.org/sono/med/test.png',
  },
};

const defaults: FeaturedBirdCardProps = {
  observation: obs,
  taxon,
  photo,
  recording,
  isNotable: false,
  mode: 'rarest',
  onToggleMode: vi.fn(),
  showToggle: true,
};

describe('FeaturedBirdCard', () => {
  it('renders common and scientific name', () => {
    render(<FeaturedBirdCard {...defaults} />);
    expect(screen.getByText('Snow Bunting')).toBeInTheDocument();
    expect(screen.getByText('Plectrophenax nivalis')).toBeInTheDocument();
  });

  it('renders taxonomy when provided', () => {
    render(<FeaturedBirdCard {...defaults} />);
    expect(screen.getByText(/Passeriformes/)).toBeInTheDocument();
    expect(screen.getByText(/Old World Sparrows/)).toBeInTheDocument();
  });

  it('shows photo as hero image when photo is provided', () => {
    render(<FeaturedBirdCard {...defaults} />);
    const img = screen.getByAltText('Snow Bunting') as HTMLImageElement;
    expect(img.src).toBe('https://example.com/medium.jpg');
  });

  it('shows spectrogram as hero when photo is null', () => {
    render(<FeaturedBirdCard {...defaults} photo={null} />);
    const img = screen.getByAltText(/Spectrogram of Snow Bunting/) as HTMLImageElement;
    expect(img.src).toBe('https://xeno-canto.org/sono/med/test.png');
  });

  it('shows fallback message when both photo and recording are null', () => {
    render(<FeaturedBirdCard {...defaults} photo={null} recording={null} />);
    expect(screen.getByText(/No image available/)).toBeInTheDocument();
  });

  it('shows Rare sighting badge when isNotable is true', () => {
    render(<FeaturedBirdCard {...defaults} isNotable />);
    expect(screen.getByText('Rare sighting')).toBeInTheDocument();
  });

  it('does not show badge when isNotable is false', () => {
    render(<FeaturedBirdCard {...defaults} isNotable={false} />);
    expect(screen.queryByText('Rare sighting')).not.toBeInTheDocument();
  });

  it('renders toggle buttons when showToggle is true', () => {
    render(<FeaturedBirdCard {...defaults} showToggle />);
    expect(screen.getByRole('button', { name: 'Rarest' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Most Common' })).toBeInTheDocument();
  });

  it('hides toggle when showToggle is false', () => {
    render(<FeaturedBirdCard {...defaults} showToggle={false} />);
    expect(screen.queryByRole('button', { name: 'Rarest' })).not.toBeInTheDocument();
  });

  it('calls onToggleMode when inactive toggle button is clicked', () => {
    const onToggleMode = vi.fn();
    render(<FeaturedBirdCard {...defaults} mode="rarest" onToggleMode={onToggleMode} />);
    fireEvent.click(screen.getByRole('button', { name: 'Most Common' }));
    expect(onToggleMode).toHaveBeenCalledOnce();
  });

  it('shows spectrogram section when photo and recording are both present', () => {
    render(<FeaturedBirdCard {...defaults} />);
    const imgs = screen.getAllByRole('img');
    const spectrogramImg = imgs.find(img => (img as HTMLImageElement).src.includes('sono'));
    expect(spectrogramImg).toBeTruthy();
  });

  it('hides spectrogram section when recording is null', () => {
    render(<FeaturedBirdCard {...defaults} recording={null} />);
    const imgs = screen.queryAllByRole('img');
    const spectrogramImg = imgs.find(img => (img as HTMLImageElement).src?.includes('sono'));
    expect(spectrogramImg).toBeUndefined();
  });

  it('displays photo attribution', () => {
    render(<FeaturedBirdCard {...defaults} />);
    expect(screen.getByText('(c) Test User, CC BY-NC')).toBeInTheDocument();
  });

  it('displays XC recordist name when recording is provided', () => {
    render(<FeaturedBirdCard {...defaults} />);
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
  });
});
