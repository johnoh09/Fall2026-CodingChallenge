import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from '@mui/material';
import { Upload } from 'lucide-react';
import { api, messageOf } from '../api';
import type { Board } from '../types';

export default function UploadDialog({
  boards,
  preferred,
  shareToken,
  onClose,
  onDone,
}: {
  boards: Board[];
  preferred?: string;
  shareToken?: string;
  onClose: () => void;
  onDone: (boardId: string) => void;
}) {
  const [boardId, setBoardId] = useState(preferred || boards[0]?.id || '');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function choose(next?: File) {
    setError('');
    setFile(null);
    if (!next) return;
    if (next.size > 10 * 1024 * 1024) {
      setError('Choose a photo smaller than 10 MB.');
      return;
    }
    if (
      !/\.(jpe?g|png|webp)$/i.test(next.name) &&
      !['image/jpeg', 'image/png', 'image/webp'].includes(next.type)
    ) {
      setError('Choose a JPG, PNG, or WebP photo. Convert HEIC photos to JPG first.');
      return;
    }
    setFile(next);
    setTitle(next.name.replace(/\.[^.]+$/, '').slice(0, 160) || 'My photo');
  }
  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !boardId) return;
    setBusy(true);
    setError('');
    try {
      await api(
        `/boards/${boardId}/uploads?title=${encodeURIComponent(title.trim())}`,
        {
          method: 'POST',
          body: await file.arrayBuffer(),
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        },
        shareToken,
      );
      onDone(boardId);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <form onSubmit={upload}>
        <DialogTitle>Your photos, your collection</DialogTitle>
        <DialogContent className="dialog-fields">
          <p className="muted">
            Choose a JPG, PNG, or WebP photo, up to 10 MB. HEIC photos need to be converted to JPG
            first.
          </p>
          {error && <Alert severity="error">{error}</Alert>}
          <label className="upload-picker">
            Choose photo
            <input
              aria-label="Choose photo"
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              disabled={busy}
              onChange={(event) => choose(event.target.files?.[0])}
            />
          </label>
          {preview && <img className="upload-preview" src={preview} alt="Selected photo preview" />}
          {file && (
            <>
              <p className="muted small">
                {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <TextField
                label="Photo title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                disabled={busy}
                slotProps={{ htmlInput: { maxLength: 160 } }}
              />
            </>
          )}
          {boards.length ? (
            <TextField
              select
              label="Save to collection"
              value={boardId}
              onChange={(event) => setBoardId(event.target.value)}
              disabled={busy}
            >
              {boards.map((board) => (
                <MenuItem key={board.id} value={board.id}>
                  {board.name}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <Alert severity="info">Create a collection first, then upload a photo.</Alert>
          )}
          <p className="muted small">Your photo will use this collection’s sharing settings.</p>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={busy || !file || !boardId || !title.trim()}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <Upload size={16} />}
          >
            {busy ? 'Uploading…' : 'Upload & save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
