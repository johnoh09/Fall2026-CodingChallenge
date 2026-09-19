import { Link } from 'react-router-dom';
import { ArrowUpRight, LockKeyhole, Users, Images } from 'lucide-react';
import type { Board } from '../types';
export default function BoardCard({ board }: { board: Board }) {
  return (
    <Link className="board-card" to={`/board/${board.id}`}>
      <div
        className={`board-mosaic mosaic-${Math.min(board.covers.length, 3)}`}
        style={{ background: board.color }}
      >
        {board.covers.length ? (
          board.covers
            .slice(0, 3)
            .map((url, index) => <img key={index} src={url} alt="" loading="lazy" />)
        ) : (
          <Images size={34} />
        )}
        <span className="board-arrow">
          <ArrowUpRight size={18} />
        </span>
      </div>
      <div className="board-label">
        <h3>{board.name}</h3>
        {board.shareMode === 'private' ? <LockKeyhole size={14} /> : <Users size={15} />}
      </div>
      <p>
        {board.count} {board.count === 1 ? 'save' : 'saves'} ·{' '}
        {board.role === 'owner' ? 'Your collection' : 'Shared with you'}
      </p>
    </Link>
  );
}
