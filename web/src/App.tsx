import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useMatch, useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Snackbar,
} from '@mui/material';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  Compass,
  FolderHeart,
  Grid2X2,
  Leaf,
  LogOut,
  Plus,
  Search,
  Share2,
  Sparkles,
  Trash2,
  Users,
  Pencil,
  LockKeyhole,
} from 'lucide-react';
import { api, json, messageOf } from './api';
import type { Board, Photo, Pin, SearchResult, User } from './types';
import PhotoCard from './components/PhotoCard';
import UploadDialog from './components/UploadDialog';
import BoardCard from './components/BoardCard';
import {
  AuthDialog,
  BoardDialog,
  ImageDialog,
  SaveDialog,
  ShareDialog,
} from './components/Dialogs';

export default function App() {
  const navigate = useNavigate(),
    location = useLocation();
  const boardMatch = useMatch('/board/:id'),
    sharedMatch = useMatch('/share/:token');
  const boardId = boardMatch?.params.id,
    shareToken = sharedMatch?.params.token;
  const inBoard = Boolean(boardId || shareToken),
    inLibrary = location.pathname === '/collections';
  const [user, setUser] = useState<User | null>(null),
    [boards, setBoards] = useState<Board[]>([]),
    [board, setBoard] = useState<Board | null>(null);
  const [bootError, setBootError] = useState(''),
    [pageError, setPageError] = useState(''),
    [boardLoading, setBoardLoading] = useState(false);
  const [input, setInput] = useState(''),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(1),
    [searchData, setSearchData] = useState<SearchResult | null>(null),
    [searchBusy, setSearchBusy] = useState(false),
    [searchError, setSearchError] = useState('');
  const [adding, setAdding] = useState(false),
    [authOpen, setAuthOpen] = useState(false),
    [boardDialog, setBoardDialog] = useState<Board | 'new' | null>(null),
    [savePhoto, setSavePhoto] = useState<Photo | null>(null),
    [openPhoto, setOpenPhoto] = useState<Photo | Pin | null>(null),
    [shareOpen, setShareOpen] = useState(false),
    [deleteOpen, setDeleteOpen] = useState(false),
    [deleteBusy, setDeleteBusy] = useState(false),
    [deleteError, setDeleteError] = useState('');
  const [toast, setToast] = useState(''),
    [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [preferredSaveBoard, setPreferredSaveBoard] = useState<string>();
  const [searchRetry, setSearchRetry] = useState(0);
  const revision = useRef(0),
    path = useRef(location.pathname);
  path.current = location.pathname;
  const showDiscover = !inLibrary && (!inBoard || adding);

  useEffect(() => {
    api<{ user: User }>('/auth/session')
      .then((data) => setUser(data.user))
      .catch((err) => setBootError(messageOf(err)));
  }, []);
  const loadBoards = useCallback(async () => {
    const data = await api<{ boards: Board[] }>('/boards');
    setBoards(data.boards);
  }, []);
  const loadBoard = useCallback(
    async (notify = false) => {
      if (!boardId && !shareToken) return;
      const currentPath = path.current;
      const data = await api<Board>(
        shareToken ? `/boards/shared/${shareToken}` : `/boards/${boardId}`,
      );
      if (currentPath !== path.current) return;
      if (notify && revision.current && revision.current !== data.revision)
        setToast('This collection was updated. You’re seeing the latest version.');
      revision.current = data.revision;
      setBoard(data);
      setPageError('');
    },
    [boardId, shareToken],
  );
  useEffect(() => {
    if (!user) return;
    setPageError('');
    setSavedIds(new Set());
    loadBoards().catch((err) => setPageError(messageOf(err)));
  }, [user?.id, loadBoards]);
  useEffect(() => {
    setAdding(false);
    setOpenPhoto(null);
    setSavePhoto(null);
    setPreferredSaveBoard(undefined);
    setShareOpen(false);
    setBoard(null);
    setPageError('');
    revision.current = 0;
    if (!user || !inBoard) return;
    let cancelled = false;
    setBoardLoading(true);
    loadBoard()
      .catch((err) => {
        if (!cancelled) setPageError(messageOf(err));
      })
      .finally(() => {
        if (!cancelled) setBoardLoading(false);
      });
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible')
        loadBoard(true).catch((err) => {
          if (!cancelled) {
            setBoard(null);
            setPageError(messageOf(err));
          }
        });
    }, 7000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user?.id, boardId, shareToken, inBoard, loadBoard]);
  useEffect(() => {
    if (!user || !showDiscover) return;
    const controller = new AbortController();
    setSearchBusy(true);
    setSearchError('');
    if (page === 1) setSearchData(null);
    api<SearchResult>(`/images?q=${encodeURIComponent(query)}&page=${page}`, {
      signal: controller.signal,
    })
      .then((data) =>
        setSearchData((old) => ({
          ...data,
          images: page === 1 ? data.images : [...(old?.images || []), ...data.images],
        })),
      )
      .catch((err) => {
        if (!controller.signal.aborted) setSearchError(messageOf(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearchBusy(false);
      });
    return () => controller.abort();
  }, [user?.id, query, page, showDiscover, searchRetry]);

  async function refresh() {
    await Promise.all([loadBoards(), loadBoard()]);
  }
  function search(value: string) {
    setInput(value);
    setQuery(value.trim());
    setPage(1);
  }
  async function updatePin(title: string, note: string) {
    if (!board || !openPhoto || !('version' in openPhoto)) return;
    await api(
      `/boards/${board.id}/pins/${openPhoto.id}`,
      json('PATCH', { title, note, version: openPhoto.version }),
      shareToken,
    );
    await refresh();
    setToast('Your changes are saved.');
  }
  async function removePin() {
    if (!board || !openPhoto) return;
    await api(`/boards/${board.id}/pins/${openPhoto.id}`, json('DELETE'), shareToken);
    await refresh();
    setToast('Image removed from this collection.');
  }
  async function deleteBoard() {
    if (!board) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await api(`/boards/${board.id}`, json('DELETE'));
      setDeleteOpen(false);
      navigate('/collections');
      await loadBoards();
      setToast('Collection deleted.');
    } catch (err) {
      setDeleteError(messageOf(err));
    } finally {
      setDeleteBusy(false);
    }
  }
  const editableBoards = boards.filter((b) => b.role !== 'viewer');
  if (board && board.role !== 'viewer' && !editableBoards.some((b) => b.id === board.id))
    editableBoards.unshift(board);
  const totalSaves = boards.reduce((count, b) => count + b.count, 0);

  if (bootError)
    return (
      <div className="boot-state">
        <FolderHeart size={42} />
        <h1>Let’s get connected</h1>
        <p>{bootError}</p>
        <p>
          Run <code>npm run dev</code> in the project folder to start both servers.
        </p>
        <Button variant="contained" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    );
  if (!user)
    return (
      <div className="boot-state">
        <CircularProgress />
        <p>Opening your workspace…</p>
      </div>
    );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/">
          <span className="brand-mark">
            <span />
          </span>
          frameboard<span className="brand-dot">.</span>
        </Link>
        <p className="brand-caption">A place for your good finds.</p>
        <nav aria-label="Main navigation" className="main-nav">
          <Link to="/" className={!inBoard && !inLibrary ? 'active' : ''}>
            <Compass size={19} />
            Discover
            <span className="nav-active-dot" />
          </Link>
          <Link to="/collections" className={inLibrary ? 'active' : ''}>
            <Grid2X2 size={18} />
            My collections<span className="nav-count">{boards.length}</span>
          </Link>
        </nav>
        <div className="sidebar-section">
          <span>YOUR COLLECTIONS</span>
          <IconButton
            size="small"
            aria-label="New collection"
            onClick={() => setBoardDialog('new')}
          >
            <Plus size={17} />
          </IconButton>
        </div>
        <div className="collection-nav">
          {boards.map((b) => (
            <Link to={`/board/${b.id}`} key={b.id} className={board?.id === b.id ? 'selected' : ''}>
              <span className="collection-dot" style={{ background: b.color }} />
              <span>{b.name}</span>
              <small>{b.count}</small>
            </Link>
          ))}
        </div>
        <button className="sidebar-new" onClick={() => setBoardDialog('new')}>
          <Plus size={16} />
          New collection
        </button>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Leaf size={22} />
            <p>
              Make room for
              <br />
              <strong>a little inspiration.</strong>
            </p>
            <span>Save it now. Come back inspired.</span>
          </div>
          <div className="profile">
            <span className="avatar">{user.guest ? 'Y' : user.name[0].toUpperCase()}</span>
            <div>
              <strong>{user.guest ? 'Your workspace' : user.name}</strong>
              <small>{user.guest ? 'Guest · saved on this browser' : 'Your personal space'}</small>
            </div>
            {!user.guest && (
              <IconButton
                aria-label="Sign out"
                size="small"
                onClick={async () => {
                  try {
                    const data = await api<{ user: User }>('/auth/logout', json('POST'));
                    setUser(data.user);
                    navigate('/');
                    setToast('Signed out. Your account collections are safe.');
                  } catch (err) {
                    setToast(messageOf(err));
                  }
                }}
              >
                <LogOut size={16} />
              </IconButton>
            )}
          </div>
          {user.guest && (
            <Button size="small" fullWidth onClick={() => setAuthOpen(true)}>
              Create account / Sign in
            </Button>
          )}
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Your workspace<span>/</span>
            <strong>{inBoard ? 'Collection' : inLibrary ? 'My collections' : 'Discover'}</strong>
          </div>
          <div className="topbar-right">
            <Button variant="outlined" size="small" onClick={() => setUploadOpen(true)}>
              Upload photo
            </Button>
            <span className="quiet-badge">
              <span />
              Made for your curiosity
            </span>
            <Button
              variant="contained"
              size="small"
              startIcon={<Plus size={16} />}
              onClick={() => setBoardDialog('new')}
            >
              New collection
            </Button>
          </div>
        </header>
        <div className="page-content">
          {pageError && (
            <Alert
              severity="error"
              sx={{ mb: 3 }}
              action={
                <Button color="inherit" size="small" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              }
            >
              {pageError}
            </Alert>
          )}
          {inBoard && boardLoading && (
            <div className="loading-block">
              <CircularProgress size={28} />
              <p>Opening collection…</p>
            </div>
          )}

          {inBoard && board && (
            <>
              <Link to="/collections" className="back-link">
                <ArrowLeft size={15} />
                All collections
              </Link>
              <div className="board-heading">
                <div>
                  <div className="eyebrow">
                    <span className="tiny-dot" style={{ background: board.color }} />
                    {shareToken ? 'SHARED COLLECTION' : 'YOUR COLLECTION'}
                  </div>
                  <h1>{board.name}</h1>
                  <p className="subtitle">
                    {board.description || 'A collection of things worth keeping.'}
                  </p>
                  <div className="board-meta">
                    <span>
                      <Bookmark size={14} />
                      {board.count} saves
                    </span>
                    <span>
                      {board.shareMode === 'private' ? (
                        <LockKeyhole size={14} />
                      ) : (
                        <Users size={14} />
                      )}{' '}
                      {board.role === 'viewer'
                        ? 'View only'
                        : board.role === 'owner'
                          ? board.shareMode === 'private'
                            ? 'Private link'
                            : 'Link sharing on'
                          : 'Collaborator'}
                    </span>
                    <span className="live-status">
                      <span />
                      Updates every 7 seconds
                    </span>
                  </div>
                </div>
                <div className="board-actions">
                  {board.role !== 'viewer' && (
                    <Button variant="outlined" onClick={() => setUploadOpen(true)}>
                      Upload photo
                    </Button>
                  )}
                  {board.role !== 'viewer' && (
                    <Button
                      variant="contained"
                      startIcon={adding ? <Check size={17} /> : <Plus size={17} />}
                      onClick={() => {
                        setAdding(!adding);
                        search('');
                      }}
                    >
                      {adding ? 'Done adding' : 'Add images'}
                    </Button>
                  )}
                  {board.role === 'owner' && (
                    <>
                      <Button
                        variant="outlined"
                        startIcon={<Share2 size={16} />}
                        onClick={() => setShareOpen(true)}
                      >
                        Share
                      </Button>
                      <IconButton
                        aria-label="Edit collection"
                        onClick={() => setBoardDialog(board)}
                      >
                        <Pencil size={18} />
                      </IconButton>
                      <IconButton
                        aria-label="Delete collection"
                        onClick={() => {
                          setDeleteError('');
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 size={18} />
                      </IconButton>
                    </>
                  )}
                </div>
              </div>
              {!adding && (
                <>
                  {board.pins?.length ? (
                    <div className="masonry">
                      {board.pins.map((pin) => (
                        <PhotoCard
                          key={pin.id}
                          photo={pin}
                          editable={board.role !== 'viewer'}
                          onOpen={() => setOpenPhoto(pin)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <FolderHeart size={40} />
                      <h2>A fresh page for your ideas.</h2>
                      <p>
                        {board.role === 'viewer'
                          ? 'This collection has no images yet.'
                          : 'Find something you love and save it here.'}
                      </p>
                      {board.role !== 'viewer' && (
                        <Button
                          variant="contained"
                          onClick={() => {
                            setAdding(true);
                            search('');
                          }}
                        >
                          Find inspiration
                          <ArrowRight size={17} />
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {inLibrary && (
            <>
              <div className="section-intro">
                <span className="eyebrow">YOUR PERSONAL CORNER</span>
                <h1>Collected with care.</h1>
                <p className="subtitle">All the ideas you want to come back to, in one place.</p>
              </div>
              <div className="section-label">
                <h2>
                  Your collections <span>{boards.length}</span>
                </h2>
                <span className="muted small">{totalSaves} saved images</span>
              </div>
              <div className="boards-grid">
                {boards.map((b) => (
                  <BoardCard key={b.id} board={b} />
                ))}
                <button className="new-board-tile" onClick={() => setBoardDialog('new')}>
                  <Plus size={28} />
                  <strong>Start a new collection</strong>
                  <span>Make space for your next idea.</span>
                </button>
              </div>
            </>
          )}

          {showDiscover && (
            <>
              {!inBoard && (
                <section className="hero">
                  <div className="hero-copy">
                    <span className="eyebrow">
                      <span className="small-star">✳</span>FOR THE THINGS THAT CATCH YOUR EYE
                    </span>
                    <h1>
                      A little curiosity.
                      <br />A world of <em>inspiration.</em>
                    </h1>
                    <p>
                      Discover something you love. Give it a home.
                      <br />
                      Build a collection that feels like you.
                    </p>
                    <a href="#explore" className="hero-link">
                      Find your next idea
                      <ArrowRight size={17} />
                    </a>
                  </div>
                  <div className="hero-art" aria-hidden="true">
                    <div className="hero-orbit" />
                    <div className="hero-photo hero-photo-one">
                      <img src="/samples/15.jpg" alt="" />
                      <span>somewhere slow</span>
                    </div>
                    <div className="hero-photo hero-photo-two">
                      <img src="/samples/29.jpg" alt="" />
                      <span>a fresh perspective</span>
                    </div>
                    <span className="hero-sticker">
                      <Sparkles size={15} />
                      worth keeping
                    </span>
                    <span className="art-star">✳</span>
                  </div>
                </section>
              )}
              <section id="explore" className="explore-section">
                <div className="explore-header">
                  <div>
                    <h2>
                      {adding ? `Find something for “${board?.name}”` : 'Follow your curiosity'}
                    </h2>
                    <p className="muted">
                      {adding
                        ? 'Choose an image and save it to this collection.'
                        : 'Small discoveries. Endless possibilities.'}
                    </p>
                  </div>
                  <span className="editorial-label">
                    <Sparkles size={14} />
                    {searchData?.provider === 'pixabay'
                      ? 'Powered by Pixabay'
                      : 'The inspiration edit'}
                  </span>
                </div>
                <form
                  className="search-bar"
                  onSubmit={(e) => {
                    e.preventDefault();
                    search(input);
                  }}
                >
                  <Search size={20} />
                  <input
                    aria-label="Search images"
                    placeholder="Try mountains, ocean, forest…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    maxLength={100}
                  />
                  {input && (
                    <button type="button" className="clear-search" onClick={() => search('')}>
                      Clear
                    </button>
                  )}
                  <button type="submit" className="search-submit">
                    Explore
                    <ArrowRight size={15} />
                  </button>
                </form>
                <div className="filter-row">
                  <div className="topic-pills">
                    {['For you', 'Nature', 'Mountains', 'Ocean', 'Forest', 'Travel', 'Design'].map(
                      (topic) => (
                        <button
                          key={topic}
                          className={
                            query.toLowerCase() === (topic === 'For you' ? '' : topic.toLowerCase())
                              ? 'selected'
                              : ''
                          }
                          onClick={() => search(topic === 'For you' ? '' : topic)}
                        >
                          {topic === 'For you' && <Sparkles size={13} />} {topic}
                        </button>
                      ),
                    )}
                  </div>
                  <span className="result-count">
                    {searchData ? `${searchData.total} finds` : ''}
                  </span>
                </div>
                {searchData?.provider === 'samples' && (
                  <p className="sample-caption">
                    <span className="sample-dot" />
                    Sample library · Search the included photos. Add a Pixabay key to explore more.
                  </p>
                )}
                {searchData?.provider === 'pixabay' && (
                  <p className="sample-caption">
                    Photos from{' '}
                    <a href="https://pixabay.com" target="_blank" rel="noreferrer">
                      Pixabay
                    </a>{' '}
                    · Open a photo for its original source.
                  </p>
                )}
                {searchError && (
                  <Alert
                    severity="error"
                    action={
                      <Button color="inherit" onClick={() => setSearchRetry((n) => n + 1)}>
                        Retry
                      </Button>
                    }
                  >
                    {searchError}
                  </Alert>
                )}
                {searchBusy && !searchData && (
                  <div className="loading-block">
                    <CircularProgress size={28} />
                    <p>Finding your next inspiration…</p>
                  </div>
                )}
                {searchData?.images.length ? (
                  <div className="masonry">
                    {searchData.images.map((photo) => (
                      <PhotoCard
                        key={photo.id}
                        photo={photo}
                        saved={
                          savedIds.has(photo.id) ||
                          Boolean(adding && board?.pins?.some((pin) => pin.imageId === photo.id))
                        }
                        onSave={() => setSavePhoto(photo)}
                        onOpen={() => setOpenPhoto(photo)}
                      />
                    ))}
                  </div>
                ) : (
                  !searchBusy &&
                  !searchError && (
                    <div className="empty-state">
                      <Search size={34} />
                      <h2>No finds just yet.</h2>
                      <p>Try a broader word like “nature”, “ocean”, or “mountains”.</p>
                      <Button onClick={() => search('')}>Explore all photos</Button>
                    </div>
                  )
                )}
                {searchData && searchData.images.length < searchData.total && (
                  <div className="load-more">
                    <Button
                      variant="outlined"
                      disabled={searchBusy}
                      onClick={() => setPage(page + 1)}
                    >
                      {searchBusy ? 'Finding more…' : 'A little more inspiration'}
                    </Button>
                  </div>
                )}
              </section>
            </>
          )}
          <footer className="page-footer">
            <span>
              frameboard<span className="brand-dot">.</span>
            </span>
            <p>Keep what moves you.</p>
            <Leaf size={16} />
          </footer>
        </div>
      </main>

      {uploadOpen && (
        <UploadDialog
          boards={editableBoards}
          preferred={board && board.role !== 'viewer' ? board.id : undefined}
          shareToken={shareToken}
          onClose={() => setUploadOpen(false)}
          onDone={async (id) => {
            setUploadOpen(false);
            setAdding(false);
            setToast('Your photo is saved.');
            try {
              await refresh();
              if (id !== board?.id) navigate(`/board/${id}`);
            } catch (err) {
              setToast(messageOf(err));
            }
          }}
        />
      )}
      {boardDialog && (
        <BoardDialog
          board={boardDialog === 'new' ? undefined : boardDialog}
          onClose={() => setBoardDialog(null)}
          onDone={async (id) => {
            setBoardDialog(null);
            try {
              await refresh();
              if (savePhoto && id) setPreferredSaveBoard(id);
              else if (id) navigate(`/board/${id}`);
              setToast('Collection saved.');
            } catch (err) {
              setToast(messageOf(err));
            }
          }}
        />
      )}
      {authOpen && (
        <AuthDialog
          onClose={() => setAuthOpen(false)}
          onDone={(next) => {
            setUser(next);
            setAuthOpen(false);
            navigate('/collections');
            setToast(`Welcome, ${next.name}.`);
          }}
        />
      )}
      {savePhoto && !boardDialog && (
        <SaveDialog
          key={`${savePhoto.id}-${boards.length}`}
          photo={savePhoto}
          boards={editableBoards}
          preferred={preferredSaveBoard || (adding ? board?.id : undefined)}
          shareToken={shareToken}
          onClose={() => {
            setSavePhoto(null);
            setPreferredSaveBoard(undefined);
          }}
          onCreate={() => setBoardDialog('new')}
          onDone={async (name, duplicate) => {
            setSavedIds((old) => new Set(old).add(savePhoto.id));
            setSavePhoto(null);
            setPreferredSaveBoard(undefined);
            setToast(duplicate ? `Already saved in ${name}.` : `Saved to ${name}.`);
            try {
              await refresh();
            } catch (err) {
              setToast(messageOf(err));
            }
          }}
        />
      )}
      {openPhoto && (
        <ImageDialog
          key={openPhoto.id}
          photo={openPhoto}
          editable={'version' in openPhoto && board?.role !== 'viewer'}
          onClose={() => setOpenPhoto(null)}
          onSave={
            'version' in openPhoto
              ? undefined
              : () => {
                  setSavePhoto(openPhoto);
                  setOpenPhoto(null);
                }
          }
          onUpdate={updatePin}
          onRemove={removePin}
        />
      )}
      {shareOpen && board && (
        <ShareDialog
          board={board}
          onClose={() => setShareOpen(false)}
          onChanged={() => {
            refresh().catch((err) => setToast(messageOf(err)));
          }}
        />
      )}
      <Dialog
        open={deleteOpen}
        onClose={deleteBusy ? undefined : () => setDeleteOpen(false)}
        maxWidth="xs"
      >
        <DialogTitle>Delete “{board?.name}”?</DialogTitle>
        <DialogContent>
          {deleteError && <Alert severity="error">{deleteError}</Alert>}This removes the collection
          and its saved images for everyone. This cannot be undone.
        </DialogContent>
        <DialogActions>
          <Button disabled={deleteBusy} onClick={() => setDeleteOpen(false)}>
            Keep collection
          </Button>
          <Button disabled={deleteBusy} variant="contained" color="error" onClick={deleteBoard}>
            Delete collection
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4500}
        onClose={() => setToast('')}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </div>
  );
}
