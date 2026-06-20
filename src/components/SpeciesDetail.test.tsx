import { render, screen, act } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { SpeciesDetail } from './SpeciesDetail';
import { fetchBirdPhoto } from '../api/inat';
import { fetchTaxonomy } from '../api/ebird';
import type { EBirdObservation } from '../api/ebird';
import { fetchWikiSummary } from '../api/wikipedia';

vi.mock('../api/inat', () => ({ fetchBirdPhoto: vi.fn() }));
vi.mock('../api/ebird', () => ({
  fetchTaxonomy: vi.fn(),
  fetchRecentNearby: vi.fn(),
  fetchNearbyNotable: vi.fn(),
  clearTaxonomyCache: vi.fn(),
}));
vi.mock('../api/wikipedia', () => ({ fetchWikiSummary: vi.fn() }));

const obs: EBirdObservation = {
  speciesCode: 'amerob', comName: 'American Robin',
  sciName: 'Turdus migratorius', locName: 'Central Park',
  obsDt: '2024-06-15 08:00', howMany: 12,
  lat: 40.78, lng: -73.97, obsValid: true, obsReviewed: false, locationPrivate: false,
};

beforeEach(() => {
  vi.mocked(fetchBirdPhoto).mockResolvedValue(null);
  vi.mocked(fetchTaxonomy).mockResolvedValue([]);
  vi.mocked(fetchWikiSummary).mockResolvedValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('SpeciesDetail', () => {
  it('shows skeleton while loading', () => {
    vi.mocked(fetchBirdPhoto).mockImplementation(() => new Promise(() => {}));
    const { container } = render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders common name after load', async () => {
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    });
    expect(screen.getByText('American Robin')).toBeInTheDocument();
  });

  it('renders scientific name after load', async () => {
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    });
    expect(screen.getByText('Turdus migratorius')).toBeInTheDocument();
  });

  it('shows photo when fetchBirdPhoto resolves with one', async () => {
    vi.mocked(fetchBirdPhoto).mockResolvedValue({
      photoUrl: 'https://img.jpg', largeUrl: 'https://img-l.jpg',
      attribution: '© Test Photographer', licenseCode: 'cc-by',
    });
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    });
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://img.jpg');
  });

  it('shows placeholder text when no photo', async () => {
    vi.mocked(fetchBirdPhoto).mockResolvedValue(null);
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    });
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getAllByText('American Robin').length).toBeGreaterThan(0);
  });

  it('shows taxonomy when fetchTaxonomy resolves', async () => {
    vi.mocked(fetchTaxonomy).mockResolvedValue([{
      sciName: 'Turdus migratorius', comName: 'American Robin',
      speciesCode: 'amerob', category: 'species', taxonOrder: 1,
      bandingCodes: [], comNameCodes: [], sciNameCodes: [],
      order: 'Passeriformes', familyComName: 'Thrushes', familySciName: 'Turdidae',
    }]);
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    });
    expect(screen.getByText(/Passeriformes/)).toBeInTheDocument();
    expect(screen.getByText(/Thrushes/)).toBeInTheDocument();
  });

  it('shows recording credit when a matching recording is provided', async () => {
    const rec = {
      id: '1', gen: 'Turdus', sp: 'migratorius', en: 'American Robin',
      rec: 'Jane Smith', cnt: 'US', loc: 'SF', lat: '37', lon: '-122',
      type: 'song', q: 'A', file: 'https://xc.org/1.mp3', date: '2024-01-01',
      'file-name': '1.mp3', sono: { small: 'https://xc.org/sono.png', med: 'https://xc.org/sonom.png' },
    };
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[rec]} onBack={vi.fn()} />);
    });
    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', async () => {
    const onBack = vi.fn();
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={onBack} />);
    });
    fireEvent.click(screen.getByText(/Back/));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows Wikipedia extract when summary is available', async () => {
    vi.mocked(fetchWikiSummary).mockResolvedValue({
      extract: 'The American Robin is a migratory thrush.',
      pageUrl: 'https://en.wikipedia.org/wiki/American_robin',
    });
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    });
    expect(screen.getByText('The American Robin is a migratory thrush.')).toBeInTheDocument();
  });

  it('shows Wikipedia link when summary is available', async () => {
    vi.mocked(fetchWikiSummary).mockResolvedValue({
      extract: 'A bird.',
      pageUrl: 'https://en.wikipedia.org/wiki/American_robin',
    });
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    });
    const wikiLink = screen.getByText('Wikipedia ↗');
    expect(wikiLink).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/American_robin');
  });

  it('always shows eBird link', async () => {
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    });
    const ebirdLink = screen.getByText('eBird ↗');
    expect(ebirdLink).toHaveAttribute('href', 'https://ebird.org/species/amerob');
  });

  it('omits Wikipedia section when summary is null', async () => {
    vi.mocked(fetchWikiSummary).mockResolvedValue(null);
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    });
    expect(screen.queryByText('Wikipedia ↗')).toBeNull();
  });
});
