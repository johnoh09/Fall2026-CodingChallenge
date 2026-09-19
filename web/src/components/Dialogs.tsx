import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { X, Copy, Trash2, ExternalLink, UserPlus, Check, BookmarkPlus } from 'lucide-react';
import { api, json, messageOf } from '../api';
import type { Board, Member, Photo, Pin, ShareMode, User } from '../types';

const colors = ['#dce5dc', '#efe0d1', '#dce4ed', '#e9dce7', '#f0e8c8', '#d8e9e6'];
function Close({ onClose }: { onClose: () => void }) {
  return (
    <IconButton
      aria-label="Close dialog"
      onClick={onClose}
      sx={{ position: 'absolute', top: 12, right: 12 }}
    >
      <X size={20} />
    </IconButton>
  );
}

export function BoardDialog({
  board,
  onClose,
  onDone,
}: {
  board?: Board;
  onClose: () => void;
  onDone: (id?: string) => void;
}) {
  const [name, setName] = useState(board?.name || ''),
    [description, setDescription] = useState(board?.description || ''),
    [color, setColor] = useState(board?.color || colors[0]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api<Board>(
        board ? `/boards/${board.id}` : '/boards',
        json(board ? 'PATCH' : 'POST', { name, description, color }),
      );
      onDone(board?.id || result.id);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <form onSubmit={submit}>
        <DialogTitle>{board ? 'Edit collection' : 'A home for your ideas'}</DialogTitle>
        <Close onClose={onClose} />
        <DialogContent className="dialog-fields">
          <p className="muted">Bring a few good things together.</p>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            autoFocus
            label="Collection name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            slotProps={{ htmlInput: { maxLength: 80 } }}
          />
          <TextField
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={3}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
          <div>
            <p className="field-label">Collection color</p>
            <div className="color-options">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  aria-pressed={c === color}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                >
                  {c === color && <Check size={18} />}
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? 'Saving…' : board ? 'Save changes' : 'Create collection'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export function AuthDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (user: User) => void;
}) {
  const [mode, setMode] = useState<'register' | 'login'>('register'),
    [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api<{ user: User }>(
        `/auth/${mode}`,
        json('POST', { name, email, password }),
      );
      onDone(data.user);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <form onSubmit={submit}>
        <DialogTitle>
          {mode === 'register' ? 'Keep your inspiration close' : 'Welcome back'}
        </DialogTitle>
        <Close onClose={onClose} />
        <DialogContent className="dialog-fields">
          <p className="muted">
            {mode === 'register'
              ? 'Create an account to keep this workspace and access it from another browser.'
              : 'Sign in to your existing collections. Guest collections stay in this guest workspace; they are not merged.'}
          </p>
          {error && <Alert severity="error">{error}</Alert>}
          {mode === 'register' && (
            <TextField
              label="Name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              slotProps={{ htmlInput: { maxLength: 60 } }}
            />
          )}
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            label="Password"
            type="password"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            helperText="At least 8 characters"
            slotProps={{ htmlInput: { minLength: 8, maxLength: 128 } }}
          />
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
          </Button>
          <Button
            onClick={() => {
              setMode(mode === 'register' ? 'login' : 'register');
              setError('');
            }}
          >
            {mode === 'register'
              ? 'Already have an account? Sign in'
              : 'New here? Create an account'}
          </Button>
        </DialogContent>
      </form>
    </Dialog>
  );
}

