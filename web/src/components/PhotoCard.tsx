import { useState } from 'react';
import { BookmarkPlus, ExternalLink, Pencil, ImageOff } from 'lucide-react';
import type { Photo } from '../types';

interface Props {
  photo: Photo;
  saved?: boolean;
  editable?: boolean;
  onSave?: () => void;
  onOpen: () => void;
}
export default function PhotoCard({ photo, saved, editable, onSave, onOpen }: Props) {
  const [failed, setFailed] = useState(false);
  return (
    <article className="photo-card">
      <div className="photo-frame" style={{ aspectRatio: `${photo.width} / ${photo.height}` }}>
        <button className="photo-open" aria-label={`Open ${photo.title}`} onClick={onOpen}>
          {failed ? (
            <span className="image-failed">
              <ImageOff />
              Image unavailable
            </span>
          ) : (
            <img
              src={photo.url}
              alt={photo.title}
              loading="lazy"
              decoding="async"
              onError={() => setFailed(true)}
            />
          )}
        </button>
        <div className="photo-shade" />
        {onSave && (
          <button className={`save-button ${saved ? 'is-saved' : ''}`} onClick={onSave}>
            <BookmarkPlus size={15} />
            {saved ? 'Saved' : 'Save'}
          </button>
        )}
        {editable && (
          <button className="save-button" onClick={onOpen}>
            <Pencil size={14} />
            Edit
          </button>
        )}
        {photo.sourceUrl && (
          <a
            className="photo-source"
            href={photo.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Original photo by ${photo.author}`}
          >
            <ExternalLink size={15} />
          </a>
        )}
      </div>
      <button className="photo-title" onClick={onOpen}>
        {photo.title}
      </button>
      <p className="photo-author">{photo.author}</p>
    </article>
  );
}
