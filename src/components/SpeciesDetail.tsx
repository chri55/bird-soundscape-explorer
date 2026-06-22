import { useState, useEffect, useRef } from 'react';
import type { JSX } from 'react';
import type { EBirdObservation, EBirdTaxon } from '../api/ebird';
import { fetchTaxonomy } from '../api/ebird';
import type { BirdPhoto } from '../api/inat';
import { fetchBirdPhoto } from '../api/inat';
import type { XCRecording } from '../api/xeno-canto';
import { fetchRecordings } from '../api/xeno-canto';
import { bestRecording } from '../utils/species';
import { Skeleton } from './Skeleton';
import type { WikiSummary } from '../api/wikipedia';
import { fetchWikiSummary } from '../api/wikipedia';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faStop, faSpinner } from '@fortawesome/free-solid-svg-icons';

export interface SpeciesDetailProps {
  obs: EBirdObservation;
  recordings: XCRecording[];
  onBack: () => void;
}

export function SpeciesDetail({ obs, recordings, onBack }: SpeciesDetailProps): JSX.Element {
  const [photo, setPhoto] = useState<BirdPhoto | null>(null);
  const [taxon, setTaxon] = useState<EBirdTaxon | null>(null);
  const [loading, setLoading] = useState(true);
  const [wikiSummary, setWikiSummary] = useState<WikiSummary | null>(null);
  const [playState, setPlayState] = useState<'idle' | 'loading' | 'playing' | 'none'>('idle');
  const [playRecording, setPlayRecording] = useState<XCRecording | null>(null);
  const playAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchBirdPhoto(obs.sciName),
      fetchTaxonomy([obs.speciesCode]),
      fetchWikiSummary(obs.comName).then(r => r ?? fetchWikiSummary(obs.sciName)),
    ])
      .then(([p, taxa, wiki]) => {
        if (!cancelled) {
          setPhoto(p);
          setTaxon(taxa[0] ?? null);
          setWikiSummary(wiki);
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [obs.sciName, obs.speciesCode, obs.comName]);

  // Reset play state when the species changes
  useEffect(() => {
    if (playAudioRef.current) {
      playAudioRef.current.pause();
      playAudioRef.current = null;
    }
    setPlayState('idle');
    setPlayRecording(null);
  }, [obs.sciName]);

  // Pause audio on unmount
  useEffect(() => {
    return () => {
      playAudioRef.current?.pause();
    };
  }, []);

  const recording = bestRecording(obs.sciName, recordings);

  const datePart = obs.obsDt.split(' ')[0] ?? obs.obsDt;
  const [year, month, day] = datePart.split('-').map(Number);
  const dateStr = new Date(year, (month ?? 1) - 1, day ?? 1)
    .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  async function handlePlay() {
    if (playState === 'playing') {
      playAudioRef.current?.pause();
      playAudioRef.current?.load();
      setPlayState('idle');
      return;
    }
    if (playState === 'loading' || playState === 'none') return;

    setPlayState('loading');

    let rec = playRecording;
    if (!rec) {
      const parts = obs.sciName.trim().split(/\s+/);
      if (parts.length < 2 || !/^[A-Za-z]+$/.test(parts[1]!)) {
        setPlayState('none');
        return;
      }
      const [genus, species] = parts;
      try {
        const response = await fetchRecordings(`gen:${genus} sp:${species}`);
        rec = bestRecording(obs.sciName, response.recordings);
      } catch {
        setPlayState('idle');
        return;
      }
      if (!rec) {
        setPlayState('none');
        return;
      }
      setPlayRecording(rec);
    }

    const audio = new Audio(rec.file);
    playAudioRef.current = audio;
    audio.addEventListener('ended', () => setPlayState('idle'), { once: true });
    void audio.play()
      .then(() => setPlayState('playing'))
      .catch(() => setPlayState('idle'));
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Back button */}
      <div className="shrink-0 px-4 py-2 border-b border-gray-100">
        <button
          type="button"
          aria-label="Back to species list"
          onClick={onBack}
          className="text-sm text-green-700 hover:text-green-900 font-medium flex items-center gap-1"
        >
          <span aria-hidden="true">←</span> Back
        </button>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          <Skeleton className="w-full aspect-video" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : (
        <>
          {/* Hero */}
          <div className="shrink-0">
            {photo ? (
              <img
                src={photo.photoUrl}
                alt={obs.comName}
                className="w-full aspect-video object-cover"
              />
            ) : (
              <div className="w-full aspect-video bg-gray-800" />
            )}
          </div>

          {/* Names */}
          <div className="px-4 pt-3 pb-1">
            <h2 className="text-lg font-bold text-gray-900 leading-tight">{obs.comName}</h2>
            <p className="text-sm italic text-gray-500 mt-0.5">{obs.sciName}</p>
          </div>

          {/* Taxonomy */}
          {taxon && (
            <div className="px-4 py-1 text-xs text-gray-500">
              {taxon.order} · {taxon.familyComName}
            </div>
          )}

          {/* Wikipedia summary */}
          {wikiSummary && (
            <div className="px-4 py-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Wikipedia</p>
              <p className="text-sm text-gray-700 leading-relaxed">{wikiSummary.extract}</p>
            </div>
          )}

          {/* Observation data */}
          <div className="px-4 py-2 text-xs text-gray-600 space-y-1">
            {(obs.howMany ?? 0) > 0 && <p>{obs.howMany} seen</p>}
            <p>{dateStr}</p>
            <p>{obs.locName}</p>
          </div>

          {/* Recording credit */}
          {recording && (
            <div className="px-4 py-2 text-xs text-gray-500">
              <p>Recording by {recording.rec} · {recording.type} · Quality {recording.q}</p>
            </div>
          )}

          {/* External links */}
          <div className="px-4 py-3 flex gap-2 border-t border-gray-100">
            {wikiSummary && (
              <a
                href={wikiSummary.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Wikipedia (opens in new tab)"
                className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
              >
                Wikipedia ↗
              </a>
            )}
            <a
              href={`https://ebird.org/species/${obs.speciesCode}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="eBird species page (opens in new tab)"
              className="text-xs px-3 py-1.5 rounded-full bg-green-50 text-green-700 hover:bg-green-100 font-medium"
            >
              eBird ↗
            </a>
            <button
              type="button"
              onClick={() => void handlePlay()}
              disabled={playState === 'none' || playState === 'loading'}
              aria-label={
                playState === 'idle' ? 'Play call' :
                playState === 'loading' ? 'Loading' :
                playState === 'playing' ? 'Stop' : 'No recording'
              }
              className={`text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5 ${
                playState === 'none'
                  ? 'bg-gray-100 text-gray-400 cursor-default'
                  : 'bg-green-50 text-green-700 hover:bg-green-100'
              }`}
            >
              <FontAwesomeIcon
                icon={playState === 'loading' ? faSpinner : playState === 'playing' ? faStop : faPlay}
                className={playState === 'loading' ? 'fa-spin' : ''}
              />
              {playState === 'idle' && 'Play call'}
              {playState === 'loading' && 'Loading…'}
              {playState === 'playing' && 'Stop'}
              {playState === 'none' && 'No recording'}
            </button>
          </div>

          {playRecording && (
            <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100">
              <p>Rec: {playRecording.rec} · {playRecording.type} · Quality {playRecording.q} · {playRecording.loc}</p>
            </div>
          )}

          {/* Photo attribution */}
          {photo && (
            <div className="px-4 py-3 text-xs text-gray-500 border-t border-gray-100">
              <p>{photo.attribution}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
