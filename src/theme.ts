import type { ThemeOptions } from "@mui/material";

export const themeOptions: ThemeOptions = {
  palette: {
    mode: "dark",
    primary: {
      main: "#94df3f",
      light: "#d8ff72",
      dark: "#5f9929",
      contrastText: "#10150f",
    },
    secondary: {
      main: "#e0682f",
    },
    background: {
      default: "#080b09",
      paper: "#111612",
    },
    text: {
      primary: "#ecf4df",
      secondary: "#929d8c",
    },
    divider: "#34412f",
    success: {
      main: "#94df3f",
    },
    error: {
      main: "#e0682f",
    },
  },
  shape: {
    borderRadius: 0,
  },
  typography: {
    fontFamily: '"Arial Narrow", "Roboto Condensed", system-ui, sans-serif',
  },
  components: {
    MuiTableCell: {
      defaultProps: {
        sx: {
          padding: "5px 10px",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
      },
    },
  },
};
