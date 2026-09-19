import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import App from './App';
import './App.css';

const theme = createTheme({
  palette: {
    primary: { main: '#345b47' },
    secondary: { main: '#ba6e4e' },
    background: { default: '#f7f6f2', paper: '#fffefa' },
    text: { primary: '#242e28', secondary: '#727971' },
  },
  typography: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 10, padding: '10px 18px', gap: 6 } },
    },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 20 } } },
    MuiTextField: { defaultProps: { fullWidth: true, size: 'small' } },
  },
});
// Session bootstrapping runs once; StrictMode would intentionally double-run effects in development.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ThemeProvider>,
);