export function SaveDialog({
  photo,
  boards,
  preferred,
  shareToken,
  onClose,
  onDone,
  onCreate,
}: {
  photo: Photo;
  boards: Board[];
  preferred?: string;
  shareToken?: string;
  onClose: () => void;
  onDone: (name: string, duplicate: boolean) => void;
  onCreate: () => void;
}) {
  const [id, setId] = useState(preferred || boards[0]?.id || ''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api<{ alreadySaved: boolean }>(
        `/boards/${id}/pins`,
        json('POST', { imageId: photo.id }),
        shareToken,
      );
      onDone(boards.find((b) => b.id === id)?.name || 'collection', result.alreadySaved);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <form onSubmit={save}>
        <DialogTitle>Save a little inspiration</DialogTitle>
        <Close onClose={onClose} />
        <DialogContent className="dialog-fields">
          <div className="save-preview">
            <img src={photo.url} alt={photo.title} />
            <div>
              <strong>{photo.title}</strong>
              <p className="muted">{photo.author}</p>
            </div>
          </div>
          {error && <Alert severity="error">{error}</Alert>}
          {boards.length > 0 ? (
            <TextField
              select
              label="Choose a collection"
              value={id}
              onChange={(e) => setId(e.target.value)}
            >
              {boards.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.name}
                  {b.role === 'editor' ? ' · shared' : ''}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <p>Create your first collection to start saving.</p>
          )}
          <Button onClick={onCreate}>+ Create a new collection</Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={busy || !id}
            startIcon={<BookmarkPlus size={17} />}
          >
            {busy ? 'Saving…' : 'Save image'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export function ImageDialog({
  photo,
  editable,
  onClose,
  onSave,
  onUpdate,
  onRemove,
}: {
  photo: Photo | Pin;
  editable?: boolean;
  onClose: () => void;
  onSave?: () => void;
  onUpdate?: (title: string, note: string) => Promise<void>;
  onRemove?: () => Promise<void>;
}) {
  const [title, setTitle] = useState(photo.title),
    [note, setNote] = useState('note' in photo ? photo.note : ''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  async function action(remove = false) {
    setBusy(true);
    setError('');
    try {
      if (remove) await onRemove?.();
      else await onUpdate?.(title, note);
      onClose();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <Close onClose={onClose} />
      <DialogContent className="image-dialog">
        <div className="detail-photo">
          <img src={photo.url} alt={photo.title} />
        </div>
        <div className="detail-text">
          <span className="eyebrow">A CLOSER LOOK</span>
          <h2>{photo.title}</h2>
          {photo.sourceUrl ? (
            <a className="source-link" href={photo.sourceUrl} target="_blank" rel="noreferrer">
              Photo by {photo.author}
              <ExternalLink size={14} />
            </a>
          ) : (
            <p className="muted small">Uploaded by {photo.author}</p>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          {editable ? (
            <>
              <TextField
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                slotProps={{ htmlInput: { maxLength: 160 } }}
              />
              <TextField
                label="A note to remember"
                multiline
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                slotProps={{ htmlInput: { maxLength: 2000 } }}
              />
              <Button variant="contained" onClick={() => action()} disabled={busy || !title.trim()}>
                Save changes
              </Button>
              {confirm ? (
                <Alert severity="warning">
                  Remove this image from the collection?
                  <div>
                    <Button size="small" color="error" disabled={busy} onClick={() => action(true)}>
                      Remove image
                    </Button>
                    <Button size="small" onClick={() => setConfirm(false)}>
                      Keep it
                    </Button>
                  </div>
                </Alert>
              ) : (
                <Button
                  color="error"
                  startIcon={<Trash2 size={16} />}
                  onClick={() => setConfirm(true)}
                >
                  Remove from collection
                </Button>
              )}
            </>
          ) : (
            <>
              {note && <p className="detail-note">{note}</p>}
              {onSave && (
                <Button variant="contained" onClick={onSave} startIcon={<BookmarkPlus size={17} />}>
                  Save to collection
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ShareDialog({
  board,
  onClose,
  onChanged,
}: {
  board: Board;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<ShareMode>(board.shareMode),
    [token, setToken] = useState(board.shareToken),
    [email, setEmail] = useState('');
  const [members, setMembers] = useState<Member[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false);
  const url = token ? `${window.location.origin}/share/${token}` : '';
  async function loadMembers() {
    const data = await api<{ members: Member[] }>(`/boards/${board.id}/members`);
    setMembers(data.members);
  }
  useEffect(() => {
    loadMembers().catch((err) => setError(messageOf(err)));
  }, [board.id]);
  async function changeMode(next: ShareMode | null) {
    if (!next || next === mode) return;
    setBusy(true);
    setError('');
    try {
      const data = await api<{ shareMode: ShareMode; shareToken: string | null }>(
        `/boards/${board.id}/share`,
        json('PUT', { mode: next }),
      );
      setMode(data.shareMode);
      setToken(data.shareToken);
      setCopied(false);
      onChanged();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }
  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/boards/${board.id}/members`, json('POST', { email }));
      setEmail('');
      await loadMembers();
      onChanged();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }
  async function removeMember(id: string) {
    setBusy(true);
    setError('');
    try {
      await api(`/boards/${board.id}/members/${id}`, json('DELETE'));
      await loadMembers();
      onChanged();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Good ideas are better together</DialogTitle>
      <Close onClose={onClose} />
      <DialogContent className="dialog-fields">
        <p className="muted">Share “{board.name}”</p>
        {error && <Alert severity="error">{error}</Alert>}
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(_, next) => changeMode(next)}
          disabled={busy}
          fullWidth
          size="small"
        >
          <ToggleButton value="private">Link off</ToggleButton>
          <ToggleButton value="view">View only</ToggleButton>
          <ToggleButton value="edit">Can edit</ToggleButton>
        </ToggleButtonGroup>
        <p className="muted small">
          {mode === 'private'
            ? 'Only you and invited accounts can open this collection.'
            : mode === 'view'
              ? 'Anyone with this link can view. Only you and invited accounts can edit.'
              : 'Anyone with this link can add, edit, and remove images.'}{' '}
          Changing link access invalidates the previous link.
        </p>
        {url && (
          <>
            <TextField label="Share link" value={url} slotProps={{ input: { readOnly: true } }} />
            <Button
              variant="outlined"
              startIcon={copied ? <Check size={16} /> : <Copy size={16} />}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                } catch {
                  setError('Select the link above and copy it manually.');
                }
              }}
            >
              {copied ? 'Copied!' : 'Copy link'}
            </Button>
            <p className="muted small">
              Localhost links work on this computer. Sharing across computers requires hosting the
              app at a reachable address.
            </p>
          </>
        )}
        <hr className="divider" />
        <h3 className="compact-heading">Invite an account to collaborate</h3>
        <p className="muted small">
          They need a registered Frameboard account on this server. Inviting grants editing access
          even when the share link is off.
        </p>
        <form onSubmit={addMember} className="invite-form">
          <TextField
            label="Collaborator email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button
            type="submit"
            variant="contained"
            disabled={busy}
            startIcon={<UserPlus size={16} />}
          >
            Add
          </Button>
        </form>
        {members.map((member) => (
          <div className="member-row" key={member.id}>
            <div>
              <strong>{member.name}</strong>
              <small>{member.email}</small>
            </div>
            <IconButton
              aria-label={`Remove ${member.name}`}
              disabled={busy}
              onClick={() => removeMember(member.id)}
            >
              <X size={17} />
            </IconButton>
          </div>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
